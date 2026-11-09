# Account service and browser connection

SceneSignal now supplies a real Better Auth 1.7.18/PostgreSQL account service and
same-origin browser account screens. Sign-up, sign-in, HttpOnly sessions, sign-out,
session ownership and collaborator roles use the actual framework and database.
No demo account, browser-selected role or process-local account store is used.

## Run the account-enabled host

1. Prepare the pinned audio dependency, install locked dependencies and build:
   `npm run core:prepare && npm ci --ignore-scripts && npm run check`.
2. Configure `DATABASE_URL`, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` through
   secure environment settings. `.env.example` contains only empty placeholders.
   Use a fresh random secret of at least 32 characters; keep it stable across
   instances. Never place it in a `VITE_` variable or a browser bundle.
3. Use a certificate-verified PostgreSQL connection. Remote connections reject
   disabled/unverified TLS settings; `sslmode=verify-full` is accepted. Plain HTTP
   and non-TLS PostgreSQL are permitted only for loopback development.
4. Run `npm run db:migrate`. This runs the framework's official schema migrations
   and the application account/contribution migrations. Runtime startup does not
   silently apply production schema changes.
5. Run `npm start`. The Node host serves the built browser workspace, `/api/auth/*`,
   the scoped account API and database-backed `/healthz` on `PORT` (default 3000).
   Configure the production base URL as HTTPS. The browser and API use the same
   origin; the static GitHub Pages preview alone cannot host accounts.

The Account tab creates a real account and opaque session ownership references.
Organizers can add/update performer, operator, steward and contributor access by
the recipient's account reference. The server checks the caller's current scoped
organizer membership; it never accepts a browser claim as authority. Collaborators can
leave their own session. Organizer membership cannot be downgraded or deleted
through collaborator management. Membership changes are transactional and bounded.

`GET /api/scene/actor?tenantId=...&sessionId=...` returns a current `SceneActor` only
after session and membership verification. Claims expire within 60 seconds or
the account session lifetime, whichever is earlier. An endpoint must fetch current
claims before protected operations. Previously issued claims/leases are bounded,
not magically recalled by a disconnected server. Device consent, signed site
authorization, root membership and native output authority remain separate.

## Processing boundary

The server intentionally processes email, display name, password authentication,
opaque account/session identifiers and role metadata. Better Auth owns password
hashing, cookie authentication, session revocation, origin checks and database
rate limiting. Cookies are HttpOnly, account-scoped, and Secure on HTTPS; cookie
cache is disabled so membership/session requests are rechecked. Client forwarding
headers cannot select arbitrary rate-limit identities. Anonymous framework
telemetry is disabled. API responses are non-cacheable and startup failures do
not print credential-bearing configuration.

Passwords, tokens and private drafts are not written to browser storage. No stem,
permit, private condition, location, manifest or media key enters the account API.
Role changes do not distribute E2EE keys or start a speaker. Browser drafts remain
local, and public activation stays disabled until actual endpoint integrations
are present. Sign-out clears the local draft and fences delayed plan hashing,
WAV reads and permit encryption so old work cannot repopulate the next workspace.
Logical cleanup is not a claim of physical JavaScript memory erasure.

## Verification and remaining operations

The required PostgreSQL workflow exercises actual HTTP sign-up/sign-in, cookies,
ownership, forged-cookie/cross-account/role-injection denials, role grant/revoke,
voluntary departure, origin checks, persistence, sign-out and secret rotation.
Chromium additionally verifies the real account screens, ownership creation,
escaped display names, disabled public activation and private-draft clearing with
no protected-data uploads or external requests. Unit regressions cover late
private work after sign-out and configuration-error secrecy.

This service does not assert verified email ownership or supply an email recovery
provider. Mail/verification/recovery configuration, an actual production database
and deployment, restore/retention drills and endpoint account-root/key provisioning
remain operational acceptance work. Password/account recovery must not become
server custody of private media keys. No live account deployment, physical device
qualification or independent certification is inferred from these local tests.
