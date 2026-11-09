import {identifier, integer, invariant, validateScene} from '@neophilism/distributed-audio-engine';
import type {Scope, SpatialScene} from '@neophilism/distributed-audio-engine';
import {requireSceneRole} from './session.js';
import type {SceneActor} from './session.js';

export interface SpatialKeyframe {
  atMs: number;
  scene: SpatialScene;
}
/**
 * Endpoint-side deterministic scene movement on a caller-supplied common clock.
 * This produces planning state only; an authorized renderer must separately
 * verify live output, device calibration, rights and consent.
 */
export class SpatialAutomation {
  private frames: SpatialKeyframe[] = [];
  constructor(private readonly scope: Scope,
    private readonly rightsAllowSource: (assetId: string, nowMs: number) => boolean) {
    invariant(scope.application === 'scenesignal', 'INVALID_SCENE_APPLICATION');
    identifier(scope.tenantId); identifier(scope.sessionId);
    this.scope = structuredClone(scope);
  }
  /** Reject applying a private timeline in another tenant, session or product. */
  assertScope(scope: Scope): void {
    invariant(this.scope.tenantId === scope.tenantId &&
      this.scope.sessionId === scope.sessionId &&
      this.scope.application === scope.application, 'AUTOMATION_SCOPE_CONFLICT');
  }
  schedule(actor: SceneActor, frames: SpatialKeyframe[], nowMs: number): void {
    requireSceneRole(actor, this.scope, ['organizer', 'operator'], nowMs);
    invariant(Array.isArray(frames) && frames.length >= 2 && frames.length <= 256,
      'INVALID_AUTOMATION_LENGTH');
    let previous = nowMs - 1;
    // One scene ID always refers to a stable version and source binding.
    // Different scene IDs may be scheduled as discrete, authorized cuts.
    const knownScenes = new Map<string, SpatialScene>();
    for (const frame of frames) {
      invariant(frame && typeof frame === 'object' && !Array.isArray(frame) &&
        Object.keys(frame).sort().join(',') === 'atMs,scene', 'INVALID_AUTOMATION_FRAME');
      integer(frame.atMs, nowMs);
      invariant(frame.atMs > previous && frame.atMs <= nowMs + 86_400_000,
        'AUTOMATION_CLOCK_ORDER');
      validateScene(frame.scene);
      const known = knownScenes.get(frame.scene.id);
      if (!known) knownScenes.set(frame.scene.id, frame.scene);
      else invariant(frame.scene.revision === known.revision &&
          frame.scene.sampleRate === known.sampleRate &&
          frame.scene.frames === known.frames &&
          frame.scene.sources.length === known.sources.length &&
          frame.scene.sources.every((source, index) =>
            source.id === known.sources[index]!.id &&
            source.assetId === known.sources[index]!.assetId &&
            source.role === known.sources[index]!.role),
          'AUTOMATION_SCENE_OR_SOURCE_CONFLICT');
      invariant(frame.scene.sources.every(source =>
        this.rightsAllowSource(source.assetId, nowMs) === true),
        'AUTOMATION_SOURCE_RIGHTS_DENIED');
      previous = frame.atMs;
    }
    this.frames = structuredClone(frames);
  }
  cancel(actor: SceneActor, nowMs: number): void {
    requireSceneRole(actor, this.scope, ['organizer', 'operator'], nowMs);
    this.frames = [];
  }
  sample(nowMs: number): SpatialScene | null {
    integer(nowMs);
    const frames = this.frames;
    if (!frames.length || nowMs < frames[0]!.atMs) return null;
    let left = frames[0]!;
    let right = frames[frames.length - 1]!;
    for (let i = 1; i < frames.length; i++) {
      if (nowMs < frames[i]!.atMs) { right = frames[i]!; break; }
      left = frames[i]!;
    }
    invariant(left.scene.sources.every(source =>
      this.rightsAllowSource(source.assetId, nowMs) === true),
      'AUTOMATION_SOURCE_RIGHTS_DENIED');
    // Different scenes may have different source sets, rights and output routes.
    // Hold the old scene until the boundary: never interpolate across identities.
    if (left === right || left.scene.id !== right.scene.id) return structuredClone(left.scene);
    const fraction = (nowMs - left.atMs) / (right.atMs - left.atMs);
    const scene = structuredClone(left.scene);
    scene.sources = scene.sources.map((source, index) => {
      const target = right.scene.sources[index]!;
      return {...source,
        position: {
          x: source.position.x + (target.position.x - source.position.x) * fraction,
          y: source.position.y + (target.position.y - source.position.y) * fraction,
          z: source.position.z + (target.position.z - source.position.z) * fraction
        },
        gain: source.gain + (target.gain - source.gain) * fraction,
        spreadMeters: source.spreadMeters +
          (target.spreadMeters - source.spreadMeters) * fraction
      };
    });
    validateScene(scene);
    return scene;
  }
}
