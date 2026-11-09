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

test('real Better Auth HTTP sessions and scoped PostgreSQL account memberships', async t => {
  const admin = new pg.Pool({ connectionString });
  const schema = 'scene_auth_' + randomUUID().replaceAll('-', '');
  await admin.query('CREATE SCHEMA ' + schema);
  const pool = new pg.Pool({ connectionString, max: 8, options: '-c search_path=' + schema });
  let application;
  const server = createServer((request, response) => { void application.handle(request, response); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const secret = randomBytes(32).toString('base64');
  application = createAccountService({ pool, baseURL: origin, secret });
  const call = (path, { cookie, body, origin: requestOrigin = origin, method = body === undefined ? 'GET' : 'POST' } = {}) =>
    fetch(origin + path, { method, headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    await application.migrate();
    await application.migrate();
    assert.equal((await call('/healthz')).status, 200);
    let alice, aliceCookie, bob, bobCookie, scene;
    await t.test('real sign-up and get-session create database-backed identities and HttpOnly cookies', async () => {
      for (const name of ['alice', 'bob']) {
        const response = await call('/api/auth/sign-up/email', { body: { name, email: name + '@example.test', password: 'unique-test-password-2026' } });
        assert.equal(response.status, 200, await response.clone().text());
        assert.ok(response.headers.getSetCookie().some(value => /httponly/i.test(value)));
        const user = (await response.json()).user;
        const cookie = cookies(response);
        const current = await call('/api/auth/get-session', { cookie });
        assert.equal(current.status, 200); assert.equal((await current.json()).user.id, user.id);
        if (name === 'alice') { alice = user; aliceCookie = cookie; } else { bob = user; bobCookie = cookie; }
      }
      assert.notEqual(alice.id, bob.id);
    });
    await t.test('absent/forged cookies and browser role injection cannot mint scoped identity', async () => {
      assert.equal((await call('/api/scene/sessions')).status, 401);
      assert.equal((await call('/api/scene/sessions', { cookie: 'scenesignal.session_token=forged' })).status, 401);
      const injected = await call('/api/scene/sessions', { cookie: aliceCookie, body: { identityId: bob.id, role: 'organizer', privatePermit: 'must-not-store' } });
      assert.equal(injected.status, 400);
      const count = await pool.query('SELECT COUNT(*)::int AS count FROM scene_account_membership');
      assert.equal(count.rows[0].count, 0);
    });
    await t.test('session ownership comes from the authenticated account and foreign access is denied', async () => {
      const response = await call('/api/scene/sessions', { cookie: aliceCookie, body: {} });
      assert.equal(response.status, 201); scene = (await response.json()).actor;
      assert.equal(scene.identityId, alice.id); assert.deepEqual(scene.roles, ['organizer']);
      assert.ok(scene.expiresAtMs > Date.now() && scene.expiresAtMs <= Date.now() + 60000);
      const path = '/api/scene/actor?tenantId=' + scene.tenantId + '&sessionId=' + scene.sessionId;
      assert.equal((await call(path, { cookie: bobCookie })).status, 403);
      const own = await call(path + '&identityId=' + bob.id + '&roles=organizer', { cookie: aliceCookie });
      assert.equal(own.status, 200); assert.equal((await own.json()).actor.identityId, alice.id);
      assert.equal((await call('/api/scene/sessions', { cookie: bobCookie })).status, 200);
      const privateRows = await pool.query('SELECT * FROM scene_account_membership');
      assert.equal(privateRows.rowCount, 1); assert.ok(!JSON.stringify(privateRows.rows).includes('must-not-store'));
    });
    await t.test('only the scoped organizer can grant, change or revoke collaborator membership', async () => {
      const membership = { tenantId: scene.tenantId, sessionId: scene.sessionId, identityId: bob.id, role: 'operator' };
      assert.equal((await call('/api/scene/memberships', { cookie: bobCookie, body: membership })).status, 403);
      assert.equal((await call('/api/scene/memberships', { cookie: aliceCookie, body: { ...membership, role: 'organizer' } })).status, 400);
      assert.equal((await call('/api/scene/memberships', { cookie: aliceCookie, body: { ...membership, tenantId: randomUUID() } })).status, 403);
      assert.equal((await call('/api/scene/memberships', { cookie: aliceCookie, body: membership })).status, 200);
      const path = '/api/scene/actor?tenantId=' + scene.tenantId + '&sessionId=' + scene.sessionId;
      assert.deepEqual((await (await call(path, { cookie: bobCookie })).json()).actor.roles, ['operator']);
      assert.equal((await call('/api/scene/memberships', { cookie: aliceCookie, body: { ...membership, role: 'performer' } })).status, 200);
      assert.deepEqual((await (await call(path, { cookie: bobCookie })).json()).actor.roles, ['performer']);
      assert.equal((await call('/api/scene/memberships', { cookie: aliceCookie, body: { ...membership, identityId: alice.id, role: 'contributor' } })).status, 403);
      const { role, ...removal } = membership;
      assert.equal((await call('/api/scene/memberships', { cookie: bobCookie, method: 'DELETE', body: { ...removal, identityId: alice.id } })).status, 403);
      assert.equal((await call('/api/scene/memberships', { cookie: bobCookie, method: 'DELETE', body: removal })).status, 200);
      assert.equal((await call(path, { cookie: bobCookie })).status, 403);
      assert.equal((await call('/api/scene/memberships', { cookie: aliceCookie, body: membership })).status, 200);
      assert.equal((await call('/api/scene/memberships', { cookie: aliceCookie, method: 'DELETE', body: removal })).status, 200);
      assert.equal((await call(path, { cookie: bobCookie })).status, 403);
    });
    await t.test('wrong-origin mutations are denied by both the application and Better Auth', async () => {
      const response = await call('/api/scene/sessions', { cookie: aliceCookie, origin: 'https://foreign.example', body: {} });
      assert.equal(response.status, 403);
      const signup = await call('/api/auth/sign-up/email', { origin: 'https://foreign.example',
        body: { name: 'forged', email: 'forged@example.test', password: 'unique-test-password-2026' } });
      assert.equal(signup.status, 403);
    });
    await t.test('membership changes are rechecked instead of trusting old browser role claims', async () => {
      const path = '/api/scene/actor?tenantId=' + scene.tenantId + '&sessionId=' + scene.sessionId;
      await pool.query('UPDATE scene_account_membership SET role=$1 WHERE user_id=$2', ['contributor', alice.id]);
      const changed = await call(path, { cookie: aliceCookie }); assert.equal(changed.status, 200);
      assert.deepEqual((await changed.json()).actor.roles, []);
      await pool.query('DELETE FROM scene_account_membership WHERE user_id=$1', [alice.id]);
      assert.equal((await call(path, { cookie: aliceCookie })).status, 403);
    });
    await t.test('restarting the service retains real sessions and sign-out revokes only the caller', async () => {
      application = createAccountService({ pool, baseURL: origin, secret });
      assert.equal((await (await call('/api/auth/get-session', { cookie: bobCookie })).json()).user.id, bob.id);
      const logout = await call('/api/auth/sign-out', { cookie: aliceCookie, body: {} });
      assert.equal(logout.status, 200);
      assert.equal((await call('/api/scene/sessions', { cookie: aliceCookie })).status, 401);
      assert.equal((await call('/api/scene/sessions', { cookie: bobCookie })).status, 200);
      const badLogin = await call('/api/auth/sign-in/email', { body: { email: 'alice@example.test', password: 'wrong-test-password' } });
      assert.equal(badLogin.status, 401);
      const login = await call('/api/auth/sign-in/email', { body: { email: 'alice@example.test', password: 'unique-test-password-2026' } });
      assert.equal(login.status, 200);
      assert.equal((await call('/api/scene/sessions', { cookie: cookies(login) })).status, 200);
    });
    await t.test('rotating the account secret invalidates previously issued cookies', async () => {
      application = createAccountService({ pool, baseURL: origin, secret: randomBytes(32).toString('base64') });
      assert.equal((await call('/api/scene/sessions', { cookie: bobCookie })).status, 401);
      const login = await call('/api/auth/sign-in/email', { body: { email: 'bob@example.test', password: 'unique-test-password-2026' } });
      assert.equal(login.status, 200);
      assert.equal((await call('/api/scene/sessions', { cookie: cookies(login) })).status, 200);
    });
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await pool.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.end();
  }
});
