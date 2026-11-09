# SceneSignal native session runtime

`SceneNativePlayback.android()` and `.ios()` compose the current Distributed Audio
Engine encrypted program player, signed authority and native sink with the
SceneSignal session and one registered contributor output. The workspace must
belong to that exact session. The endpoint and physical output IDs must match the
actual native route; a phone name, draft marker or paired-device list is not a
route identity.

The caller supplies the real platform bridge, authenticated endpoint asset
resolver/parent decoder and current account claims. No test identity, private-key
distribution service or plaintext manifest fallback is supplied by the runtime.
The program must be the already-authorized, per-output composition prepared by
the controlling endpoint. This integration does not turn a local browser audition
into a contributed-speaker stream or perform live spatial remixing by itself.

Before join, renewal and each asynchronous media scheduling boundary, the runtime
checks the active signed site authorization, unchanged site revision, scoped
contributor identity, speaker ownership/consent, current physical route and usable
placement. Source rights still pass through the engine's actual rights adapter.
The private signed lease must fit entirely within the site, contributor-consent
and identity lifetimes and the lower site/contributor gain ceiling. Overbroad
leases are rejected rather than silently rewritten.

Session cancellation, site edits, authorization replacement and expiry revoke
owned output lifecycles. Speaker withdrawal revokes its own lifecycle immediately.
Stop fanout continues even if another host callback throws. Delayed private
decoding or media reads cannot resurrect a revoked lifecycle. Native route changes
still require an explicit fresh signed join. `emergencyStop()` verifies the core's
signed emergency control; `stop()` immediately withdraws this endpoint's own
participation. `close()` removes subscriptions and releases owned native state.

Call the trusted identity adapter for current `SceneActor` claims before
`join(actor, lease)`, `renew(actor, lease)` and `pump(actor)`. Drive `tick()` from the
foreground host to observe current application conditions. Native queued PCM
independently obeys its signed hard deadline when JavaScript is suspended.

## Verification

Portable Android/iOS lifecycle tests exercise real signed controls and actual
AEAD-encrypted media with explicit account/parent/native test adapters. A separate
`npm run test:native` compiles the production C kernel from the exact pinned audio
source and exercises the SceneSignal-to-C handoff. It verifies real samples,
withdrawal/cancellation, signed emergency stops and deadlines without another
JavaScript tick. GitHub Actions requires both suites.

These tests do not establish physical output, audible stop latency, acoustic
calibration, native application bootstrap or real user-account provisioning. The
runtime's `fieldValidated` remains false. Real supported-device and authorized
site qualification remain separate acceptance work.
