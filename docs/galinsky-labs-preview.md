# Galinsky Labs account-enabled preview

This is a free ($0), durable replacement for the earlier preview, whose Render
database expires December 9, 2026. It runs in the **Galinsky Labs** Render
workspace and Neon organization only. Phillip's personal workspace and its
`scenesignal-preview` service are not touched by this configuration.

| Resource | Configuration |
| --- | --- |
| Render web service | `scenesignal`, free, Ohio, Node 24.19.0, from `main` of `Galinsky-Arts/SceneSignal`, auto-deploy off |
| Account database | Neon project `scenesignal` (`aws-us-east-2`, PostgreSQL 17, free), database `scenesignal`, role `scenesignal_app` |
| Live service | https://scenesignal.onrender.com, `srv-dbsflm0n74is739o3720` |
| Neon project | `mute-smoke-44149367`, branch `br-summer-rain-begki9om`, endpoint `ep-solitary-frog-be6t6ga8` |
| Declarative record | [`render.galinsky-labs.yaml`](../render.galinsky-labs.yaml) |

## Configuration and secrets

- `BETTER_AUTH_SECRET` is generated randomly when the service is created and
  exists only in Render's environment settings.
- `DATABASE_URL` is the Neon direct (non-pooled) connection string, entered as a
  Render secret. It is never committed. `scripts/render-start.mjs` accepts it only
  when it names a public DNS host, replaces provider hints such as
  `sslmode=require`/`channel_binding` with `sslmode=verify-full`, and the
  application keeps certificate verification. Neon's certificate chains to a
  public CA, so no private CA or disabled verification is involved.
- `POSTGRES_EXTERNAL_HOST` stays unset here; it is used only by the Render-database
  mode in `render.yaml`, which keeps working unchanged.
- Password-reset mail stays disabled until the owner adds `RESEND_API_KEY` and
  `SCENESIGNAL_MAIL_FROM` (see [account service](account-service.md)).

## Deploying a change

Auto-deploy is off. After a PR merges with all hosted checks green, trigger a
deploy of the exact `main` commit. The build runs `npm run check`. The start script
applies the official migrations and fails closed if they do not complete. Then
check `/healthz` and run the browser account flows.

## Limits

Free Render instances sleep after 15 minutes idle and take time to wake.
The Neon free plan suspends compute when idle, and has storage and compute-hour
limits; it is not a backed-up production database. Restore/retention drills,
mail delivery, endpoint key provisioning and physical qualification remain
separate acceptance work. The live verification record is dated and kept with
the other deployment records: [November 15, 2026](render-deployment-verification-2026-11-15.md).
