import { createServer } from 'node:http';
import { resolve } from 'node:path';
import pg from 'pg';
import { createAccountService } from './accounts.js';

let pool: pg.Pool | undefined;
try {
  const required = ['DATABASE_URL', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET'] as const;
  for (const name of required) if (!process.env[name]) throw Error('Missing configuration: ' + name);
  const database = new URL(process.env.DATABASE_URL!);
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw Error('Invalid database protocol');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(database.hostname);
  if (!local && (database.searchParams.has('ssl') || (database.searchParams.has('sslmode') && database.searchParams.get('sslmode') !== 'verify-full')))
    throw Error('Remote database requires certificate verification');
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL!, max: 10,
    connectionTimeoutMillis: 5000, ...(local ? {} : { ssl: { rejectUnauthorized: true } }) });
  const application = createAccountService({ pool, baseURL: process.env.BETTER_AUTH_URL!,
    secret: process.env.BETTER_AUTH_SECRET!, staticRoot: resolve('web-dist') });
  if (process.argv.includes('--migrate')) {
    try { await application.migrate(); } finally { await pool.end(); }
  } else {
    await pool.query('SELECT 1 FROM scene_account_membership LIMIT 0');
    const port = Number(process.env.PORT ?? 3000);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
    const server = createServer((request, response) => { void application.handle(request, response); });
    server.listen(port, '0.0.0.0', () => console.log('SceneSignal account service listening on port ' + port));
    server.once('error', () => {
      console.error('SceneSignal account listener failed.');
      void pool?.end(); process.exitCode = 1;
    });
    const shutdown = () => {
      server.close(() => { void pool?.end(); });
      const timer = setTimeout(() => server.closeAllConnections(), 5000); timer.unref();
    };
    process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  }

} catch {
  if (pool) { try { await pool.end(); } catch { /* preserve sanitized startup failure */ } }
  console.error('SceneSignal account startup failed. Check DATABASE_URL, BETTER_AUTH_URL, BETTER_AUTH_SECRET and database migration readiness.');
  process.exitCode = 1;
}
