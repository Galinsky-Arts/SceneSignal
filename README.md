# SceneSignal

**Live account-enabled preview:** [scenesignal-preview.onrender.com](https://scenesignal-preview.onrender.com). [Deployment verification](docs/render-deployment-verification-2026-11-10.md). This free preview's database expires December 9, 2026; physical speaker operation remains gated by actual device/site qualification.

The endpoint SDK includes [encrypted per-speaker spatial program preparation](docs/spatial-program-preparation.md) and the [native session runtime](docs/native-session-runtime.md). Actual account/device claims, E2EE parent provisioning, signed output authority and physical qualification remain required for an operating session.

**Development and handoff plan:** [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md).

Community spatial music sessions, built directly on Distributed Audio Engine. No dependency on Distributed Radio Engine or TrackZero.

The first application implementation supplies an endpoint-owned session lifecycle: scoped organizer/operator/steward roles, site and condition revisions, signed permit or organizer-assertion decisions, current-time activation, automatic expiry, cancellation and minimized free-admission listings. [Session lifecycle](docs/session-lifecycle.md) · [Implementation and evidence](docs/implementation-status.md) · [Development plan](docs/scenesignal-development-plan.md)

Use Node 24.19.0. Run `npm run core:prepare` to fetch/build the immutable source pinned in dependency-pin.json, then `npm ci --ignore-scripts` and `npm run check`. The prepared dependency archive is ignored by Git; CI reproduces it from the pinned source. Private manifests, keys and media never belong in that archive or repository.

`npm run dev` opens the local draft workspace: plan the session, upload aligned mono WAV stems, place instruments and draft speakers, audition their mixes and prepare encrypted private evidence. [Browser workspace and validation](docs/browser-workspace.md). Drafts stay in the browser tab; public activation requires connected identity, authorization and endpoint channels.

For the account-enabled host, configure the secure environment, run `npm run db:migrate`, then `npm start` after building. [Account service and setup](docs/account-service.md). Sign-up/sign-in, session ownership and collaborator roles use Better Auth and PostgreSQL; private music, permits and site details stay on the device.

The library accepts trusted identity and authenticated E2EE channel adapters. It does not supply a fallback account or key protocol. The [native session runtime](docs/native-session-runtime.md) binds session authorization and contributor consent to the core's signed native outputs, with actual production-C integration checks. Real accounts/parent provisioning, phone bootstrap, permit operations, hardware pilots and deployed recovery remain acceptance work. Independent expert review is deferred under `AGENTS.md`; it is not a prerequisite by itself. Development continues in the four-repository order recorded in the roadmap.
