# Spatial composition to an encrypted speaker program

`prepareSceneOutput` connects the authorized spatial workspace to the core's
actual encrypted-media/program contracts. It renders one physical speaker's
mono mix, packages it with the existing endpoint AEAD format, and returns the
private `EndpointMediaAsset`, ciphertext chunks and compiled program. The
all-speaker normalization is retained: preparing a distant output separately
must not raise it to the level of a recomputed one-speaker scene.

The organizer/operator must supply current account claims, the active authorized
session, the corresponding workspace, aligned source PCM, source-rights deadline,
opaque asset/message/program identifiers and a clock. Preparation checks scope,
role, site/scene revision, placement, contributor consent and source rights. It
checks them again after encryption. Cancellation, withdrawal, site stop, rights
loss, expired claims and changed scenes prevent a key-bearing result. PCM is
rendered synchronously before the first encryption yield, so caller mutation
cannot replace the admitted audio during encryption. Temporary PCM is cleared.

Preparation is bounded to 1,048,576 frames and 64 million source-frame operations
per output. It renders in chunks of at most 65,536 frames and retains the original
source buffers under caller ownership. This is offline preparation, not a live
capture or audio-callback API. A larger composition needs an explicit segmented
publisher; it is rejected here rather than silently truncated.

Only `ciphertextChunks` may go to a relay. The entire private recipient binding
(`speakerId`, `outputId`, revisions), program and `asset` descriptor—including the
attachment key—must use the real authenticated E2EE parent adapter. The recipient
must verify that binding against its current account/device membership and output.
Do not put this object in the account API, public listings or browser storage.
The producer must obtain a real source-rights deadline; naming a derived asset
does not create new playback rights.

The listening endpoint constructs `ProgramTimeline(prepared.epochUnixMs,
prepared.program)`, supplies its authenticated asset resolver and ciphertext
transport, and uses `SceneNativePlayback` with real signed leases, current rights
and the appropriate native bridge. Preparation never grants a lease, establishes
root trust, distributes keys, starts a speaker, changes system volume or proves
physical qualification. Returned permission expires no later than source rights,
site authority, organizer identity or contributor consent.

Ten focused cases cover normalized samples, topology balance, caller mutation,
authorization/input bounds, cancellation, concurrent scene/site/consent changes
and rights/expiry rechecks. Two additional production-C integration cases take
the actual rendered spatial samples through encryption, decryption, each platform
adapter and the native queue; site cancellation produces silence. The full native
suite now has ten cases. These are software tests, not physical phone/acoustic
measurements or operational parent-channel provisioning.
