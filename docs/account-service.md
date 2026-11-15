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

## Recovery and account lifecycle

- **Restore on load.** The browser reads `/api/capabilities` and `/api/auth/get-session`
  with bodiless same-origin GETs, so a reload keeps a signed-in account. A static
  host without the service leaves only the local draft workspace.
- **Password change.** Signed-in users change their password with the current
  password; every other device session is revoked. "Sign out other devices" alone
  is also available.
- **Email password reset.** Enabled only when the host configures both
  `RESEND_API_KEY` and `SCENESIGNAL_MAIL_FROM` (a partial configuration stops
  startup). Requests answer identically for unknown addresses, are limited to three
  per client per 15 minutes, and only accept same-origin redirect targets. The
  single-use link expires after 30 minutes; the browser removes its token from the
  address bar and history before showing the form. A reset revokes every session.
  Without a mail key, the Account tab says email recovery is not configured instead
  of offering a form that cannot deliver.
- **Account deletion.** Requires the current password on every request (session age
  alone is not enough) plus an explicit confirmation. Deleting an organizer also
  deletes every membership in the sessions it organized, so collaborators never
  keep access to a session nobody can administer. Deletion clears the local draft.

Recovery restores account access only. It never grants custody of, or recovers,
private media keys, permits or drafts, which stay on endpoints.

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

The separate recovery suite verifies with real Better Auth/PostgreSQL that reset
links are single-use, rate limited, origin-bound and revoke sessions; that unknown
addresses send nothing; that password changes require the current password; and
that deletion re-proves the password and removes organized session references.

This service does not assert verified email ownership. Reset delivery needs an
owner-provided mail key and verified sender domain. Email verification, an actual production database
and deployment, restore/retention drills and endpoint account-root/key provisioning
remain operational acceptance work. Password/account recovery must not become
server custody of private media keys. No live account deployment, physical device
qualification or independent certification is inferred from these local tests.
