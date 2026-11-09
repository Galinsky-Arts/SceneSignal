# SceneSignal implementation and evidence

## Integrated source checkpoint — November 9, 2026

PRs #13, #14 and #22–#25/#27–#33 are merged. The integrated source passes 123
application tests and the production Chromium draft-workflow smoke test. The
[delivery verification record](delivery-verification-2026-11-09.md) distinguishes
the exact software checks from operational and physical acceptance still needed.
The canonical registry restores the dependency graph and retains partial evidence
as contributions rather than treating those merges as completed field milestones.

The earlier checkpoint below describes historical foundations, not the current
test count or a statement that all later source work is still absent.

The contribution store additionally passes five real PostgreSQL 17 integration
tests for concurrent deduplication, caps, rollback, reopened connections and
tenant/session isolation. The required hosted workflow runs this suite separately
from `npm run check`. No operational database or real contribution is claimed.

## Dependency verification — November 9, 2026

The audio dependency now pins `Galinsky-Arts/Distributed-Audio-Engine` at
`65f1a08c4735aa232521306e35720d675d568f3c`. This revision has successful hosted
Engine CI, Native audio CI, Signal parent integration, ciphertext relay integration
and integrated software rehearsal runs. Local `npm run check` also passes for
that source, including the packed-consumer and portability checks.

SceneSignal uses Vite 6.4.6 to address GHSA-8g5g-mxqh-grgj. A regenerated audio
archive and lockfile pass a clean `npm ci --ignore-scripts`, all 50 application
tests, typechecking, roadmap validation and the production build. The dependency
audit reports zero vulnerabilities. Two consecutive core builds produced the
same archive SHA-512. Core preparation normalizes public package file permissions
so local umask differences cannot change the archive on hosted runners. It removes
old compiled output before building so advancing a pin cannot retain deleted modules. The browser fixture now returns
a browser-realm ArrayBuffer, matching a real File and preserving the core's strict
buffer validation. Local checks used Node 24.22.1; hosted CI retains Node 24.19.0.

These checks establish software compatibility only. Account/channel integration,
native SceneSignal output, operational providers, physical calibration and pilot
evidence remain outstanding. Independent expert review remains deferred under
the owner policy in AGENTS.md; no certification is claimed.

Builds also discard old TypeScript output before compilation. Plan edits revoke
pending audio auditions before asynchronous hashing, preventing a delayed audio
resume from starting the previous plan's output. The existing built-bundle race
test exercises this cancellation path.

PRs #2 and #3 merged the session and spatial/evidence foundations. The browser-workspace candidate brings the application to 17 software tests: session safety, contributor consent, physical-output identity deduplication, fixed/tracked placement, Spime freshness, bounded PCM auditions, encrypted evidence and built-bundle draft workflows. Test identity, channel, coordinate and audio-sink adapters are explicit. The audio core is a separately prepared package pinned to immutable source.

No interactive account provider, authenticated parent key channel, native output, permit review, real spatial session or deployment is claimed. Test identity and E2EE payload-decoder adapters are explicit. Private plans and permit evidence stay at authorized endpoints; public listings disclose only the approved summary, time and admission state.

Next development continues through lineup, contributor consent, fixed/tracked speakers, Spimes, spatial composition, session rewards, complete-album commerce and operational exports. Real pilot, scale and independent release gates remain distinct from development merges.
