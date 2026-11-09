import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyCoreArchive } from '../scripts/check-core.mjs';

test('a cached old lock cannot validate a newly prepared audio archive', () => {
  const pin = JSON.parse(readFileSync('dependency-pin.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const bytes = readFileSync('.deps/audio-core.tgz');
  assert.doesNotThrow(() => verifyCoreArchive(pin, lock, bytes));
  const stale = structuredClone(lock);
  stale.packages['node_modules/' + pin.package].integrity = 'sha512-cached-old-package';
  assert.throws(() => verifyCoreArchive(pin, stale, bytes), /CORE_ARCHIVE_LOCK_MISMATCH/);
  const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1;
  assert.throws(() => verifyCoreArchive(pin, lock, changed), /CORE_ARCHIVE_LOCK_MISMATCH/);
  assert.throws(() => verifyCoreArchive({ ...pin, repository: 'other/engine' }, lock, bytes), /INVALID_CORE_PIN/);
});
