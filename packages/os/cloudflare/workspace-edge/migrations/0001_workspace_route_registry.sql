CREATE TABLE IF NOT EXISTS workspace_hostname_routes (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_slug TEXT NOT NULL,
  workspace_host TEXT NOT NULL,
  base_domain TEXT NOT NULL,
  route_path_prefix TEXT NOT NULL,
  route_surface TEXT NOT NULL,
  route_status TEXT NOT NULL,
  route_target_kind TEXT NOT NULL,
  target_origin_url TEXT NOT NULL,
  connector_id TEXT,
  connector_status TEXT NOT NULL DEFAULT 'connected',
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_connectors (
  connector_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  workspace_host TEXT NOT NULL,
  transport TEXT NOT NULL,
  local_service_url TEXT NOT NULL,
  connector_status TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_hostname_routes_hostname_path
  ON workspace_hostname_routes(hostname, route_path_prefix);

CREATE INDEX IF NOT EXISTS idx_workspace_hostname_routes_workspace_id
  ON workspace_hostname_routes(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_hostname_routes_connector_id
  ON workspace_hostname_routes(connector_id);

CREATE INDEX IF NOT EXISTS idx_workspace_connectors_workspace_id
  ON workspace_connectors(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_connectors_status
  ON workspace_connectors(connector_status);
