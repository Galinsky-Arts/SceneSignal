import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, rename, rm, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
const run = promisify(execFile), pin = JSON.parse(await readFile('dependency-pin.json', 'utf8'));
if (pin.repository !== 'Galinsky-Arts/Distributed-Audio-Engine' || !/^[0-9a-f]{40}$/.test(pin.commit)) throw new Error('INVALID_CORE_PIN');
const source = resolve('.build/audio-core'); await mkdir(source, { recursive: true }); await mkdir('.deps', { recursive: true });
await run('git', ['init', source]);
await run('git', ['-C', source, 'fetch', '--depth=1', 'https://github.com/' + pin.repository + '.git', pin.commit]);
await run('git', ['-C', source, 'checkout', '--detach', 'FETCH_HEAD']);
const { stdout: revision } = await run('git', ['-C', source, 'rev-parse', 'HEAD']); if (revision.trim() !== pin.commit) throw new Error('CORE_PIN_MISMATCH');
// A new source pin must not retain compiled modules removed by that revision.
await rm(resolve(source, 'dist'), { recursive: true, force: true });
await run('npm', ['ci', '--ignore-scripts'], { cwd: source }); await run('npm', ['run', 'build'], { cwd: source });
// npm preserves file modes in its archive. Normalize the public package files
// so a restrictive local umask and a hosted runner produce identical bytes.
const { stdout: listing } = await run('npm', ['pack', '--ignore-scripts', '--dry-run', '--json'], { cwd: source });
for (const file of JSON.parse(listing)[0].files)
  await chmod(resolve(source, file.path), file.mode & 0o111 ? 0o755 : 0o644);
const { stdout } = await run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', resolve('.deps')], { cwd: source });
const [packed] = JSON.parse(stdout); await rename(resolve('.deps', packed.filename), resolve('.deps/audio-core.tgz'));
console.log('Prepared pinned audio core ' + pin.commit);
