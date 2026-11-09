import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { PostgresSessionContributionStore, SessionContributionLedger } from '../dist/src/index.js';

const connectionString = process.env.SCENESIGNAL_TEST_DATABASE_URL;
assert.ok(connectionString, 'SCENESIGNAL_TEST_DATABASE_URL is required; integration checks must not silently skip');
const target = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
  target.pathname === '/scenesignal_test', 'Use a dedicated local scenesignal_test database');

test('real PostgreSQL contribution transactions', async t => {
  const admin = new pg.Pool({ connectionString });
  const schema = 'scene_test_' + randomUUID().replaceAll('-', '');
  const pools = [];
  const pool = () => {
    const value = new pg.Pool({ connectionString, max: 12, options: '-c search_path=' + schema });
    pools.push(value);
    return value;
  };
  const scope = id => ({ tenantId: 'tenant', sessionId: id, application: 'scenesignal' });
  const claim = (s, eventId = 'event') => ({ tenantId: s.tenantId, sessionId: s.sessionId,
    eventId, speakerId: 'speaker', contributorId: 'contributor', seconds: 30, verifiedAtMs: 1000 });
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    const first = pool();
    const migration = await readFile(new URL('../db/migrations/0001_scene_contributions.sql', import.meta.url), 'utf8');
    await first.query(migration);
    await first.query(migration);
    await t.test('concurrent duplicate receipts credit once across independent instances and reopening', async () => {
      const s = scope('duplicates'), fact = claim(s);
      const stores = [new PostgresSessionContributionStore(first), new PostgresSessionContributionStore(pool())];
      const ledgers = stores.map(store => new SessionContributionLedger(s, async () => fact, 60, store));
      const results = await Promise.all(Array.from({ length: 24 }, (_, i) => ledgers[i % 2].admit('private-receipt', 1100)));
      assert.equal(results.filter(result => !result.duplicate).length, 1);
      assert.ok(results.every(result => result.creditedSeconds === 30));
      const reopened = new PostgresSessionContributionStore(pool());
      assert.deepEqual(await reopened.summary(s), [{ contributorId: 'contributor', creditedSeconds: 30 }]);
      const rows = await first.query('SELECT * FROM scene_contribution_events WHERE session_id=$1', [s.sessionId]);
      assert.equal(rows.rowCount, 1);
      assert.ok(!JSON.stringify(rows.rows).includes('private-receipt'));
    });
    await t.test('concurrent new events enforce cumulative credit and scope record caps', async () => {
      const store = new PostgresSessionContributionStore(first), s = scope('credit-cap');
      const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => store.admit(s, claim(s, 'event-' + i), 60, 100)));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
      for (const result of results.filter(result => result.status === 'rejected'))
        assert.match(result.reason.message, /CONTRIBUTION_CREDIT_LIMIT/);
      assert.deepEqual(await store.summary(s), [{ contributorId: 'contributor', creditedSeconds: 60 }]);
      const limited = scope('record-cap');
      const capped = await Promise.allSettled(Array.from({ length: 8 }, (_, i) =>
        store.admit(limited, { ...claim(limited, 'event-' + i), contributorId: 'contributor-' + i }, 60, 1)));
      assert.equal(capped.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal((await store.summary(limited)).length, 1);
    });
    await t.test('conflicting replay and actual SQL constraint failure roll back without poisoning the pool', async () => {
      const store = new PostgresSessionContributionStore(first), s = scope('rollback');
      await assert.rejects(store.admit(s, { ...claim(s), seconds: 301 }, 1000, 100), error => error.code === '23514');
      assert.deepEqual(await store.summary(s), []);
      await store.admit(s, claim(s), 1000, 100);
      await assert.rejects(store.admit(s, { ...claim(s), seconds: 31 }, 1000, 100), /CONTRIBUTION_REPLAY_CONFLICT/);
      assert.deepEqual(await store.summary(s), [{ contributorId: 'contributor', creditedSeconds: 30 }]);
      await store.admit(s, claim(s, 'next-event'), 1000, 100);
      assert.deepEqual(await store.summary(s), [{ contributorId: 'contributor', creditedSeconds: 60 }]);
    });
    await t.test('same event identity stays isolated by tenant and session', async () => {
      const store = new PostgresSessionContributionStore(first);
      const scopes = [scope('isolated'), { ...scope('isolated'), tenantId: 'other-tenant' }, scope('other-session')];
      await Promise.all(scopes.map(s => store.admit(s, claim(s), 60, 1)));
      for (const s of scopes)
        assert.deepEqual(await store.summary(s), [{ contributorId: 'contributor', creditedSeconds: 30 }]);
    });
  } finally {
    await Promise.all(pools.map(value => value.end()));
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    await admin.end();
  }
});
