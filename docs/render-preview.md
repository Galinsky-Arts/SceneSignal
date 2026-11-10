# Render account-enabled preview

The preview is now **live** at https://scenesignal-preview.onrender.com.
Service `srv-dbp5tgom7kps739u7ca0` deploy `dep-dbp5thgm7kps739u7do0` serves
commit `39457a215362605d930ce81667119a8888155bca`; actual browser/API/database
verification is recorded [here](render-deployment-verification-2026-11-10.md).
The owner approved the plan and nonbillable follow-up work without repeated
approval requests. A later Blueprint plan returned `no_changes`.

The owner selected Phillip's Render workspace (`tea-dbp1vrrl550s73c3dgrg`).
`render.yaml` defines one free Node web service in Virginia and the free
PostgreSQL 17 database created for this preview. It must adopt that exact database,
`dpg-dbp5k8k9v7es73am52kg-a`, instead of creating a duplicate. Other workspace
services are outside this Blueprint.

Render generates the account secret and injects the database credentials; no
secret is checked into source. The start script uses Render's documented
`RENDER_EXTERNAL_URL` for the same-origin auth URL and explicitly selects the
database's public endpoint, retaining `sslmode=verify-full` and certificate
verification. Render's internal endpoint has a self-signed certificate, so the
ordinary application refuses it. External database access requires a password
and verified TLS. The initial IP allowlist permits application connections;
restricting it to verified service egress ranges is follow-up deployment work.

The single-instance preview explicitly runs official framework/application
migrations before starting. This is an intentional free-plan release step because
Render's separate pre-deploy command requires paid compute. Migration failure
prevents startup. Ordinary `npm start` still does not migrate automatically.
`/healthz` verifies database schema readiness. Automatic deploys and Blueprint
auto-sync are disabled so later source changes do not deploy without checks.

The resource plans cost $0; no paid upgrade or fallback is authorized. Render's
free database expires on **December 9, 2026** and has no managed backups. Free
web instances sleep after 15 minutes and share 750 monthly hours with the other
workspace services. Bandwidth/build overages depend on workspace billing limits;
the connector cannot inspect or set those limits. This is a preview, not durable
production hosting. Do not use the preview for irreplaceable account data.

Before applying a Blueprint, inspect its concrete resource plan and confirm that
it changes only the intended SceneSignal service and database. Within the owner's
standing nonbillable authorization, continue without re-requesting approval; monitor
the exact deploy to `live`; verify HTTPS `/healthz`, the actual account flow and
the local-only draft boundary. A planned Blueprint or successful build is not
evidence of a live service or physical audio qualification.
