# Galinsky Labs preview verification — November 15, 2026

Verified at about 00:23 UTC from provider API records, HTTPS, actual Chromium and
Neon's schema API. This preview replaces reliance on the earlier preview in
Phillip's personal workspace, whose free Render database expires December 9,
2026. That workspace was not read or changed.

| Item | Observed result |
| --- | --- |
| URL | https://scenesignal.onrender.com |
| Render workspace | Galinsky Labs, `tea-dbkuuhuk1f9s73e2nqn0` |
| Service | `srv-dbsflm0n74is739o3720`, free, Ohio, Node runtime, auto-deploy off |
| Deployment | `dep-dbsflmgn74is739o3810`, `live` |
| Deployed source | `a04a3fb7c6f84a4fe6dcb1b99f7b53cf24ce55dd` (main after #43–#45) |
| Audio pin | `532d28a7e479fe25428c315ba415c3722de7b84c` |
| Account database | Neon project `mute-smoke-44149367` ("scenesignal", Galinsky Labs organization `org-plain-smoke-27298332`), `aws-us-east-2`, PostgreSQL 17, free; branch `br-summer-rain-begki9om` |
| Schema | Neon schema API lists `user`, `session`, `account`, `verification`, `rateLimit`, `scene_account_membership`, `scene_contribution_events` after the start script's migration |
| Health | HTTPS GET `/healthz`: 200, `{"status":"ok"}` |
| Anonymous membership access | GET `/api/scene/sessions`: 401, `sign_in_required` |
| Capabilities | GET `/api/capabilities`: `{"passwordRecovery":false}` (no mail key configured) |

The build on Render ran `npm run check`: 162 application cases and four registry
cases. The same source's hosted CI also passed the PostgreSQL/HTTP suite (22
cases, including the new recovery suite) and ten production-C cases. The
dependency audit was clean.

## Browser verification (actual Chromium, live HTTPS)

All steps passed in one run:

1. Account A signed up. The display name contained markup and rendered escaped.
2. A created a session reference and is listed as its organizer.
3. Account B signed up in a separate browser context.
4. A granted B `operator` access using B's account reference. B refreshed and saw
   the operator membership, then left the session voluntarily.
5. Reloading A's page restored the signed-in account from its HttpOnly cookie.
6. A signed out. The scoped API then returned 401. A signed in again and still
   owned the session.
7. B changed its password with the current password, then deleted its account
   with the new password and explicit confirmation. A later sign-in returned 401.
8. A 390-pixel phone viewport had no horizontal overflow.
9. There were zero requests outside the application origin and zero page errors.
   No password appeared in any request URL.

A's synthetic verification account (random `example.invalid` address) remains,
signed out, with one organizer reference. B was deleted. No real person's data,
private media, permit or key was used.

## Configuration and secrets

`BETTER_AUTH_SECRET` was generated randomly (48 bytes, URL-safe) and exists
only in the service's Render environment. `DATABASE_URL` is the Neon direct
connection string, set only in Render. `scripts/render-start.mjs` forces
`sslmode=verify-full`, and the application verifies certificates. Nothing secret
was committed. `render.galinsky-labs.yaml` records the non-secret settings.

The managed execution environment reaches the web through an inspecting HTTPS
proxy with its own supplied CA. Its allowlist gained exactly
`scenesignal.onrender.com` for this check. Certificate verification was not
disabled in the browser. The proxy did not resolve Neon's database host, so the
database was checked through the Neon schema API and through the application,
not by direct SQL from this environment.

## Limits and remaining work

- Free Render instances sleep after 15 minutes idle. Neon's free compute
  suspends when idle and has storage/compute-hour limits and no managed backup
  guarantee. This is a durable preview, not production hosting.
- Password-reset email needs an owner-provided `RESEND_API_KEY` and a verified
  `SCENESIGNAL_MAIL_FROM` sender. Until then the UI says recovery is unavailable.
- Restore/retention drills, endpoint account-root/key provisioning, phone
  bootstrap, authenticated recipient program publication, provider/payment
  integration and SS-30/SS-31 physical trials remain pending. No field,
  certification or production-release result is inferred from this website.
