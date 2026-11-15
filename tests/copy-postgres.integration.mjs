import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { copyDatabase, copyFromUrls, listTables } from '../scripts/copy-postgres.mjs';

const connectionString = process.env.SCENESIGNAL_TEST_DATABASE_URL;
assert.ok(connectionString, 'SCENESIGNAL_TEST_DATABASE_URL is required');
const suffix = process.pid + '_' + Date.now();
const databaseUrl = name => { const url = new URL(connectionString); url.pathname = '/' + name; return url.href; };

async function admin(statement) {
  const client = new pg.Client({ connectionString }); await client.connect();
  try { await client.query(statement); } finally { await client.end(); }
}
function migrate(url) {
  // The application's own migration creates the target schema; the copy tool never does.
  const result = spawnSync(process.execPath, ['dist/server/main.js', '--migrate'], { encoding: 'utf8', env: { ...process.env,
    DATABASE_URL: url, BETTER_AUTH_URL: 'http://localhost:3000/', BETTER_AUTH_SECRET: 'test-only-secret-with-enough-length-0123456789' } });
  assert.equal(result.status, 0, result.stderr);
}
async function dump(url) {
  const client = new pg.Client({ connectionString: url }); await client.connect();
  try {
    const out = {};
    for (const table of await listTables(client)) {
      const { rows } = await client.query(`SELECT to_jsonb(t)::text AS row FROM "${table}" t ORDER BY 1`);
      out[table] = rows.map(row => row.row);
    }
    return out;
  } finally { await client.end(); }
}

test('copies every account and contribution row exactly into a freshly migrated database, once', async t => {
  const source = 'copy_src_' + suffix, target = 'copy_dst_' + suffix;
  await admin(`CREATE DATABASE ${source}`); await admin(`CREATE DATABASE ${target}`);
  t.after(async () => { await admin(`DROP DATABASE IF EXISTS ${source}`); await admin(`DROP DATABASE IF EXISTS ${target}`); });
  migrate(databaseUrl(source)); migrate(databaseUrl(target));
  const seed = new pg.Client({ connectionString: databaseUrl(source) }); await seed.connect();
  try {
    await seed.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      VALUES ('u1', 'Ada "Q"', 'ada@example.test', true, '2026-11-01 10:00:00.123456+00', now()),
             ('u2', 'Bob', 'bob@example.test', false, now(), now())`);
    await seed.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      VALUES ('a1', 'u1', 'credential', 'u1', 'hash-not-a-password', now(), now())`);
    await seed.query(`INSERT INTO scene_contribution_events (tenant_id, session_id, event_id, speaker_id, contributor_id, seconds, verified_at_ms)
      VALUES ('t', 's', 'e1', 'spime-1', 'u1', 30, 9007199254740993)`);
  } finally { await seed.end(); }
  const before = await dump(databaseUrl(source));
  const logs = [];
  const result = await copyFromUrls(databaseUrl(source), databaseUrl(target), entry => logs.push(entry));
  assert.equal(result.status, 'copied');
  assert.equal(result.tables.user, 2); assert.equal(result.tables.account, 1); assert.equal(result.tables.scene_contribution_events, 1);
  assert.deepEqual(await dump(databaseUrl(target)), before, 'byte-exact row text including microseconds and bigint');
  assert.doesNotMatch(JSON.stringify(logs), /ada@|hash-not|password|postgres:\/\//, 'logs carry names and counts only');
  // A restart with the copy variable still set must not duplicate or overwrite.
  const again = await copyFromUrls(databaseUrl(source), databaseUrl(target));
  assert.equal(again.status, 'skipped');
  assert.deepEqual(await dump(databaseUrl(target)), before);
});

test('missing target schema or a failed batch commits nothing', async t => {
  const source = 'copy_src2_' + suffix, target = 'copy_dst2_' + suffix;
  await admin(`CREATE DATABASE ${source}`); await admin(`CREATE DATABASE ${target}`);
  t.after(async () => { await admin(`DROP DATABASE IF EXISTS ${source}`); await admin(`DROP DATABASE IF EXISTS ${target}`); });
  migrate(databaseUrl(source));
  await assert.rejects(copyFromUrls(databaseUrl(source), databaseUrl(target)), /COPY_TARGET_SCHEMA_MISSING_TABLES/);
  migrate(databaseUrl(target));
  const seed = new pg.Client({ connectionString: databaseUrl(source) }); await seed.connect();
  await seed.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('u1', 'A', 'a@example.test', true, now(), now())`);
  await seed.query(`INSERT INTO scene_contribution_events (tenant_id, session_id, event_id, speaker_id, contributor_id, seconds, verified_at_ms) VALUES ('t','s','e','p','u1',10,1)`);
  await seed.end();
  const blocker = new pg.Client({ connectionString: databaseUrl(target) }); await blocker.connect();
  await blocker.query(`ALTER TABLE scene_contribution_events ADD CONSTRAINT copy_test_block CHECK (seconds > 100) NOT VALID`);
  const source2 = new pg.Client({ connectionString: databaseUrl(source) }); await source2.connect();
  try {
    await assert.rejects(copyDatabase({ source: source2, target: blocker }));
    const { rows } = await blocker.query(`SELECT count(*)::int AS n FROM "user"`);
    assert.equal(rows[0].n, 0, 'earlier tables rolled back');
  } finally { await source2.end(); await blocker.end(); }
});
