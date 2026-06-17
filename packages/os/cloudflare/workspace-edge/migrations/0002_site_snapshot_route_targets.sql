ALTER TABLE workspace_route_registry RENAME TO workspace_route_registry_legacy;

CREATE TABLE workspace_route_registry (
  hostname TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  workspace_slug TEXT NOT NULL,
  workspace_host TEXT NOT NULL,
  base_domain TEXT NOT NULL,
  route_path_prefix TEXT NOT NULL,
  route_surface TEXT NOT NULL CHECK (route_surface IN ('os', 'dialer', 'app', 'sites', 'twenty')),
  route_status TEXT NOT NULL CHECK (route_status IN ('active', 'disabled')),
  route_target_kind TEXT NOT NULL CHECK (route_target_kind IN ('service-upstream', 'os-connector', 'site-snapshot')),
  target_origin_url TEXT NOT NULL,
  connector_id TEXT,
  connector_status TEXT CHECK (connector_status IN ('connected', 'disconnected') OR connector_status IS NULL),
  record_json TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connector_id) REFERENCES workspace_connectors(connector_id)
);

INSERT INTO workspace_route_registry (
  hostname,
  workspace_id,
  workspace_slug,
  workspace_host,
  base_domain,
  route_path_prefix,
  route_surface,
  route_status,
  route_target_kind,
  target_origin_url,
  connector_id,
  connector_status,
  record_json,
  revoked_at,
  created_at,
  updated_at
)
SELECT
  hostname,
  workspace_id,
  workspace_slug,
  workspace_host,
  base_domain,
  route_path_prefix,
  route_surface,
  route_status,
  route_target_kind,
  target_origin_url,
  connector_id,
  connector_status,
  record_json,
  revoked_at,
  created_at,
  updated_at
FROM workspace_route_registry_legacy;

DROP TABLE workspace_route_registry_legacy;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_route_registry_hostname_path
  ON workspace_route_registry(hostname, route_path_prefix);
CREATE INDEX IF NOT EXISTS idx_workspace_route_registry_workspace_id
  ON workspace_route_registry(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_route_registry_connector_id
  ON workspace_route_registry(connector_id);
CREATE INDEX IF NOT EXISTS idx_workspace_route_registry_workspace_connector
  ON workspace_route_registry(workspace_id, connector_id);
