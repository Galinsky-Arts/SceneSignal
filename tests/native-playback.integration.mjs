import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, contributor, organizer, output } from '../dist/tests/helpers/native-playback.js';

assert.ok(process.env.DAE_TEST_ADDON, 'Run npm run test:native; native integration must not silently skip');
const native = createRequire(import.meta.url)(process.env.DAE_TEST_ADDON);
const ok = value => assert.equal(value, 0);
// Real Node-API/C handoff to the pinned production kernel. This is not a physical
// AudioTrack/AVAudioEngine route or an assertion of acoustic synchronization.
class KernelBridge {
  handle = native.create(8000, 1);
  next = 0n;
  voices = new Map();
  constructor(clock) { this.now = () => clock() + 10000; }
  subscribe(listener) {
    this.listener = listener;
    ok(native.activate(this.handle, 1n, this.now()));
    listener({ type: 'route-active', route: output, sampleRate: 8000, maxChannels: 1 });
    return () => { this.listener = undefined; };
  }
  enqueue(request) {
    const token = ++this.next;
    ok(native.enqueue(this.handle, token, BigInt(request.routeGeneration), request.samples, this.now(),
      request.startAtMonotonicMs ?? request.startAtHostTimeMs,
      request.fadeStartMonotonicMs ?? request.fadeStartHostTimeMs,
      request.stopAtMonotonicMs ?? request.stopAtHostTimeMs, request.gainCeiling));
    this.voices.set(request.id, token);
  }
  updateEnvelope(id, gain, fade, stop) { const token = this.voices.get(id); if (token) ok(native.update(this.handle, 1n, token, gain, fade, stop)); }
  cancel(id) { const token = this.voices.get(id); if (token) ok(native.cancel(this.handle, 1n, token)); this.voices.delete(id); }
  cancelAll() { ok(native.cancelAll(this.handle)); this.voices.clear(); }
  render(time) { return native.render(this.handle, 1n, time, 80).samples; }
  close() { native.close(this.handle); }
}
const silent = samples => assert.ok(samples.every(value => value === 0), 'native output must be silent');
for (const platform of ['android', 'ios']) {
  test(`${platform}: signed emergency control clears the production C queue`, async t => {
    let bridge;
    const f = await fixture(platform, true, clock => (bridge = new KernelBridge(clock)));
    t.after(() => { try { f.endpoint.close(); } finally { bridge.close(); } });
    await f.endpoint.join(contributor, await f.control()); await f.endpoint.pump(contributor);
    assert.ok(bridge.render(12050).some(value => value > 0));
    await f.endpoint.emergencyStop(await f.control(2, 'emergency-stop'));
    silent(bridge.render(12060));
  });
  test(`${platform}: actual encrypted program reaches C and contributor departure clears native output`, async t => {
    let bridge;
    const f = await fixture(platform, true, clock => (bridge = new KernelBridge(clock)));
    t.after(() => { try { f.endpoint.close(); } finally { bridge.close(); } });
    await f.endpoint.join(contributor, await f.control()); await f.endpoint.pump(contributor);
    assert.ok(bridge.render(12050).some(value => value > 0));
    f.workspace.leaveSpeaker(contributor, 'speaker', 2001);
    silent(bridge.render(12060));
  });
  test(`${platform}: native signed deadline stops audio without another JavaScript tick`, async t => {
    let bridge;
    const f = await fixture(platform, true, clock => (bridge = new KernelBridge(clock)));
    t.after(() => { try { f.endpoint.close(); } finally { bridge.close(); } });
    f.policy.expiresAtMs = 2600; f.policy.stopAtMs = 2600;
    await f.endpoint.join(contributor, await f.control()); await f.endpoint.pump(contributor);
    assert.ok(bridge.render(12590).some(value => value > 0));
    silent(bridge.render(12600));
  });
  test(`${platform}: site cancellation silences C even if another output callback throws`, async t => {
    let bridge;
    const f = await fixture(platform, true, clock => (bridge = new KernelBridge(clock)));
    t.after(() => { try { f.endpoint.close(); } finally { bridge.close(); } });
    await f.endpoint.join(contributor, await f.control()); await f.endpoint.pump(contributor);
    assert.ok(bridge.render(12050).some(value => value > 0));
    f.failStop(); assert.throws(() => f.session.cancel(organizer, 2001), /external-stop-failed/);
    silent(bridge.render(12060));
  });
}
