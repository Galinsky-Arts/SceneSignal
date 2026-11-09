import { EndpointPlaybackSession, canonicalJson, finite, identifier, integer, invariant } from '@neophilism/distributed-audio-engine';
import type { AndroidAudioBridge, AndroidSinkOptions, IOSAudioBridge, IOSSinkOptions,
  PlaybackSessionOptions, SignedControl } from '@neophilism/distributed-audio-engine';
import type { SceneActor, SceneSession } from './session.js';
import type { SpatialWorkspace } from './spatial-workspace.js';

export interface SceneNativePlaybackOptions extends Omit<PlaybackSessionOptions, 'scope' | 'consentedGainCeiling'> {
  session: SceneSession;
  workspace: SpatialWorkspace;
  speakerId: string;
  endpointId: string;
}
export type SceneAndroidPlaybackOptions = SceneNativePlaybackOptions & {
  bridge: AndroidAudioBridge;
  native: Omit<AndroidSinkOptions, 'nowUnixMs' | 'onInvalidated'>;
};
export type SceneIOSPlaybackOptions = SceneNativePlaybackOptions & {
  bridge: IOSAudioBridge;
  native: Omit<IOSSinkOptions, 'nowUnixMs' | 'onInvalidated'>;
};

/** Own one contributor's encrypted program/native output. Actual account claims,
 * authenticated parent decoding and native platform bridges are required inputs.
 * A site plan, browser role selector or computed mix cannot start this output. */
export class SceneNativePlayback {
  private readonly playback: EndpointPlaybackSession;
  private readonly unsubscribe: () => void;
  private readonly unsubscribeSpeaker: () => void;
  private readonly siteRevision: number;
  private actor: SceneActor | null = null;
  private closed = false;
  private commandPending = false;
  private lastNowMs = 0;
  private constructor(private readonly options: SceneNativePlaybackOptions,
    create: (options: PlaybackSessionOptions) => EndpointPlaybackSession) {
    const { session, workspace, speakerId, endpointId, ...core } = options;
    this.options = Object.freeze({ ...options });
    invariant(workspace.belongsTo(session), 'NATIVE_WORKSPACE_SESSION_MISMATCH');
    identifier(speakerId); identifier(endpointId);
    this.siteRevision = session.snapshot().plan.revision;
    const speaker = workspace.snapshot().speakers.find(item => item.id === speakerId);
    invariant(speaker, 'NATIVE_SPEAKER_NOT_REGISTERED');
    this.playback = create({ ...core, scope: session.snapshot().scope,
      consentedGainCeiling: Math.min(speaker.maximumLinearGain, session.snapshot().plan.maximumLinearGain),
      decodeControlPayload: async body => {
        const decoded = await core.decodeControlPayload(body);
        const payload = JSON.parse(canonicalJson(decoded)) as Record<string, unknown>;
        const limits = this.guard();
        finite(payload.maxLinearGain as number, 0, limits.maximumLinearGain);
        integer(payload.expiresAtMs as number, limits.nowMs + 1, limits.stopAtMs);
        integer(payload.stopAtMs as number, limits.nowMs + 1, limits.stopAtMs);
        return payload;
      },
      authorizePlayback: async (assetId, atMs, signal) => {
        this.guard();
        const permission = await core.authorizePlayback(assetId, atMs, signal);
        const limits = this.guard();
        if (permission.allowed !== true) return { allowed: false };
        invariant(Object.keys(permission).sort().join(',') === 'allowed,validUntilMs', 'INVALID_PLAYBACK_PERMISSION');
        integer(permission.validUntilMs, limits.nowMs + 1);
        return { allowed: true, validUntilMs: Math.min(permission.validUntilMs, limits.stopAtMs) };
      }
    });
    this.unsubscribe = session.subscribeOutputStop(() => this.stop());
    this.unsubscribeSpeaker = workspace.subscribeSpeakerLeave(id => { if (id === speakerId) this.stop(); });
  }
  static android(options: SceneAndroidPlaybackOptions): SceneNativePlayback {
    const { bridge, native, ...base } = options;
    return new SceneNativePlayback(base, core => EndpointPlaybackSession.android({ ...core, bridge, native }));
  }
  static ios(options: SceneIOSPlaybackOptions): SceneNativePlayback {
    const { bridge, native, ...base } = options;
    return new SceneNativePlayback(base, core => EndpointPlaybackSession.ios({ ...core, bridge, native }));
  }
  private now(): number {
    const now = this.options.nowUnixMs(); integer(now, this.lastNowMs); this.lastNowMs = now; return now;
  }
  private guard() {
    invariant(!this.closed && this.actor, 'NATIVE_ACTOR_REQUIRED');
    const nowMs = this.now(), state = this.options.session.snapshot(), actor = this.actor;
    invariant(state.plan.revision === this.siteRevision, 'NATIVE_SITE_REVISION_CHANGED');
    identifier(actor.identityId); integer(actor.expiresAtMs, nowMs + 1);
    invariant(actor.tenantId === state.scope.tenantId && actor.sessionId === state.scope.sessionId,
      'NATIVE_ACTOR_SCOPE_DENIED');
    const speaker = this.options.workspace.snapshot().speakers.find(item => item.id === this.options.speakerId);
    invariant(speaker && speaker.ownerId === actor.identityId && speaker.consentUntilMs > nowMs,
      'NATIVE_SPEAKER_CONSENT_DENIED');
    const route = this.playback.snapshot().output;
    invariant(route.state === 'active' && route.route?.outputId === speaker.outputId &&
      route.route.endpointId === this.options.endpointId, 'NATIVE_OUTPUT_BINDING_DENIED');
    const limits = this.options.session.operatingLimits(nowMs);
    const plan = this.options.workspace.mixPlan(nowMs, 'authorized-session').plan;
    invariant(plan.speakerIds.includes(speaker.id), 'NATIVE_SPEAKER_PLACEMENT_UNAVAILABLE');
    return { nowMs, maximumLinearGain: Math.min(limits.maximumLinearGain, speaker.maximumLinearGain),
      stopAtMs: Math.min(limits.stopAtMs, speaker.consentUntilMs, actor.expiresAtMs) };
  }
  private async run<T>(actor: SceneActor, operation: () => Promise<T>): Promise<T> {
    invariant(!this.closed && !this.commandPending, 'NATIVE_OPERATION_CLOSED_OR_BUSY');
    this.commandPending = true;
    try {
      this.actor = structuredClone(actor);
      this.guard();
      const result = await operation();
      this.guard();
      return result;
    } catch (error) { try { this.stop(); } catch { /* Preserve original denial after local revocation. */ } throw error; }
    finally { this.commandPending = false; }
  }
  async join(actor: SceneActor, lease: SignedControl): Promise<void> {
    await this.run(actor, () => this.playback.join(lease));
  }
  async renew(actor: SceneActor, lease: SignedControl): Promise<void> {
    await this.run(actor, () => this.playback.renew(lease));
  }
  async pump(actor: SceneActor) { return this.run(actor, () => this.playback.pump()); }
  async emergencyStop(control: SignedControl): Promise<void> {
    invariant(!this.closed, 'NATIVE_OPERATION_CLOSED_OR_BUSY');
    try { await this.playback.emergencyStop(control); } finally { this.actor = null; }
  }
  tick(): void { try { this.guard(); } catch (error) { this.stop(); throw error; } }
  snapshot() { return { ...this.playback.snapshot(), siteRevision: this.siteRevision, fieldValidated: false as const }; }
  stop(): void { this.actor = null; this.playback.stop(); }
  close(): void {
    if (this.closed) return;
    this.closed = true; this.actor = null; this.unsubscribe(); this.unsubscribeSpeaker(); this.playback.close();
  }
}
