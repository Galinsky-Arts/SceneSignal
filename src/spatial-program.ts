import { canonicalJson, compileProgram, identifier, integer, invariant, packageRendition, renderSpatialChunk } from '@neophilism/distributed-audio-engine';
import type { AudioProgram, EndpointMediaAsset } from '@neophilism/distributed-audio-engine';
import { requireSceneRole } from './session.js';
import type { SceneActor, SceneSession } from './session.js';
import type { SpatialWorkspace } from './spatial-workspace.js';

export interface SceneOutputPreparation {
  actor: SceneActor;
  session: SceneSession;
  workspace: SpatialWorkspace;
  speakerId: string;
  programId: string;
  assetId: string;
  parentMessageId: string;
  epochUnixMs: number;
  /** Actual source-rights adapter supplies the earliest permission deadline. */
  rightsValidUntilMs: number;
  stems: Readonly<Record<string, Float32Array>>;
  nowMs: () => number;
  signal?: AbortSignal;
}
/** Private endpoint artifact. The descriptor/key and program must travel through
 * the authenticated E2EE parent; only ciphertext chunks may reach a relay. */
export interface PreparedSceneOutput {
  speakerId: string;
  outputId: string;
  siteRevision: number;
  sceneRevision: number;
  epochUnixMs: number;
  program: AudioProgram;
  asset: EndpointMediaAsset;
  ciphertextChunks: Uint8Array[];
  fieldValidated: false;
}

/** Bounded offline preparation, one physical output at a time. No network,
 * output lease, root/key establishment, playback or field qualification. */
export async function prepareSceneOutput(input: SceneOutputPreparation): Promise<PreparedSceneOutput> {
  const { session, workspace, signal, nowMs, stems } = input;
  const actor = structuredClone(input.actor);
  const { speakerId, programId, assetId, parentMessageId, epochUnixMs, rightsValidUntilMs } = input;
  invariant(workspace.belongsTo(session), 'PROGRAM_WORKSPACE_SESSION_MISMATCH');
  for (const id of [speakerId, programId, assetId, parentMessageId]) identifier(id);
  const original = session.snapshot(), scene = workspace.snapshot().scene;
  const workspaceIdentity = canonicalJson(workspace.snapshot());
  let lastNow = 0;
  const guard = () => {
    invariant(!signal?.aborted, 'SCENE_PROGRAM_ABORTED');
    const now = nowMs(); integer(now, lastNow); lastNow = now;
    requireSceneRole(actor, original.scope, ['organizer', 'operator'], now);
    integer(rightsValidUntilMs, now + 1);
    const limits = session.operatingLimits(now);
    invariant(session.snapshot().revision === original.revision &&
      canonicalJson(workspace.snapshot()) === workspaceIdentity, 'SCENE_PROGRAM_SUPERSEDED');
    const speaker = workspace.snapshot().speakers.find(item => item.id === speakerId);
    invariant(speaker && speaker.consentUntilMs > now, 'SCENE_PROGRAM_CONSENT_REQUIRED');
    const { plan } = workspace.mixPlan(now, 'authorized-session');
    invariant(plan.speakerIds.includes(speakerId), 'SCENE_PROGRAM_PLACEMENT_REQUIRED');
    return { plan, speaker, validUntilMs: Math.min(limits.stopAtMs, actor.expiresAtMs,
      speaker.consentUntilMs, rightsValidUntilMs) };
  };
  const admitted = guard();
  integer(epochUnixMs, original.plan.startsAtMs, admitted.validUntilMs - 1);
  // Bound PCM, source work and allocations independently of the caller's files.
  integer(scene.frames, 1, 1048576);
  invariant(scene.frames * scene.sources.length <= 64 * 1024 * 1024, 'SCENE_PROGRAM_WORK_LIMIT');
  invariant(Object.keys(stems).sort().join(',') === [...admitted.plan.sourceIds].sort().join(','), 'SCENE_PROGRAM_STEMS_MISMATCH');
  for (const id of admitted.plan.sourceIds)
    invariant(stems[id] instanceof Float32Array && stems[id]!.length === scene.frames, 'SCENE_PROGRAM_STEM_ALIGNMENT');
  const samples = new Float32Array(scene.frames);
  let packaged: Awaited<ReturnType<typeof packageRendition>> | undefined;
  try {
    const single = { ...admitted.plan, speakerIds: [speakerId] };
    // Retain the all-speaker plan's normalized gains; recomputing a one-speaker
    // plan would change balance and incorrectly raise that output's level.
    for (let start = 0; start < scene.frames; start += 65536) {
      guard();
      const chunk = Object.fromEntries(single.sourceIds.map(id => [id, stems[id]!.subarray(start, Math.min(start + 65536, scene.frames))]));
      const rendered = renderSpatialChunk(single, chunk)[speakerId]!;
      try { samples.set(rendered, start); } finally { rendered.fill(0); }
    }
    const context = { tenantId: original.scope.tenantId, application: original.scope.application, parentMessageId };
    packaged = await packageRendition({ sampleRate: scene.sampleRate, channels: 1, samples }, 1, context, 'spatial-output.wav');
    const current = guard();
    invariant(canonicalJson(current.plan) === canonicalJson(admitted.plan), 'SCENE_PROGRAM_SUPERSEDED');
    return { speakerId, outputId: admitted.speaker.outputId, siteRevision: original.plan.revision,
      sceneRevision: scene.revision, epochUnixMs,
      program: compileProgram(programId, scene.sampleRate, [{ id: 'spatial-output', assetId, frames: scene.frames, markerAfter: null }]),
      asset: { assetId, context, manifest: packaged.privateManifest, sampleRate: scene.sampleRate, channels: 1,
        frames: scene.frames, authorizationValidUntilMs: Math.min(admitted.validUntilMs, current.validUntilMs) },
      ciphertextChunks: packaged.ciphertextChunks, fieldValidated: false };
  } catch (error) {
    if (packaged) {
      packaged.privateManifest.attachmentKeyHex = '';
      for (const bytes of packaged.ciphertextChunks) bytes.fill(0);
    }
    throw error;
  } finally { samples.fill(0); }
}
