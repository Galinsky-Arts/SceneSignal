# SceneSignal implementation and evidence

## Current dependency checkpoint — November 9, 2026

The audio dependency is now pinned to `532d28a7e479fe25428c315ba415c3722de7b84c`
after its seven hosted checks passed. Clean installation verifies the prepared
archive against the lockfile and the prepared source against this exact pin.
This prevents npm cache reuse from hiding a stale locked package after a source
pin change. The application suite has 157 cases, plus four registry cases,
14 real PostgreSQL/HTTP cases and ten production-C cases; the audit is clean.
Earlier checkpoints below preserve their historical counts and pins.

## Spatial program preparation checkpoint — November 9, 2026

`prepareSceneOutput` now renders the authorized speaker mix and produces the core's
actual encrypted media descriptor and compiled program. It retains all-speaker
normalization and rechecks role, source rights, site/scene state and contributor
consent after encryption. Ten focused cases and two added production-C cases
verify the composition-to-encryption-to-native path. The application suite now
has 156 cases and the separate production-C suite has ten. See the
[preparation boundary and native handoff](spatial-program-preparation.md).

This is bounded endpoint preparation, not a provisioned phone app, segmented
publisher, authenticated recipient transport or physical/acoustic qualification.

## Deployment preparation checkpoint — November 9, 2026

PR #37 merged the account service and PR #38 merged the Render account-enabled
preview configuration. The owner selected Phillip's Render workspace. The free
PostgreSQL preview database is created; Blueprint planning succeeded at commit
`685bd7276f5b33e426e0d5a1625ca4e4ec53f310`. Applying its reviewed resource plan
is pending explicit Blueprint authorization; a plan is not a live deployment.
The database expires December 9, 2026. See [the deployment runbook](render-preview.md).

A second actual Chromium account context also exercised organizer-granted operator
access, current access refresh and voluntary departure; PostgreSQL confirmed
revocation. No private plan, media or key upload was needed.

## Account integration checkpoint — November 9, 2026

The [account service and browser screens](account-service.md) now use real Better
Auth/PostgreSQL HTTP sessions, ownership and organizer-controlled collaborator
roles. Current claims come from verified cookies and database memberships, not a
browser role selector. The account service stores only authorized identity and
role metadata; private draft content remains local. Sign-out also fences delayed
private work so it cannot reappear in a cleared draft.

The application suite passes 146 tests plus four registry cases; the actual
PostgreSQL/HTTP and production-C suites remain separate required CI steps.
Chromium has exercised actual account creation, ownership creation, sign-out,
sign-in again, XSS escaping, disabled activation and protected-data minimization.
Production database/hosting configuration, mail/recovery, endpoint key provisioning
and physical device qualification are still distinct from these source results.

## Native runtime checkpoint — November 9, 2026

SceneSignal now pins the integrated audio SDK at
`b49fa569ea49663182bffdcef319ec48222c40c7`, following the upstream #85 integration
and all eight hosted gates. All upstream pending source PRs are resolved. The
[native session runtime](native-session-runtime.md) composes site authorization,
scoped contributor identity, speaker consent/placement, exact output binding,
signed leases and the actual encrypted program/native sinks. Application stop
fanout reaches every owned output even when another callback fails.

The application suite passes 141 tests plus four registry contract tests. Eight
separate SceneSignal-to-production-C cases verify real samples, immediate
withdrawal/cancellation, signed emergency stops and deadlines without another
JavaScript tick. These are required hosted checks alongside the real PostgreSQL
suite. The dependency audit reports zero vulnerabilities.

Actual account/parent provisioning, phone application bootstrap, per-output
spatial program publication and physical device/field qualification are still
separate from this tested native runtime. No physical safety claim is inferred.

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
