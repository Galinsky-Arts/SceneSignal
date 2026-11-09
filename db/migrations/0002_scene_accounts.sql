-- Identity routing/authorization metadata only. No permits, location, keys or media.
CREATE TABLE IF NOT EXISTS scene_account_membership (
  tenant_id text NOT NULL,
  session_id text NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('organizer','performer','operator','steward','contributor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, session_id, user_id)
);
CREATE INDEX IF NOT EXISTS scene_account_membership_user
  ON scene_account_membership(user_id, created_at);
