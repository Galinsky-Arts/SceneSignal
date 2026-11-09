import { ControlVerifier, MemoryCheckpointStore, ProgramTimeline, compileProgram,
  createControlSigningKey, packageRendition, signControl } from '@neophilism/distributed-audio-engine';
import type { AndroidPcmRequest, IOSPcmRequest, LeasePolicy, OutputRoute } from '@neophilism/distributed-audio-engine';
import { SceneNativePlayback, SceneSession, SpatialWorkspace } from '../../src/index.js';
import type { SceneActor, SceneNativePlaybackOptions, SessionAuthorization, SitePlan } from '../../src/index.js';

const scope = { tenantId: 'tenant', sessionId: 'show', application: 'scenesignal' as const };
export const organizer: SceneActor = { ...scope, identityId: 'organizer', roles: ['organizer'], expiresAtMs: 20000 };
export const contributor: SceneActor = { ...scope, identityId: 'contributor', roles: [], expiresAtMs: 20000 };
export const site: SitePlan = { siteId: 'site', revision: 1, conditionsDigestHex: 'a'.repeat(64),
  startsAtMs: 2000, endsAtMs: 10000, maximumLinearGain: 0.6, publicSummary: 'Free concert' };
export const output: OutputRoute = { endpointId: 'endpoint', routeId: 'route', outputId: 'physical-output', kind: 'wired-speaker', generation: 1 };
export type NativeEvent = { type: 'route-active'; route: OutputRoute; sampleRate: number; maxChannels: number } | { type: 'disconnected' };
interface FixtureBridge {
  subscribe(listener: (event: NativeEvent) => void): () => void;
  enqueue(request: Readonly<AndroidPcmRequest | IOSPcmRequest>): void;
  updateEnvelope(id: string, gain: number, fade: number, stop: number): void;
  cancel(id: string): void;
  cancelAll(): void;
}
export function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }

export async function fixture(platform: 'android' | 'ios', active = true, createBridge?: (now: () => number) => FixtureBridge) {
  let now = 2000, stops = 0, failStop = false, reads = 0;
  let decodeHook = async () => {}, readHook = async () => {};
  let listener: ((event: NativeEvent) => void) | undefined;
  const copied: Array<AndroidPcmRequest | IOSPcmRequest> = [];
  const session = new SceneSession(scope, site, () => { if (failStop) throw Error('external-stop-failed'); });
  const keys = await createControlSigningKey();
  const authorization: SessionAuthorization = { kind: 'organizer-attested', siteId: site.siteId,
    siteRevision: 1, conditionsDigestHex: site.conditionsDigestHex, validFromMs: 1000, validUntilMs: 11000,
    authorizerId: organizer.identityId, encryptedEvidenceObjectId: 'permit', evidenceDigestHex: 'b'.repeat(64), maximumLinearGain: 0.3 };
  const auth = new ControlVerifier(scope, new Map([['operator', keys.publicKey]]), new Set(['session-authorize']), new MemoryCheckpointStore());
  const authControl = await signControl({ version: '1.0.0', scope, keyId: 'operator', algorithm: 'ALG-ED25519',
    epoch: 1, sequence: 1, issuedAtMs: 1000, expiresAtMs: 12000, action: 'session-authorize', payloadCiphertextBase64: 'dGVzdA==' }, keys.privateKey);
  await session.authorize(organizer, authControl, auth, async () => authorization, 1000);
  if (active) session.activate(organizer, 2000);
  const workspace = new SpatialWorkspace(session, { id: 'scene', revision: 1, sampleRate: 8000, frames: 8000,
    sources: [{ id: 'stem', assetId: 'asset', role: 'full', position: { x: 0, y: 0, z: 0 }, gain: 1, spreadMeters: 1 }] }, () => true);
  workspace.joinSpeaker(contributor, { id: 'speaker', ownerId: contributor.identityId, outputId: output.outputId,
    consentUntilMs: 9000, maximumLinearGain: 0.4, roleWeights: { full: 1 }, placement: 'fixed', position: { x: 0, y: 0, z: 0 }, trackerId: null }, 1000);
  const context = { tenantId: scope.tenantId, application: scope.application, parentMessageId: 'asset-message' };
  const media = await packageRendition({ sampleRate: 8000, channels: 1, samples: new Float32Array(8000).fill(0.5) }, 1, context, 'private-mix.wav');
  const policy: LeasePolicy = { expiresAtMs: 8000, stopAtMs: 8000, fadeMs: 100, maxLinearGain: 0.25 };
  const bridge: FixtureBridge = createBridge?.(() => now) ?? {
    subscribe(value: (event: NativeEvent) => void) { listener = value; value({ type: 'route-active', route: output, sampleRate: 8000, maxChannels: 1 }); return () => { listener = undefined; }; },
    enqueue(request: Readonly<AndroidPcmRequest | IOSPcmRequest>) { copied.push({ ...request, samples: request.samples.slice() }); },
    updateEnvelope() {}, cancel() {}, cancelAll() { stops++; }
  };
  const options: SceneNativePlaybackOptions = {
    session, workspace, speakerId: 'speaker', endpointId: output.endpointId,
    controls: new ControlVerifier(scope, new Map([['operator', keys.publicKey]]), new Set(['lease', 'emergency-stop']), new MemoryCheckpointStore()),
    // Explicit fixture decoder. The application must supply its real authenticated E2EE parent adapter.
    decodeControlPayload: async () => { await decodeHook(); return { ...policy }; },
    timeline: new ProgramTimeline(2000, compileProgram('program', 8000, [{ id: 'mix', assetId: 'asset', frames: 8000, markerAfter: null }])),
    resolver: { async resolve() { return { assetId: 'asset', context, manifest: media.privateManifest, sampleRate: 8000, channels: 1, frames: 8000, authorizationValidUntilMs: 9000 }; } },
    transport: { async read(request) { reads++; await readHook(); return media.ciphertextChunks[request.chunkIndex]!.slice(); } },
    authorizePlayback: async () => ({ allowed: true, validUntilMs: 9000 }), nowUnixMs: () => now
  };
  const endpoint = platform === 'android'
    ? SceneNativePlayback.android({ ...options, bridge, native: { nowMonotonicMs: () => now + 10000 } })
    : SceneNativePlayback.ios({ ...options, bridge, native: { nowHostTimeMs: () => now + 10000 } });
  const control = (sequence = 1, action = 'lease') => signControl({ version: '1.0.0', scope, keyId: 'operator', algorithm: 'ALG-ED25519',
    epoch: 1, sequence, issuedAtMs: 1000, expiresAtMs: 11000, action, payloadCiphertextBase64: 'dGVzdA==' }, keys.privateKey);
  return { session, workspace, endpoint, options, policy, copied, control,
    get reads() { return reads; }, get stops() { return stops; },
    setNow(value: number) { now = value; }, failStop() { failStop = true; },
    blockDecode(hook: () => Promise<void>) { decodeHook = hook; }, blockRead(hook: () => Promise<void>) { readHook = hook; },
    route(route: OutputRoute) { listener!({ type: 'route-active', route, sampleRate: 8000, maxChannels: 1 }); }
  };
}

