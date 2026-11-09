# SceneSignal delivery verification — November 9, 2026

## Current account, spatial and dependency checkpoint

PRs #36–#40 have merged the native session runtime, real account service,
Render preview configuration, current evidence and encrypted spatial program
preparation after their required hosted checks. The current suite has **157
application cases**, four registry cases, **14 real PostgreSQL/HTTP cases** and
**ten production-C cases**. Chromium exercises actual accounts, ownership,
organizer-granted collaborator access, refresh, departure, sign-out/private-draft
clearing, XSS escaping and a phone-sized viewport. No private media/site/key
upload or external browser request is needed.

The audio pin advances to `532d28a7e479fe25428c315ba415c3722de7b84c`, whose
seven hosted core/native/Signal/relay/rehearsal checks passed. This includes the
reviewed bounded provider-checkout lifetime correction and current repository
evidence. The prepared archive's SHA-512 must match the lockfile, and the prepared
source must match the exact pin. A regression rejects an old cached lock against
a new archive; npm's cache cannot substitute earlier dependency bytes unnoticed.
The clean install, application, PostgreSQL/native and audit checks pass with this
actual archive. The dependency audit reports zero vulnerabilities.

The owner selected Phillip's Render workspace. Its SceneSignal preview database
was created, and Blueprint planning succeeded for one free Node service plus that
database. The plan is awaiting explicit approval required by Render's Blueprint
tool. No service-live or remote account verification is claimed. The database
expires December 9, 2026; the plan has no paid fallback and auto-deploy is off.
The previous GitHub Pages alternative was closed after the owner selected Render.

Remaining operational acceptance includes actual endpoint account/root/key and
phone provisioning, authenticated recipient program publication, mail/recovery,
business provider configuration, restore/retention drills and real authorized
10–20-speaker and larger-scale field qualification. These cannot be supplied by
local fixtures, generated provider receipts or invented measurements. External
expert review remains deferred under AGENTS.md; it is not an implementation gate.

The older sections below retain their historical pins and test counts.

## Subsequent native integration

The later native-runtime delivery advances the audio pin to
`b49fa569ea49663182bffdcef319ec48222c40c7` after upstream #85 passed all eight hosted
gates. The current application has 141 tests plus four registry cases and eight
actual SceneSignal-to-C integration cases. See [native runtime](native-session-runtime.md)
for the owned session/consent/output boundaries and precise verification scope.
The initial integration counts and pin below are retained as historical evidence.

## Verified source delivery

The following changes are merged on `main`. Each PR's exact head passed both
SceneSignal CI (`verify`) and Planning CI (`validate`) before merge. No failing,
missing or pending check was accepted as a pass.

| PR | Source delivered |
| --- | --- |
| [32](https://github.com/Galinsky-Arts/SceneSignal/pull/32) | Current immutable audio-core dependency, Vite vulnerability repair and reproducible package permissions |
| [33](https://github.com/Galinsky-Arts/SceneSignal/pull/33) | Clean TypeScript outputs and immediate cancellation of pending auditions on plan edits |
| [13](https://github.com/Galinsky-Arts/SceneSignal/pull/13) | Consent-safe contributor topology fades |
| [22](https://github.com/Galinsky-Arts/SceneSignal/pull/22) | Scoped spatial automation integrated with workspace editing, rights and revision fences |
| [23](https://github.com/Galinsky-Arts/SceneSignal/pull/23) | Operator handoff, revision-safe undo and invalidation of predecessor undo history |
| [24](https://github.com/Galinsky-Arts/SceneSignal/pull/24) | Verified contribution ledger and injected transactional PostgreSQL adapter |
| [25](https://github.com/Galinsky-Arts/SceneSignal/pull/25) | Public-only text and escaped large-print visitor guides |
| [14](https://github.com/Galinsky-Arts/SceneSignal/pull/14) | Signed acoustic reports, emergency/stale-monitor stops and immutable policy snapshots |
| [27](https://github.com/Galinsky-Arts/SceneSignal/pull/27) | Private site contacts and bounded incident/stop handling |
| [28](https://github.com/Galinsky-Arts/SceneSignal/pull/28) | Live-input evidence candidates; clearing fences delayed verification and older proofs |
| [29](https://github.com/Galinsky-Arts/SceneSignal/pull/29) | Verified, read-only session settlement preview |
| [30](https://github.com/Galinsky-Arts/SceneSignal/pull/30) | Pilot evidence envelope bound to plan generation, output identity and consented observation window |
| [31](https://github.com/Galinsky-Arts/SceneSignal/pull/31) | Producer, operator, performer and visitor runbooks with explicit real-world release gates |

The integrated application suite passes 123 tests, typechecking, roadmap validation
and the Vite production build. `npm audit --audit-level=moderate` reports zero
vulnerabilities. Registry validation and its four contract tests are now included
in `npm run check`; previously the canonical registry was not checked by that
command. The registry restores the original local/cross-repository dependency
edges, current organization identity and observed PR mappings. Partial evidence
adapters use `contributingPrs`, so a source merge cannot satisfy a physical pilot
or production acceptance milestone.

The actual Chromium production-bundle smoke test exercised plan saving, escaped
user content, mono WAV upload, instrument movement, draft contributor placement,
local mix audition, private permit encryption and disabled public activation.
There were zero page errors and zero external requests. This browser story is
local draft → endpoint processing → local UI; there is no operational account,
cloud draft-storage, payment or speaker-output API behind the preview.

## Dependency verification

SceneSignal directly consumes `Galinsky-Arts/Distributed-Audio-Engine` at
`65f1a08c4735aa232521306e35720d675d568f3c`. That exact upstream revision has
successful hosted Engine CI, Native audio CI, Signal parent integration,+ciphertext relay integration and integrated software rehearsal workflows.
Local `npm run check` passed all 262 engine tests plus source boundaries,
portability, roadmap and packed-consumer checks. The rebuilt locked dependency
also passes SceneSignal's clean install and hosted CI. The application does not
depend on Distributed Radio Engine or TrackZero.

Local verification used Node 24.22.1. Hosted SceneSignal CI uses its pinned Node
24.19.0. Chromium used the built application, with actual browser File, Web Crypto
and Web Audio APIs; it did not exercise acoustic output on physical contributors.

## Outstanding acceptance work

These are concrete missing capabilities/evidence, not requests for an independent
human security audit:

1. Connect an operational identity adapter, authorized endpoint membership/key
   channels, ciphertext transport/storage and recovery/retention lifecycle. The
   browser currently provides local drafting only.
2. Complete account/parent provisioning, phone application bootstrap and
   per-output spatial program publication, then qualify real device routes,
   interruptions, synchronization and audible stop latency. The native runtime
   is now connected to the core's signed output lifecycle and production C
   kernel; those software tests do not establish physical output qualification.
3. Verify operational PostgreSQL restore and retention. The actual migration and
   adapter now pass five real PostgreSQL 17 tests for concurrent admission,
   rollback, connection reopening and tenant/session isolation, in addition to
   the SQL contract fixture. This establishes storage behavior, not actual
   hardware contributions or authorization to distribute rewards.
4. Integrate real payment/album fulfillment, sponsorship and settlement provider
   records. The merged settlement implementation is a preview and executes no
   payments, payouts or financial distribution.
5. Perform the actual authorized SS-30 10–20-speaker trial, then SS-31 staged scale
   qualification, including consent, calibrated acoustic measurements, access,
   safety and failure results. No such physical evidence was generated here.
6. Verify hosting in the owner's intended workspace and retain the exact service,
   deployment commit, HTTPS health and browser evidence. This session found no
   selected Render workspace; service access requires owner workspace selection.

Independent expert review remains deferred under `AGENTS.md`. It is not a merge
or release prerequisite by itself. No independent audit, certification, live
speaker deployment, revenue operation or completed product acceptance is claimed.
