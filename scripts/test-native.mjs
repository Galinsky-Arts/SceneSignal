import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const pin = JSON.parse(await readFile('dependency-pin.json', 'utf8'));
const core = resolve('.build/audio-core');
if (execFileSync('git', ['-C', core, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== pin.commit)
  throw Error('NATIVE_TEST_CORE_PIN_MISMATCH');
const temporary = await mkdtemp(join(tmpdir(), 'scenesignal-native-'));
try {
  const addon = join(temporary, 'pcm.node');
  const include = process.env.NODE_INCLUDE_DIR ?? join(dirname(dirname(process.execPath)), 'include/node');
  const compiled = spawnSync(process.env.CC ?? 'cc', ['-std=c11', '-Wall', '-Wextra', '-Werror',
    '-fPIC', '-shared', '-pthread', '-fsanitize=undefined', '-fno-sanitize-recover=all',
    '-fno-omit-frame-pointer', '-I' + include, '-I' + join(core, 'native/core/include'),
    join(core, 'native/integration/pcm_addon.c'), join(core, 'native/core/dae_pcm.c'), '-lm', '-o', addon], { stdio: 'inherit' });
  if (compiled.error || compiled.status !== 0) throw Error('NATIVE_TEST_COMPILE_FAILED');
  const tested = spawnSync(process.execPath, ['--test', 'tests/native-playback.integration.mjs'], {
    stdio: 'inherit', env: { ...process.env, DAE_TEST_ADDON: addon }
  });
  if (tested.error || tested.status !== 0) process.exitCode = 1;
} finally { await rm(temporary, { recursive: true, force: true }); }
