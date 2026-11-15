import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { createAccountService } from '../dist/server/accounts.js';

test('account service rejects credential-bearing, non-HTTPS remote and malformed base URLs', async () => {
  const pool = new pg.Pool();
  try {
    for (const baseURL of ['http://remote.example', 'https://user:password@account.example', 'https://account.example/private', 'not-a-url'])
      assert.throws(() => createAccountService({ pool, baseURL, secret: 'fixture-secret-not-for-production-2026' }), /ACCOUNT_SERVICE_HTTPS_REQUIRED/);
  } finally { await pool.end(); }
});
test('startup rejects unsafe database transport and does not print credential-bearing configuration', () => {
  const marker = 'private-config-marker-not-for-production';
  for (const database of [marker, 'postgres://user:' + marker + '@database.invalid/account?ssl=false']) {
    const result = spawnSync(process.execPath, ['dist/server/main.js', '--migrate'], { encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: database, BETTER_AUTH_URL: 'https://account.example', BETTER_AUTH_SECRET: marker } });
    assert.equal(result.status, 1);
    assert.ok(!(result.stdout + result.stderr).includes(marker));
    assert.match(result.stderr, /account startup failed/);
  }
  for (const database of [marker, 'postgres://user:' + marker + '@database.invalid/account?ssl=false']) {
    const result = spawnSync(process.execPath, ['scripts/render-start.mjs'], { encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: database, POSTGRES_EXTERNAL_HOST: 'dpg-example-a.virginia-postgres.render.com',
        RENDER_EXTERNAL_URL: 'https://scenesignal.example' } });
    assert.equal(result.status, 1);
    assert.ok(!(result.stdout + result.stderr).includes(marker));
    assert.match(result.stderr, /Render configuration is invalid/);
  }
});
test('external-provider mode refuses private, loopback or Render-internal hosts and non-HTTPS service URLs', () => {
  const marker = 'private-config-marker-not-for-production';
  const cases = [
    ['postgres://user:' + marker + '@dpg-internal-a/account', 'https://scenesignal.example'],
    ['postgres://user:' + marker + '@127.0.0.1/account', 'https://scenesignal.example'],
    ['postgres://user:' + marker + '@db.service.internal/account', 'https://scenesignal.example'],
    ['postgres://user:' + marker + '@ep-example.us-east-2.aws.neon.tech/account?sslmode=require', 'http://scenesignal.example'],
    ['postgres://user:' + marker + '@ep-example.us-east-2.aws.neon.tech/account?sslmode=require', '']
  ];
  for (const [database, external] of cases) {
    const env = { ...process.env, DATABASE_URL: database, RENDER_EXTERNAL_URL: external };
    delete env.POSTGRES_EXTERNAL_HOST;
    const result = spawnSync(process.execPath, ['scripts/render-start.mjs'], { encoding: 'utf8', env });
    assert.equal(result.status, 1, database);
    assert.ok(!(result.stdout + result.stderr).includes(marker));
    assert.match(result.stderr, /Render configuration is invalid/);
  }
});
