# Account database backup, restore and restore drill

Scope: the SceneSignal account database (Better Auth users, accounts, sessions,
verification and rate-limit rows, `scene_account_membership`, contribution
events) of the Galinsky Arts preview `scenesignal-preview`
(`srv-dbp5tgom7kps739u7ca0`), stored in Neon project `scenesignal`
(`fancy-night-72553226`, aws-us-east-1, PostgreSQL 17, free plan).

Private music, permits, site details, drafts and media keys never enter this
database: they stay on endpoints. Restoring it restores account access and
session membership only; it never recovers or grants custody of private keys.

## Backups

Neon keeps the write-ahead history of every branch for the project's history
retention window (free plan: short, currently 6 hours to 1 day; check the
project settings). Within that window any point in time can be branched.
For longer protection, create a named branch before risky changes
(`POST /projects/{id}/branches` with a name such as `backup-<reason>-<date>`).
Named branches count against the free plan's branch limit; delete obsolete ones.

## Restore (incident)

1. Stop writes: suspend the Render service (`POST /v1/services/{id}/suspend`).
2. Choose the restore point (timestamp before the incident, or a named backup branch).
3. In Neon, restore the production branch to that point (`POST
   /projects/{id}/branches/{branch}/restore` with `source_branch_id` and
   `source_timestamp`, keeping the pre-restore state as a backup branch), or
   create a branch at that point and repoint `DATABASE_URL` to it.
4. Resume the service. `scripts/render-start.mjs` runs the application migration
   first; `/healthz` must return 200 (it checks the account schema).
5. Verify: sign in with a known account, check session ownership, and record the
   restore in `docs/implementation-status.md`. Sessions created after the restore
   point are gone; affected users sign in again.

Never "restore" by deleting rows by hand. Restoring account rows does not restore
any endpoint key or private draft; those were never on the server.

## Restore drill (non-destructive)

`scripts/restore-drill.mjs` compares a restored copy with the live database:
both read in `REPEATABLE READ READ ONLY` transactions, per table row counts and a
SHA-256 digest of the ordered rows, plus the service's readiness probe on the
copy. It logs names, counts, digests and match flags only. Integration test:
`tests/restore-drill.integration.mjs` (`npm run test:postgres`).

Drill procedure (the preview cannot reach Neon from outside Render, so the drill
runs inside the service start):

1. Create a Neon branch of the production branch at a recent point in time with
   a read-write compute (`POST /projects/{id}/branches`, `parent_timestamp`).
2. Read its connection URI from the Neon API and set it as the Render secret
   `SCENESIGNAL_RESTORE_DRILL_DATABASE_URL`; deploy.
3. The start script runs the migration, then the drill, then starts the service
   normally (a drill problem is logged and never blocks the service). Read the
   `scenesignal-restore-drill` log line.
4. Delete the variable from Render, delete the drill branch in Neon, and record
   the result below. `restored-differs-from-live` is expected only for tables
   written after the restore point (for example `rateLimit`/`session`); a
   missing table or failed readiness probe is a failed drill.

## Drill record

See the dated entries below. Each records the branch point, the deploy and the
logged result exactly as observed.

### 2026-11-17 — first restore drill (passed)

- Restore point: Neon branch `restore-drill-20261117` (`br-wandering-lab-bb3lczla`)
  of `main` at `parent_timestamp` 2026-11-17T02:20:04Z, with its own read-write compute.
- Run: Render deploy `dep-dbtrmadg1s2s73ei5s40` (commit `76835f9`) with
  `SCENESIGNAL_RESTORE_DRILL_DATABASE_URL` set; drill at 02:26:27–02:26:28Z.
- Logged result: `status: restored-matches-live`, `usable: true`, 0 missing,
  0 differing, 0 extra tables. Rows (live = restored, digests equal): `account` 2,
  `rateLimit` 4, `scene_account_membership` 1, `scene_contribution_events` 0,
  `session` 0, `user` 2, `verification` 0. The readiness probe succeeded on the copy.
- Cleanup: the variable was deleted from the service and the drill branch deleted.
- Not exercised: an in-place restore of the production branch (destructive; not
  needed to prove the backup is restorable) and an interactive sign-in against the copy.
