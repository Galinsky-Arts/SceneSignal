import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { createAccountService } from '../dist/server/accounts.js';

const connectionString = process.env.SCENESIGNAL_TEST_DATABASE_URL;
assert.ok(connectionString, 'SCENESIGNAL_TEST_DATABASE_URL is required');
const target = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) && target.pathname === '/scenesignal_test', 'Use a dedicated local test database');
const cookies = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');

test('password recovery, password change and account deletion through real Better Auth/PostgreSQL', async t => {
  const admin = new pg.Pool({ connectionString });
  const schema = 'scene_recovery_' + randomUUID().replaceAll('-', '');
  await admin.query('CREATE SCHEMA ' + schema);
  const pool = new pg.Pool({ connectionString, max: 8, options: '-c search_path=' + schema });
  const outbox = [];
  let application;
  const server = createServer((request, response) => { void application.handle(request, response); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const secret = randomBytes(32).toString('base64');
  application = createAccountService({ pool, baseURL: origin, secret, passwordResetMailer: async message => { outbox.push(message); } });
  const call = (path, { cookie, body, method = body === undefined ? 'GET' : 'POST' } = {}) =>
    fetch(origin + path, { method, redirect: 'manual', headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const signUp = async name => {
    const response = await call('/api/auth/sign-up/email', { body: { name, email: name + '@example.test', password: 'first-test-password-2026' } });
    assert.equal(response.status, 200, await response.clone().text());
    return { user: (await response.json()).user, cookie: cookies(response) };
  };
  try {
    await application.migrate();
    const carol = await signUp('carol'), dave = await signUp('dave');
    await t.test('capabilities disclose only whether recovery delivery is configured', async () => {
      assert.deepEqual(await (await call('/api/capabilities')).json(), { passwordRecovery: true, emailVerification: false });
      const disabled = createAccountService({ pool, baseURL: origin, secret });
      const previous = application; application = disabled;
      try {
        assert.deepEqual(await (await call('/api/capabilities')).json(), { passwordRecovery: false, emailVerification: false });
        const refused = await call('/api/auth/request-password-reset', { body: { email: 'carol@example.test', redirectTo: origin + '/' } });
        assert.notEqual(refused.status, 200);
      } finally { application = previous; }
    });
    await t.test('unknown addresses receive the same response and no message', async () => {
      const response = await call('/api/auth/request-password-reset', { body: { email: 'nobody@example.test', redirectTo: origin + '/' } });
      assert.equal(response.status, 200); assert.equal(outbox.length, 0);
    });
    await t.test('foreign reset redirect targets are refused', async () => {
      const response = await call('/api/auth/request-password-reset', { body: { email: 'carol@example.test', redirectTo: 'https://foreign.example/' } });
      assert.equal(response.status, 403); assert.equal(outbox.length, 0);
    });
    await t.test('reset requests are rate limited per client before mail delivery', async () => {
      // Three requests were already made above; the fourth inside the window is refused.
      const limited = await call('/api/auth/request-password-reset', { body: { email: 'carol@example.test', redirectTo: origin + '/' } });
      assert.equal(limited.status, 429); assert.equal(outbox.length, 0);
      await pool.query('DELETE FROM "rateLimit"');
    });
    await t.test('a mailed single-use link resets the password and revokes existing sessions', async () => {
      const response = await call('/api/auth/request-password-reset', { body: { email: 'carol@example.test', redirectTo: origin + '/?account=reset' } });
      assert.equal(response.status, 200); assert.equal(outbox.length, 1);
      assert.equal(outbox[0].to, 'carol@example.test');
      const link = new URL(outbox[0].url); assert.equal(link.origin, origin);
      const redirect = await call(link.pathname + link.search);
      assert.equal(redirect.status, 302);
      const landing = new URL(redirect.headers.get('location'), origin);
      assert.equal(landing.origin, origin); assert.equal(landing.searchParams.get('account'), 'reset');
      const token = landing.searchParams.get('token'); assert.ok(token);
      assert.equal((await call('/api/auth/reset-password', { body: { token, newPassword: 'short' } })).status, 400);
      const reset = await call('/api/auth/reset-password', { body: { token, newPassword: 'second-test-password-2026' } });
      assert.equal(reset.status, 200, await reset.clone().text());
      assert.equal((await call('/api/scene/sessions', { cookie: carol.cookie })).status, 401);
      assert.equal((await call('/api/auth/reset-password', { body: { token, newPassword: 'third-test-password-2026' } })).status, 400);
      assert.equal((await call('/api/auth/sign-in/email', { body: { email: 'carol@example.test', password: 'first-test-password-2026' } })).status, 401);
      const login = await call('/api/auth/sign-in/email', { body: { email: 'carol@example.test', password: 'second-test-password-2026' } });
      assert.equal(login.status, 200); carol.cookie = cookies(login);
    });
    await t.test('signed-in password change requires the current password', async () => {
      assert.equal((await call('/api/auth/change-password', { cookie: dave.cookie,
        body: { currentPassword: 'wrong-test-password', newPassword: 'changed-test-password-2026' } })).status, 400);
      const changed = await call('/api/auth/change-password', { cookie: dave.cookie,
        body: { currentPassword: 'first-test-password-2026', newPassword: 'changed-test-password-2026', revokeOtherSessions: true } });
      assert.equal(changed.status, 200, await changed.clone().text());
      const login = await call('/api/auth/sign-in/email', { body: { email: 'dave@example.test', password: 'changed-test-password-2026' } });
      assert.equal(login.status, 200); dave.cookie = cookies(login);
    });
    await t.test('organizer deletion re-proves the password and removes its session references', async () => {
      const created = await call('/api/scene/sessions', { cookie: carol.cookie, body: {} });
      const scene = (await created.json()).actor;
      assert.equal((await call('/api/scene/memberships', { cookie: carol.cookie,
        body: { tenantId: scene.tenantId, sessionId: scene.sessionId, identityId: dave.user.id, role: 'operator' } })).status, 200);
      const owned = await call('/api/scene/sessions', { cookie: dave.cookie, body: {} });
      const davesScene = (await owned.json()).actor;
      assert.equal((await call('/api/auth/delete-user', { cookie: carol.cookie, body: {} })).status, 400);
      assert.equal((await call('/api/auth/delete-user', { cookie: carol.cookie, body: { password: 'wrong-test-password' } })).status, 400);
      assert.equal((await call('/api/auth/delete-user/callback?token=forged', { cookie: carol.cookie })).status, 404);
      assert.equal((await call('/api/auth/get-session', { cookie: carol.cookie })).status, 200);
      const removed = await call('/api/auth/delete-user', { cookie: carol.cookie, body: { password: 'second-test-password-2026' } });
      assert.equal(removed.status, 200, await removed.clone().text());
      assert.equal((await call('/api/scene/sessions', { cookie: carol.cookie })).status, 401);
      assert.equal((await pool.query('SELECT 1 FROM "user" WHERE id=$1', [carol.user.id])).rowCount, 0);
      const remaining = await pool.query('SELECT tenant_id,session_id,user_id,role FROM scene_account_membership ORDER BY role');
      assert.deepEqual(remaining.rows, [{ tenant_id: davesScene.tenantId, session_id: davesScene.sessionId, user_id: dave.user.id, role: 'organizer' }]);
      await pool.query('DELETE FROM "rateLimit"');
      assert.equal((await call('/api/auth/sign-in/email', { body: { email: 'carol@example.test', password: 'second-test-password-2026' } })).status, 401);
    });
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await pool.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.end();
  }
});

test('email verification is off without mail and verifies ownership with a signed, expiring link when configured', async () => {
  const admin = new pg.Pool({ connectionString });
  const schema = 'scene_verify_' + randomUUID().replaceAll('-', '');
  await admin.query('CREATE SCHEMA ' + schema);
  const pool = new pg.Pool({ connectionString, max: 8, options: '-c search_path=' + schema });
  const outbox = [];
  let application;
  const server = createServer((request, response) => { void application.handle(request, response); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const secret = randomBytes(32).toString('base64');
  const call = (path, { cookie, body, method = body === undefined ? 'GET' : 'POST' } = {}) =>
    fetch(origin + path, { method, redirect: 'manual', headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    application = createAccountService({ pool, baseURL: origin, secret });
    await application.migrate();
    const off = await call('/api/auth/sign-up/email', { body: { name: 'erin', email: 'erin@example.test', password: 'first-test-password-2026' } });
    assert.equal(off.status, 200);
    assert.equal((await off.json()).user.emailVerified, false);
    assert.equal(outbox.length, 0);

    application = createAccountService({ pool, baseURL: origin, secret, emailVerificationMailer: async message => { outbox.push(message); } });
    assert.deepEqual(await (await call('/api/capabilities')).json(), { passwordRecovery: false, emailVerification: true });
    const signUp = await call('/api/auth/sign-up/email', { body: { name: 'fay', email: 'fay@example.test', password: 'first-test-password-2026',
      callbackURL: '/?account=verified' } });
    assert.equal(signUp.status, 200);
    const cookie = cookies(signUp);
    for (let i = 0; i < 50 && !outbox.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, 'fay@example.test');
    const link = new URL(outbox[0].url);
    assert.equal(link.origin, origin);
    assert.equal(link.pathname, '/api/auth/verify-email');
    // A tampered token is refused and the address stays unverified.
    const forged = new URL(link); forged.searchParams.set('token', link.searchParams.get('token').slice(0, -2) + 'xx');
    const refused = await fetch(forged, { redirect: 'manual' });
    assert.match(refused.headers.get('location') ?? '', /error=/);
    const verified = await fetch(link, { redirect: 'manual' });
    assert.equal(verified.status, 302);
    assert.equal(new URL(verified.headers.get('location'), origin).search, '?account=verified');
    const session = await (await call('/api/auth/get-session', { cookie })).json();
    assert.equal(session.user.emailVerified, true);
    // Cross-origin redirect targets are refused.
    const evil = await call('/api/auth/send-verification-email', { cookie, body: { email: 'fay@example.test', callbackURL: 'https://evil.example/' } });
    assert.equal(evil.status, 403);
  } finally {
    server.close(); await pool.end();
    await admin.query('DROP SCHEMA ' + schema + ' CASCADE'); await admin.end();
  }
});
