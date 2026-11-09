import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifyCoreArchive(pin, lock, bytes) {
  if (pin.repository !== 'Galinsky-Arts/Distributed-Audio-Engine' ||
      pin.package !== '@neophilism/distributed-audio-engine' || !/^[0-9a-f]{40}$/.test(pin.commit))
    throw Error('INVALID_CORE_PIN');
  const entry = lock.packages?.['node_modules/' + pin.package];
  if (entry?.resolved !== 'file:.deps/audio-core.tgz' ||
      entry.integrity !== 'sha512-' + createHash('sha512').update(bytes).digest('base64'))
    throw Error('CORE_ARCHIVE_LOCK_MISMATCH: regenerate the lockfile from the prepared archive, then run npm ci');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pin = JSON.parse(readFileSync('dependency-pin.json', 'utf8'));
  verifyCoreArchive(pin, JSON.parse(readFileSync('package-lock.json', 'utf8')), readFileSync('.deps/audio-core.tgz'));
  const head = execFileSync('git', ['-C', '.build/audio-core', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== pin.commit) throw Error('CORE_PREPARED_SOURCE_MISMATCH');
  console.log('Pinned audio source and archive/lock integrity match: ' + head);
}
