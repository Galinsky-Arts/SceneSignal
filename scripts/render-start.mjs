import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Two database modes, both with full certificate verification:
// - Render PostgreSQL: its private endpoint uses a self-signed certificate, so
//   POSTGRES_EXTERNAL_HOST selects the public endpoint instead.
// - An external managed provider (for example Neon): DATABASE_URL must already
//   name a public, publicly-certified host; POSTGRES_EXTERNAL_HOST is unset.
try {
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || database.searchParams.has('ssl'))
    throw Error('INVALID_DATABASE_CONFIGURATION');
  const hostname = process.env.POSTGRES_EXTERNAL_HOST ?? '';
  if (hostname) {
    if (!/^dpg-[a-z0-9-]+\.(?:virginia|ohio|oregon|frankfurt|singapore)-postgres\.render\.com$/.test(hostname))
      throw Error('RENDER_POSTGRES_EXTERNAL_HOST_REQUIRED');
    database.hostname = hostname;
  } else if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(database.hostname) ||
    /^dpg-|\.local$|\.internal$/.test(database.hostname)) {
    throw Error('PUBLIC_DATABASE_HOST_REQUIRED');
  }
  // Provider hints such as sslmode=require or channel_binding are replaced by
  // the strictest verified mode the application accepts.
  database.searchParams.delete('channel_binding');
  database.searchParams.set('sslmode', 'verify-full');
  const external = new URL(process.env.RENDER_EXTERNAL_URL ?? '');
  if (external.protocol !== 'https:') throw Error('HTTPS_EXTERNAL_URL_REQUIRED');
  process.env.DATABASE_URL = database.href;
  process.env.BETTER_AUTH_URL = external.origin + '/';
} catch {
  console.error('SceneSignal Render configuration is invalid. Check the database and external hostname settings.');
  process.exit(1);
}

const migration = spawn(process.execPath, ['dist/server/main.js', '--migrate'], { stdio: 'inherit' });
const [code, signal] = await once(migration, 'exit');
if (code !== 0 || signal) {
  console.error('SceneSignal Render migration did not complete.');
  process.exitCode = 1;
} else {
  // Import in-process so the service receives Render's shutdown signals directly.
  await import('../dist/server/main.js');
}
