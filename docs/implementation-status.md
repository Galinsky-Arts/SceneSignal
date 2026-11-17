# SceneSignal implementation and evidence

## Audio Engine pin — November 17, 2026

The Audio Engine pin moved from `c6fd5fa` to `292b564` (Android WebView bridge,
native queue-fill reporting and the optional `queueFill` bridge member; no
breaking change for SceneSignal). `npm run check` passes 166 + 4 cases and the
PostgreSQL integration suite 26 cases locally. No device or field evidence is
implied by the pin.

## Restore drill and email verification — November 17, 2026

- **Restore runbook and drill.** [restore-runbook.md](restore-runbook.md) covers Neon
  backups, incident restore and a non-destructive drill. `scripts/restore-drill.mjs`
  compares a restored copy with live read-only (row counts, SHA-256 row digests,
  readiness probe; names/counts only in logs). The first live drill against a
  Neon point-in-time branch passed: all 7 tables matched (`restored-matches-live`).
- **Email verification.** Built behind the existing mail settings; OFF until
  `RESEND_API_KEY` and `SCENESIGNAL_MAIL_FROM` are set, and the Account tab says so.
  Reset-mail delivery is no longer awaited (no timing signal for unknown addresses).
- **Tests.** 166 application cases, 4 registry cases and 26 PostgreSQL/HTTP cases
  pass (new: restore drill, verification flow, verification mail).
- **Pending.** SS-30–SS-32 field pilot and release evidence (no field evidence is
  claimed), endpoint key provisioning, mail delivery (owner key), provider integrations.

## Galinsky Arts preview database and dependency checkpoint — November 15, 2026

- **Neon.** The Galinsky Arts preview (`scenesignal-preview`) moved from the
  expiring free Render database to the Galinsky Arts Neon project `scenesignal`
  (`fancy-night-72553226`) with the verified, transactional
  `scripts/copy-postgres.mjs` ([details](render-preview.md)). Two new PostgreSQL
  integration tests cover exact text-level row equality (microsecond timestamps,
  bigint), names/counts-only logging, idempotent restart and full rollback.
- **Audio Engine pin** advanced to `c6fd5fa6c9a1a5cf3e8a3a72f60f515083661430`
  (playback stream-adapter seam and relay slug fix); archive/lock integrity re-verified.
- **Registry.** SS-24 and SS-26–SS-29 now map their exact-ID merged PRs (#24, #14,
  #27, #28, #29) as primary PRs; they have no external prerequisites. SS-30–SS-32
  keep field-pilot/release prerequisites and contributing-only evidence. #46 added.

## Galinsky Labs preview and account lifecycle checkpoint — November 15, 2026

- **New preview.** A free preview now runs at https://scenesignal.onrender.com in
  the Galinsky Labs Render workspace. Its accounts live in the Galinsky Labs Neon
  project `scenesignal` (PG 17), not in an expiring Render database. Deployed
  commit: `a04a3fb7c6f84a4fe6dcb1b99f7b53cf24ce55dd`.
- **Live checks.** Actual Chromium over HTTPS verified sign-up, session
  ownership, collaborator grant and departure, reload restore, sign-out/sign-in,
  password change, account deletion and a phone viewport. `/healthz` returns 200
  and anonymous access returns 401. See the
  [verification record](render-deployment-verification-2026-11-15.md).
- **Account lifecycle (#44).** The app restores existing sessions on load and
  offers password change, signing out other devices and password-verified account
  deletion. Deleting an organizer ends its sessions for all collaborators.
  Email password reset is built and tested, but delivery waits for an
  owner-provided mail key.
- **Galinsky Labs host (#45).** `render-start` accepts an external,
  certificate-verified database. `render.yaml` is unchanged.
- **E2EESA status (#43).** The status record matches the sibling repositories.
  All stages remain pending.
- **Stale PRs.** #11 (CI telemetry) and #17 (superseded by #43) were closed with
  explanations. #16 (auto-merge) was closed because it could bypass gates.
- **Test counts.** 164 application cases, four registry cases, 22 PostgreSQL/HTTP
  cases and ten production-C cases.

Physical SS-30/SS-31 trials, endpoint key provisioning, mail delivery, provider
integration and restore drills remain pending. The earlier preview in Phillip's
personal workspace was not changed; its database still expires December 9.

## Live preview checkpoint — November 10, 2026

The [Render preview](https://scenesignal-preview.onrender.com) is live at commit
`39457a215362605d930ce81667119a8888155bca`. Actual Chromium/HTTPS checks exercised
two accounts, ownership, collaborator access, voluntary departure, sign-out,
sign-in, private-draft clearing and a phone viewport. Read-only provider SQL
confirmed one owner membership and zero departed-collaborator memberships.
`/healthz` returns 200; anonymous session access returns 401. Subsequent Blueprint
planning returned `no_changes`. See the [source-bound deployment record](render-deployment-verification-2026-11-10.md).

The owner approved nonbillable follow-up work without repeated approvals. No paid
resource or upgrade was added. The free database expires December 9. Earlier
deployment-preparation checkpoints below describe the historical pending state.

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
