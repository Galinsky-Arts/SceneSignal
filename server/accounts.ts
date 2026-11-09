import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { identifier, invariant } from '@neophilism/distributed-audio-engine';
import type { SceneActor, SceneRole } from '../src/session.js';

export interface AccountServiceOptions { pool: Pool; baseURL: string; secret: string; staticRoot?: string }
class HttpFailure extends Error { constructor(readonly status: number, readonly code: string) { super(code); } }
function fail(status: number, code: string): never { throw new HttpFailure(status, code); }
async function jsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!request.headers['content-type']?.startsWith('application/json')) fail(415, 'json_required');
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk); size += bytes.length;
    if (size > 4096) fail(413, 'request_too_large');
    chunks.push(bytes);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'invalid_request');
    return value as Record<string, unknown>;
  } catch { return fail(400, 'invalid_request'); }
}
function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

/** Account credentials/cookies stay inside Better Auth. This service stores only
 * identity/membership metadata; it never receives protected plans or key material. */
export function createAccountService(options: AccountServiceOptions) {
  let base: URL;
  try { base = new URL(options.baseURL); } catch { throw Error('ACCOUNT_SERVICE_HTTPS_REQUIRED'); }
  invariant(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/' &&
    (base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))),
    'ACCOUNT_SERVICE_HTTPS_REQUIRED');
  invariant(typeof options.secret === 'string' && options.secret.length >= 32 && options.secret.length <= 256,
    'ACCOUNT_SERVICE_SECRET_REQUIRED');
  const pool = options.pool;
  const staticRoot = options.staticRoot;
  const configuration = {
    appName: 'SceneSignal', baseURL: base.origin, secret: options.secret, database: pool,
    trustedOrigins: [base.origin],
    emailAndPassword: { enabled: true },
    session: { expiresIn: 86400, updateAge: 3600, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 60, storage: 'database' },
    advanced: { cookiePrefix: 'scenesignal', useSecureCookies: base.protocol === 'https:',
      ipAddress: { ipAddressHeaders: ['x-scenesignal-verified-ip'] } },
    logger: { level: 'error' }, telemetry: { enabled: false }
  } satisfies BetterAuthOptions;
  const createAuth = () => betterAuth(configuration);
  let instance: ReturnType<typeof createAuth> | undefined;
  const getAuth = () => instance ??= createAuth();
  async function account(request: IncomingMessage) {
    const value = await getAuth().api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!value || value.session.expiresAt.getTime() <= Date.now()) fail(401, 'sign_in_required');
    identifier(value.user.id);
    return value;
  }
  function actor(userId: string, expiresAt: Date, tenantId: string, sessionId: string, role: string): SceneActor {
    identifier(tenantId); identifier(sessionId);
    invariant(['organizer', 'performer', 'operator', 'steward', 'contributor'].includes(role), 'INVALID_STORED_SCENE_ROLE');
    return { identityId: userId, tenantId, sessionId, roles: role === 'contributor' ? [] : [role as SceneRole],
      expiresAtMs: Math.min(expiresAt.getTime(), Date.now() + 60000) };
  }
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    // Ignore client-supplied forwarding headers; a reverse proxy cannot grant
    // an attacker unlimited rate-limit identities through an arbitrary header.
    request.headers['x-scenesignal-verified-ip'] = request.socket.remoteAddress ?? 'unknown';
    try {
      const url = new URL(request.url ?? '/', base.origin);
      if (url.origin !== base.origin) fail(400, 'invalid_request_origin');
      if (url.pathname.startsWith('/api/auth/')) { await toNodeHandler(getAuth())(request, response); return; }
      if (url.pathname === '/healthz' && request.method === 'GET') {
        await pool.query('SELECT 1 FROM "user","session","account","verification","rateLimit",scene_account_membership LIMIT 0');
        send(response, 200, { status: 'ok' }); return;
      }
      if (url.pathname.startsWith('/api/scene/')) {
        const current = await account(request);
        if (!['GET', 'HEAD'].includes(request.method ?? '') && request.headers.origin !== base.origin)
          fail(403, 'origin_denied');
        if (url.pathname === '/api/scene/actor' && request.method === 'GET') {
          const tenantId = url.searchParams.get('tenantId'), sessionId = url.searchParams.get('sessionId');
          try { identifier(tenantId); identifier(sessionId); } catch { fail(400, 'invalid_scope'); }
          const found = await pool.query<{ role: string }>('SELECT role FROM scene_account_membership WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3',
            [tenantId, sessionId, current.user.id]);
          if (!found.rows[0]) fail(403, 'session_access_denied');
          send(response, 200, { actor: actor(current.user.id, current.session.expiresAt, tenantId, sessionId, found.rows[0].role) }); return;
        }
        if (url.pathname === '/api/scene/sessions' && request.method === 'GET') {
          const found = await pool.query<{ tenant_id: string; session_id: string; role: string }>(
            'SELECT tenant_id,session_id,role FROM scene_account_membership WHERE user_id=$1 ORDER BY created_at DESC,session_id LIMIT 100', [current.user.id]);
          send(response, 200, { sessions: found.rows.map(row => ({ tenantId: row.tenant_id, sessionId: row.session_id, role: row.role })) }); return;
        }
        if (url.pathname === '/api/scene/sessions' && request.method === 'POST') {
          if (Object.keys(await jsonBody(request)).length) fail(400, 'unexpected_session_fields');
          const client = await pool.connect();
          const tenantId = randomUUID(), sessionId = randomUUID();
          try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['scene-account:' + current.user.id]);
            const count = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM scene_account_membership WHERE user_id=$1', [current.user.id]);
            if (Number(count.rows[0]?.count) >= 100) fail(409, 'session_limit');
            await client.query('INSERT INTO scene_account_membership(tenant_id,session_id,user_id,role) VALUES($1,$2,$3,$4)',
              [tenantId, sessionId, current.user.id, 'organizer']);
            await client.query('COMMIT');
          } catch (error) { try { await client.query('ROLLBACK'); } catch { /* preserve denial */ } throw error; }
          finally { client.release(); }
          send(response, 201, { actor: actor(current.user.id, current.session.expiresAt, tenantId, sessionId, 'organizer') }); return;
        }
        if (url.pathname === '/api/scene/memberships' && ['POST', 'DELETE'].includes(request.method ?? '')) {
          const body = await jsonBody(request), removing = request.method === 'DELETE';
          if (Object.keys(body).sort().join(',') !== (removing ? 'identityId,sessionId,tenantId' : 'identityId,role,sessionId,tenantId'))
            fail(400, 'unexpected_membership_fields');
          const { tenantId, sessionId, identityId } = body;
          try { identifier(tenantId); identifier(sessionId); identifier(identityId); } catch { fail(400, 'invalid_membership_scope'); }
          if (!removing && (typeof body.role !== 'string' || !['performer', 'operator', 'steward', 'contributor'].includes(body.role))) fail(400, 'invalid_collaborator_role');
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([tenantId, sessionId])]);
            const owner = await client.query<{ role: string }>('SELECT role FROM scene_account_membership WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3 FOR UPDATE',
              [tenantId, sessionId, current.user.id]);
            const selfLeaving = removing && identityId === current.user.id &&
              owner.rows[0] !== undefined && owner.rows[0].role !== 'organizer';
            if (owner.rows[0]?.role !== 'organizer' && !selfLeaving) fail(403, 'organizer_required');
            const prior = await client.query<{ role: string }>('SELECT role FROM scene_account_membership WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3 FOR UPDATE',
              [tenantId, sessionId, identityId]);
            if (prior.rows[0]?.role === 'organizer' || (identityId === current.user.id && !selfLeaving)) fail(403, 'organizer_membership_protected');
            if (removing) await client.query('DELETE FROM scene_account_membership WHERE tenant_id=$1 AND session_id=$2 AND user_id=$3', [tenantId, sessionId, identityId]);
            else {
              if (!(await client.query('SELECT id FROM "user" WHERE id=$1', [identityId])).rowCount) fail(404, 'account_not_found');
              const count = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM scene_account_membership WHERE tenant_id=$1 AND session_id=$2', [tenantId, sessionId]);
              if (!prior.rows.length && Number(count.rows[0]?.count) >= 4096) fail(409, 'collaborator_limit');
              await client.query('INSERT INTO scene_account_membership(tenant_id,session_id,user_id,role) VALUES($1,$2,$3,$4) '+
                'ON CONFLICT(tenant_id,session_id,user_id) DO UPDATE SET role=EXCLUDED.role', [tenantId, sessionId, identityId, body.role]);
            }
            await client.query('COMMIT');
          } catch (error) { try { await client.query('ROLLBACK'); } catch { /* preserve denial */ } throw error; }
          finally { client.release(); }
          send(response, 200, { updated: true }); return;
        }
        fail(404, 'not_found');
      }
      if (staticRoot && request.method === 'GET') {
        const path = url.pathname === '/' || url.pathname === '/index.html' ? 'index.html' :
          /^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(url.pathname) ? url.pathname.slice(1) : null;
        if (path) {
          const bytes = await readFile(join(staticRoot, path));
          response.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" });
          response.end(bytes); return;
        }
      }
      send(response, 404, { error: 'not_found' });
    } catch (error) {
      if (!response.headersSent) send(response, error instanceof HttpFailure ? error.status : 503,
        { error: error instanceof HttpFailure ? error.code : 'service_unavailable' });
      else response.end();
    }
  }
  return { get auth() { return getAuth(); }, handle,
    async migrate(): Promise<void> {
      const migration = await getMigrations(configuration);
      if (migration.unsafeChanges.length || migration.schemaProblems.length) throw Error('ACCOUNT_SCHEMA_REVIEW_REQUIRED');
      await migration.runMigrations();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const file of ['0001_scene_contributions.sql', '0002_scene_accounts.sql'])
          await client.query(await readFile(new URL('../../db/migrations/' + file, import.meta.url), 'utf8'));
        await client.query('COMMIT');
      } catch (error) { try { await client.query('ROLLBACK'); } catch { /* preserve migration failure */ } throw error; }
      finally { client.release(); }
    }
  };
}
