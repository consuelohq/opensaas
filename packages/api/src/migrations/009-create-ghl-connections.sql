-- GHL OAuth connections and sync infrastructure
CREATE TABLE IF NOT EXISTS ghl_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE,
  location_id VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT true
);

CREATE INDEX idx_ghl_connections_workspace ON ghl_connections (workspace_id);
