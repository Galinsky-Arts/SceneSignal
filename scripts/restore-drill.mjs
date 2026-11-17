// Account database restore drill: verifies that a restored copy of the account
// database (for example a Neon branch created at a point in time) is complete
// and usable, and compares it with the live database.
//
// - Both databases are read in REPEATABLE READ, READ ONLY transactions; the
//   drill never writes to either.
// - For every application table it records the row count and a SHA-256 digest
//   of the rows in PostgreSQL text form (ordered), then checks that the
//   restored copy has every live table and the readiness probe the service
//   uses (`scene_account_membership`) succeeds.
// - Output carries table names, counts, digests and match flags only, never
//   values or credentials. A digest mismatch means the live database changed
//   after the restore point (or the restore is incomplete); the report says
//   which tables differ and does not hide it.
//
// Usage: node scripts/restore-drill.mjs (DATABASE_URL = live,
//        SCENESIGNAL_RESTORE_DRILL_DATABASE_URL = restored copy)
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { clientFor, listTables } from './copy-postgres.mjs';

const quote = name => '"' + String(name).replaceAll('"', '""') + '"';

export async function inventory(client) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const tables = {};
    for (const table of await listTables(client)) {
      const { rows } = await client.query({ text: `SELECT t::text AS row FROM ${quote(table)} t ORDER BY 1`, rowMode: 'array' });
      const hash = createHash('sha256');
      for (const [row] of rows) hash.update(row).update('\n');
      tables[table] = { rows: rows.length, sha256: hash.digest('hex') };
    }
    await client.query('SELECT 1 FROM scene_account_membership LIMIT 0');
    return tables;
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* read-only */ }
  }
}

export function compareInventories(live, restored) {
  const tables = {};
  let missing = 0, differing = 0;
  for (const name of Object.keys(live).sort()) {
    const copy = restored[name];
    if (!copy) { missing++; tables[name] = { live: live[name].rows, restored: null, match: false }; continue; }
    const match = copy.rows === live[name].rows && copy.sha256 === live[name].sha256;
    if (!match) differing++;
    tables[name] = { live: live[name].rows, restored: copy.rows, match };
  }
  const extra = Object.keys(restored).filter(name => !(name in live)).sort();
  const status = missing ? 'restore-incomplete' : differing ? 'restored-differs-from-live' : 'restored-matches-live';
  return { status, usable: missing === 0, missingTables: missing, differingTables: differing, extraTables: extra, tables };
}

export async function runRestoreDrill(liveUrl, restoredUrl, { log = () => {}, now = () => new Date() } = {}) {
  if (!liveUrl || !restoredUrl) throw Error('DRILL_DATABASE_URLS_REQUIRED');
  if (liveUrl === restoredUrl) throw Error('DRILL_RESTORED_DATABASE_MUST_DIFFER');
  const startedAt = now();
  const live = clientFor(liveUrl), restored = clientFor(restoredUrl);
  await live.connect();
  try {
    await restored.connect();
    const [liveTables, restoredTables] = [await inventory(live), await inventory(restored)];
    const report = { event: 'scenesignal-restore-drill', startedAt: startedAt.toISOString(),
      finishedAt: now().toISOString(), ...compareInventories(liveTables, restoredTables) };
    log(report);
    return report;
  } finally { await Promise.allSettled([live.end(), restored.end()]); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const report = await runRestoreDrill(process.env.DATABASE_URL, process.env.SCENESIGNAL_RESTORE_DRILL_DATABASE_URL,
      { log: entry => console.log(JSON.stringify(entry)) });
    if (!report.usable) process.exitCode = 1;
  } catch (error) {
    const code = /^DRILL_[A-Z_]+/.exec(error instanceof Error ? error.message : '')?.[0] ?? 'DRILL_FAILED';
    console.error('SceneSignal restore drill did not complete: ' + code);
    process.exitCode = 1;
  }
}
