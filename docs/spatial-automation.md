# SS-22 - Scheduled scene-boundary transitions

SpatialAutomation keeps all frames on the caller-supplied common clock. An
authorized organizer/operator may schedule distinct validated scene IDs, with
independent source sets and rights checks. A change of scene ID is an atomic
cut at the new frame timestamp: the previous scene is held until the boundary.
This code does not interpolate gains, positions, or sources between distinct
scenes, nor does it route any new scene's stems before the scheduled boundary.

Frames using the same scene ID must preserve the revision, sample rate, frame
count, source identities, assets, and roles, even when the ID is revisited
later. Within that stable binding, spatial position, gain and spread interpolate.
Every scheduled frame's asset permissions are checked at scheduling time, and
the current scene's rights are checked again on each sample. Role, tenant,
session and expiry checks remain unchanged. Rescheduling is atomic: a rejected
timeline leaves the previous accepted timeline in place.

The tests exercise distinct-scene boundaries, absence of premature stem
exposure, in-scene interpolation, revoked destination rights and attempts to
reuse a scene ID with changed bindings.

This is a deterministic endpoint-side planning envelope only. Real synchronized
hardware switching, audible click suppression, physical speaker calibration,
consent timing, and acoustic field safety remain unverified release gates.

## Workspace integration

An approved timeline cannot replace the workspace scene until the workspace
has first applied that same scoped timeline in its original scene. Once bound,
a distinct scene cut is admitted only at the programmed boundary with fresh
source-rights validation, matching frame/sample-rate alignment, no active Spime
control and an authorized organizer/operator. The workspace increments its
monotonic revision and continues the same active timeline. Foreign, unbound
automation cannot smuggle in a new source; manual edits invalidate stale
timelines. A rejected boundary leaves the old scene unchanged. This retains
the renderer's independent signed output and field-safety requirements.
