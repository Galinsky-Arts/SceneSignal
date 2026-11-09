import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Render's private PostgreSQL endpoint uses a self-signed certificate. Use the
// explicitly configured public endpoint while retaining full TLS validation.
try {
  const database = new URL(process.env.DATABASE_URL ?? '');
  const hostname = process.env.POSTGRES_EXTERNAL_HOST ?? '';
  if (!/^dpg-[a-z0-9-]+\.(?:virginia|ohio|oregon|frankfurt|singapore)-postgres\.render\.com$/.test(hostname))
    throw Error('RENDER_POSTGRES_EXTERNAL_HOST_REQUIRED');
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || database.searchParams.has('ssl'))
    throw Error('INVALID_DATABASE_CONFIGURATION');
  database.hostname = hostname;
  database.searchParams.set('sslmode', 'verify-full');
  process.env.DATABASE_URL = database.href;
  process.env.BETTER_AUTH_URL = process.env.RENDER_EXTERNAL_URL;
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
