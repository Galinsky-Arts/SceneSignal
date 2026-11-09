import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeWave, decryptAttachment, renderSpatialChunk } from '@neophilism/distributed-audio-engine';
import { prepareSceneOutput, SpatialWorkspace } from '../src/index.js';
import type { SceneOutputPreparation } from '../src/index.js';
import { fixture, organizer, contributor } from './helpers/native-playback.js';

async function setup(t: { after: (callback: () => void) => void }, active = true) {
  const f = await fixture('android', active); t.after(() => f.endpoint.close());
  const input: SceneOutputPreparation = { actor: structuredClone(organizer), session: f.session, workspace: f.workspace,
    speakerId: 'speaker', programId: 'scene-program', assetId: 'speaker-mix', parentMessageId: 'speaker-private-message',
    epochUnixMs: 2000, rightsValidUntilMs: 7000, stems: { stem: new Float32Array(8000).fill(0.5) }, nowMs: () => 2000 };
  return { f, input };
}
test('spatial output encrypts the actual normalized mix and bounds private playback permission', async t => {
  const { input } = await setup(t);
  const result = await prepareSceneOutput(input);
  const bytes = await decryptAttachment(result.asset.manifest, result.ciphertextChunks, result.asset.context);
  try {
    const decoded = decodeWave(bytes);
    try {
      assert.equal(decoded.samples.length, 8000);
      assert.ok(decoded.samples.every(sample => Math.abs(sample - 0.15) < 0.00004));
      assert.equal(result.asset.authorizationValidUntilMs, 7000);
      assert.equal(result.program.clips[0]!.assetId, result.asset.assetId);
      assert.equal(result.outputId, 'physical-output');
      assert.equal(result.fieldValidated, false);
      assert.ok(!JSON.stringify(result.program).includes('attachmentKeyHex'));
    } finally { decoded.samples.fill(0); }
  } finally { bytes.fill(0); }
});
test('output preparation retains the full topology normalization rather than raising a selected speaker', async t => {
  const { f, input } = await setup(t);
  f.workspace.joinSpeaker({ ...contributor, identityId: 'second' }, { ...f.workspace.snapshot().speakers[0]!,
    id: 'second-speaker', ownerId: 'second', outputId: 'second-output', position: { x: 10, y: 0, z: 0 } }, 2000);
  const rendered = renderSpatialChunk(f.workspace.mixPlan(2000, 'authorized-session').plan, input.stems);
  const expected = rendered['second-speaker']!;
  assert.ok(expected[0]! < 0.01);
  const result = await prepareSceneOutput({ ...input, speakerId: 'second-speaker' });
  const bytes = await decryptAttachment(result.asset.manifest, result.ciphertextChunks, result.asset.context);
  try {
    const decoded = decodeWave(bytes);
    try { assert.ok(Math.abs(decoded.samples[0]! - expected[0]!) < 0.00004); }
    finally { decoded.samples.fill(0); }
  } finally { bytes.fill(0); for (const samples of Object.values(rendered)) samples.fill(0); }
});
test('a caller cannot change samples or identity after preparation yields to encryption', async t => {
  const { input } = await setup(t);
  const work = prepareSceneOutput(input);
  input.stems.stem!.fill(-1); input.actor.expiresAtMs = 0; input.actor.roles = [];
  const result = await work;
  const bytes = await decryptAttachment(result.asset.manifest, result.ciphertextChunks, result.asset.context);
  try {
    const decoded = decodeWave(bytes);
    try { assert.ok(decoded.samples[0]! > 0); } finally { decoded.samples.fill(0); }
  } finally { bytes.fill(0); }
});
test('inactive sessions, unauthorized roles, stale identity and cross-session workspaces cannot prepare output', async t => {
  const { input } = await setup(t);
  for (const actor of [contributor, { ...organizer, tenantId: 'foreign' }, { ...organizer, expiresAtMs: 2000 }])
    await assert.rejects(prepareSceneOutput({ ...input, actor }));
  const inactive = await setup(t, false);
  await assert.rejects(prepareSceneOutput(inactive.input), /SESSION_NOT_ACTIVE/);
  await assert.rejects(prepareSceneOutput({ ...input, workspace: inactive.f.workspace }), /WORKSPACE_SESSION_MISMATCH/);
});
test('missing, extra, non-finite and unaligned source PCM fail before producing a private descriptor', async t => {
  const { input } = await setup(t);
  for (const stems of [{}, { stem: new Float32Array(7999) }, { stem: new Float32Array(8000), extra: new Float32Array(8000) },
    { stem: new Float32Array(8000).fill(NaN) }]) await assert.rejects(prepareSceneOutput({ ...input, stems }));
});
test('expired rights, absent consent, invalid epoch and oversized programs fail closed', async t => {
  const { f, input } = await setup(t);
  await assert.rejects(prepareSceneOutput({ ...input, rightsValidUntilMs: 2000 }));
  await assert.rejects(prepareSceneOutput({ ...input, epochUnixMs: 7000 }));
  const workspace = new SpatialWorkspace(f.session, { ...f.workspace.snapshot().scene, frames: 1048577 }, () => true);
  workspace.joinSpeaker(contributor, f.workspace.snapshot().speakers[0]!, 1000);
  await assert.rejects(prepareSceneOutput({ ...input, workspace }));
  f.workspace.leaveSpeaker(contributor, 'speaker', 2000);
  await assert.rejects(prepareSceneOutput(input), /CONSENT_REQUIRED/);
});
test('cancellation during encryption cannot return a key-bearing output', async t => {
  const { input } = await setup(t), controller = new AbortController();
  const work = prepareSceneOutput({ ...input, signal: controller.signal }); controller.abort();
  await assert.rejects(work, /SCENE_PROGRAM_ABORTED/);
});
test('site stop, scene edits and consent withdrawal during encryption supersede the output', async t => {
  for (const action of ['stop', 'compose', 'leave']) {
    const { f, input } = await setup(t), work = prepareSceneOutput(input);
    if (action === 'stop') f.session.stop(organizer, 2001);
    if (action === 'compose') f.workspace.compose(organizer, { ...f.workspace.snapshot().scene, revision: 2 }, 2001);
    if (action === 'leave') f.workspace.leaveSpeaker(contributor, 'speaker', 2001);
    await assert.rejects(work);
  }
});
test('source rights are rechecked after encryption and cannot be replaced with a derived-asset claim', async t => {
  const { f, input } = await setup(t); let allowed = true;
  const workspace = new SpatialWorkspace(f.session, f.workspace.snapshot().scene, () => allowed);
  workspace.joinSpeaker(contributor, f.workspace.snapshot().speakers[0]!, 1000);
  const work = prepareSceneOutput({ ...input, workspace }); allowed = false;
  await assert.rejects(work, /SPATIAL_SOURCE_RIGHTS_DENIED/);
});
test('consent and actor expiry during encryption cannot escape the deadline guard', async t => {
  const { input } = await setup(t); let now = 2000;
  const work = prepareSceneOutput({ ...input, nowMs: () => now }); now = 9000;
  await assert.rejects(work);
});
