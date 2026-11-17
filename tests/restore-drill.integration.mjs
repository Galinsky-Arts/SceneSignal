import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { runRestoreDrill, compareInventories } from '../scripts/restore-drill.mjs';
import { copyFromUrls } from '../scripts/copy-postgres.mjs';

const connectionString = process.env.SCENESIGNAL_TEST_DATABASE_URL;
assert.ok(connectionString, 'SCENESIGNAL_TEST_DATABASE_URL is required');
const suffix = process.pid + '_' + Date.now();
const databaseUrl = name => { const url = new URL(connectionString); url.pathname = '/' + name; return url.href; };
async function sql(url, statement, values) {
  const client = new pg.Client({ connectionString: url }); await client.connect();
  try { return await client.query(statement, values); } finally { await client.end(); }
}
function migrate(url) {
  const result = spawnSync(process.execPath, ['dist/server/main.js', '--migrate'], { encoding: 'utf8', env: { ...process.env,
    DATABASE_URL: url, BETTER_AUTH_URL: 'http://localhost:3000/', BETTER_AUTH_SECRET: 'test-only-secret-with-enough-length-0123456789' } });
  assert.equal(result.status, 0, result.stderr);
}

test('restore drill verifies a restored copy read-only and reports drift by table', async t => {
  const live = 'drill_live_' + suffix, restored = 'drill_restored_' + suffix, empty = 'drill_empty_' + suffix;
  for (const name of [live, restored, empty]) await sql(connectionString, `CREATE DATABASE ${name}`);
  t.after(async () => { for (const name of [live, restored, empty]) await sql(connectionString, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`); });
  migrate(databaseUrl(live));
  await sql(databaseUrl(live), `INSERT INTO "user"(id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES ('u1', 'Ann', 'ann@example.com', false, now(), now())`);
  // The "restore": an exact copy made by the verified copy tool.
  migrate(databaseUrl(restored));
  await copyFromUrls(databaseUrl(live), databaseUrl(restored), () => {});
  const logs = [];
  const match = await runRestoreDrill(databaseUrl(live), databaseUrl(restored), { log: entry => logs.push(JSON.stringify(entry)) });
  assert.equal(match.status, 'restored-matches-live');
  assert.equal(match.usable, true);
  assert.equal(match.tables.user.live, 1);
  assert.equal(match.tables.user.match, true);
  assert.doesNotMatch(logs.join('\n'), /ann@example\.com|Ann|postgres:\/\//);

  // A change after the restore point is reported, not hidden.
  await sql(databaseUrl(live), `UPDATE "user" SET name='Annie' WHERE id='u1'`);
  const drift = await runRestoreDrill(databaseUrl(live), databaseUrl(restored));
  assert.equal(drift.status, 'restored-differs-from-live');
  assert.equal(drift.tables.user.match, false);
  assert.equal(drift.usable, true);

  // A database without the application schema is not a usable restore.
  await assert.rejects(runRestoreDrill(databaseUrl(live), databaseUrl(empty)), /scene_account_membership/);
  await assert.rejects(runRestoreDrill(databaseUrl(live), databaseUrl(live)), /DRILL_RESTORED_DATABASE_MUST_DIFFER/);
  assert.equal(compareInventories({ a: { rows: 1, sha256: 'x' } }, {}).status, 'restore-incomplete');
  // Read-only: the drill wrote nothing.
  assert.equal((await sql(databaseUrl(restored), `SELECT name FROM "user"`)).rows[0].name, 'Ann');
});
