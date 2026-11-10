# Live Render preview verification — November 10, 2026

Verified at approximately 00:05 UTC using provider deployment records, HTTPS,
actual Chromium and read-only PostgreSQL queries.

| Item | Observed result |
| --- | --- |
| URL | https://scenesignal-preview.onrender.com |
| Workspace | Phillip's workspace, `tea-dbp1vrrl550s73c3dgrg` |
| Service | `srv-dbp5tgom7kps739u7ca0`, free, Virginia |
| Deployment | `dep-dbp5thgm7kps739u7do0`, `live` at 00:02:20 UTC |
| Deployed source | `39457a215362605d930ce81667119a8888155bca` |
| Audio pin | `532d28a7e479fe25428c315ba415c3722de7b84c` |
| Database | `dpg-dbp5k8k9v7es73am52kg-a`, free PostgreSQL 17 |
| Health | HTTPS GET `/healthz`: 200, `{"status":"ok"}` |
| Anonymous membership access | GET `/api/scene/sessions`: 401, `sign_in_required` |
| Resource reconciliation | Blueprint `exs-dbp5mph42hec73blhvrg` planning returned `no_changes` |

The initial Blueprint sync reported an error even though the service deployment
completed successfully. The approval retry correctly refused an already-applied
sync in that state. Provider deploy records, actual public verification and the
subsequent no-change plan establish the observed state; the Blueprint's summary
status alone is not treated as uptime evidence. No unnecessary restart or second
service was created.

The deployed build passed all 157 application cases. The source's required hosted
checks also passed the 14 PostgreSQL/HTTP and ten production-C cases. The source
dependency audit was clean. The remote browser verification then exercised:

- Real account sign-up, sign-out and sign-in with server-side PostgreSQL sessions.
- Ownership creation, organizer-granted operator access in a second browser
  context, access refresh and voluntary departure.
- Direct provider SQL confirmation: two synthetic verification accounts, one
  owner membership and zero departed-collaborator memberships.
- Escaped untrusted display text, disabled public activation, local WAV/site-plan
  drafting, sign-out clearing and a 390-pixel phone viewport without overflow.
- No private test site text, uploaded stem name or attachment key in captured
  POST bodies; no requests outside the application origin and no browser errors.

The managed execution environment inspects HTTPS using its supplied CA. The
browser test pinned that specific CA's public key; curl used the supplied system
trust store. Global certificate verification was not disabled. The application's
PostgreSQL connection retains `verify-full` and certificate verification.

Two test accounts using random `example.invalid` addresses remain as synthetic
verification metadata; both were signed out. No real person's email, production
payment, private media key, permit or protected performance content was used.
The remaining owner reference is test data, not an actual concert authorization.

The owner approved this plan and further nonbillable work without repeated
approval requests. Both resource plans are free, with auto-deploy and auto-sync
off; no paid fallback was added. Free database expiry is **December 9, 2026**,
with no managed backups. This preview still requires durable hosting/recovery,
mail/provider configuration, actual endpoint/root/key provisioning, authenticated
recipient program publication and physical device/site qualification before an
operational production concert release. No field or certification result is
inferred from the live website.
