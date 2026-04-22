CREATE TABLE profile_posteriors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'workspace')),
  workspace_id UUID NULL,
  profile_id VARCHAR(20) NOT NULL CHECK (profile_id IN ('balanced', 'aggressive', 'conservative')),
  alpha INTEGER NOT NULL DEFAULT 1,
  beta INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_profile_posteriors_scope_workspace_profile
  ON profile_posteriors (
    scope,
    COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
    profile_id
  );

CREATE INDEX idx_profile_posteriors_lookup
  ON profile_posteriors (scope, workspace_id, profile_id);
