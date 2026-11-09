import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, organizer, contributor, site, output, gate } from './helpers/native-playback.js';

for (const platform of ['android', 'ios'] as const) {
  test(`${platform}: a signed emergency control revokes the native lifecycle`, async () => {
    const f = await fixture(platform); await f.endpoint.join(contributor, await f.control());
    await f.endpoint.pump(contributor); const stops = f.stops;
    await f.endpoint.emergencyStop(await f.control(2, 'emergency-stop'));
    assert.equal(f.endpoint.snapshot().phase, 'stopped'); assert.ok(f.stops > stops);
    await assert.rejects(f.endpoint.pump(contributor), /NOT_PLAYING/); f.endpoint.close();
  });
  test(`${platform}: site authorization and signed lease gate actual encrypted media scheduling`, async () => {
    const f = await fixture(platform, false);
    await assert.rejects(f.endpoint.join(contributor, await f.control()), /SESSION_NOT_ACTIVE/);
    assert.equal(f.reads, 0);
    f.session.activate(organizer, 2000);
    await f.endpoint.join(contributor, await f.control());
    assert.equal((await f.endpoint.pump(contributor)).status, 'scheduled');
    assert.equal(f.copied.length, 1);
    assert.equal(f.copied[0]!.samples[0], 0.5);
    assert.equal(f.copied[0]!.gainCeiling, 0.25);
    assert.equal(f.endpoint.snapshot().fieldValidated, false);
    f.endpoint.close();
  });
  test(`${platform}: wrong owner, scope and expired identity cannot start output`, async () => {
    for (const actor of [{ ...contributor, identityId: 'other' }, { ...contributor, tenantId: 'foreign' }, { ...contributor, expiresAtMs: 2000 }]) {
      const f = await fixture(platform);
      await assert.rejects(f.endpoint.join(actor, await f.control()));
      assert.equal(f.reads, 0); assert.equal(f.copied.length, 0); f.endpoint.close();
    }
  });
  test(`${platform}: leases cannot exceed site gain, consent or identity lifetime`, async () => {
    const gain = await fixture(platform); gain.policy.maxLinearGain = 0.4;
    await assert.rejects(gain.endpoint.join(contributor, await gain.control())); gain.endpoint.close();
    const consent = await fixture(platform); consent.policy.expiresAtMs = 9001;
    await assert.rejects(consent.endpoint.join(contributor, await consent.control())); consent.endpoint.close();
    const identity = await fixture(platform);
    await assert.rejects(identity.endpoint.join({ ...contributor, expiresAtMs: 7000 }, await identity.control())); identity.endpoint.close();
  });
  test(`${platform}: a route with the wrong physical output cannot receive media`, async () => {
    const f = await fixture(platform); f.route({ ...output, outputId: 'different', generation: 2 });
    await assert.rejects(f.endpoint.join(contributor, await f.control()), /OUTPUT_BINDING_DENIED/);
    assert.equal(f.reads, 0); assert.equal(f.copied.length, 0); f.endpoint.close();
  });
  test(`${platform}: site cancellation fences delayed private lease decoding`, async () => {
    const f = await fixture(platform), entered = gate(), blocked = gate();
    f.blockDecode(async () => { entered.release(); await blocked.promise; });
    const joining = f.endpoint.join(contributor, await f.control());
    await entered.promise; f.session.cancel(organizer, 2001); blocked.release();
    await assert.rejects(joining, /ACTOR_REQUIRED|SUPERSEDED/);
    assert.equal(f.endpoint.snapshot().phase, 'stopped'); assert.equal(f.copied.length, 0); f.endpoint.close();
  });
  test(`${platform}: a failing external stop cannot prevent native revocation during media fetch`, async () => {
    const f = await fixture(platform), entered = gate(), blocked = gate();
    await f.endpoint.join(contributor, await f.control());
    f.blockRead(async () => { entered.release(); await blocked.promise; });
    const pumping = f.endpoint.pump(contributor);
    await entered.promise; f.failStop();
    assert.throws(() => f.session.cancel(organizer, 2001), /external-stop-failed/);
    assert.equal(f.endpoint.snapshot().phase, 'stopped'); blocked.release();
    await assert.rejects(pumping);
    assert.equal(f.copied.length, 0); f.endpoint.close();
  });
  test(`${platform}: contributor departure revokes queued native output immediately`, async () => {
    const f = await fixture(platform); await f.endpoint.join(contributor, await f.control());
    await f.endpoint.pump(contributor); const stops = f.stops;
    f.workspace.leaveSpeaker(contributor, 'speaker', 2001);
    assert.equal(f.endpoint.snapshot().phase, 'stopped'); assert.ok(f.stops > stops);
    await assert.rejects(f.endpoint.join(contributor, await f.control(2)), /CONSENT_DENIED/); f.endpoint.close();
  });
  test(`${platform}: site revisions require a newly bound endpoint lifecycle`, async () => {
    const f = await fixture(platform); await f.endpoint.join(contributor, await f.control());
    f.session.revise(organizer, { ...site, revision: 2 }, 2001);
    assert.equal(f.endpoint.snapshot().phase, 'stopped');
    await assert.rejects(f.endpoint.join(contributor, await f.control(2)), /SITE_REVISION_CHANGED/); f.endpoint.close();
  });
}
