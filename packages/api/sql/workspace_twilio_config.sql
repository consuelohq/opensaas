-- NOTE: This CHECK constraint only applies to new databases.
-- For existing databases, a migration is required to add the constraint.
-- See: packages/api/src/migrations/ for migration files.

-- workspace_twilio_config: per-workspace twilio credentials
-- supports hosted (sub-account) and BYOK (user's own creds) modes
CREATE TABLE IF NOT EXISTS workspace_twilio_config (
  workspace_id UUID PRIMARY KEY REFERENCES core."workspace"(id),
  mode VARCHAR(10) NOT NULL DEFAULT 'hosted' CHECK (mode IN ('hosted', 'byok')),
  -- hosted mode: sub-account provisioned by consuelo
  sub_account_sid VARCHAR(255),
  sub_account_token_encrypted TEXT,
  -- byok mode: user's own credentials
  byok_account_sid_encrypted TEXT,
  byok_auth_token_encrypted TEXT,
  byok_api_key_encrypted TEXT,
  byok_api_secret_encrypted TEXT,
  -- shared
  twiml_app_sid VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- enforce credential completeness based on mode
  CONSTRAINT twilio_credentials_mode_check CHECK (
    (mode = 'hosted' AND sub_account_sid IS NOT NULL AND sub_account_token_encrypted IS NOT NULL) OR
    (mode = 'byok' AND byok_account_sid_encrypted IS NOT NULL AND byok_auth_token_encrypted IS NOT NULL AND byok_api_key_encrypted IS NOT NULL AND byok_api_secret_encrypted IS NOT NULL)
  )
);
