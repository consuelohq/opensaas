CREATE TABLE IF NOT EXISTS os_install_sessions (
  install_id TEXT PRIMARY KEY,
  user_id TEXT,
  workspace_id TEXT,
  node_id TEXT,
  status TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,
  platform TEXT,
  architecture TEXT,
  channel TEXT,
  release TEXT,
  last_error_code TEXT,
  diagnostic_available INTEGER NOT NULL DEFAULT 0 CHECK (diagnostic_available IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_os_install_sessions_started_at
  ON os_install_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_install_sessions_user_id
  ON os_install_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_install_sessions_node_id
  ON os_install_sessions(node_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_install_sessions_status
  ON os_install_sessions(status, started_at DESC);

CREATE TABLE IF NOT EXISTS os_install_events (
  event_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  producer TEXT NOT NULL,
  name TEXT NOT NULL,
  stage TEXT NOT NULL,
  outcome TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  identity_state TEXT NOT NULL,
  user_id TEXT,
  workspace_id TEXT,
  node_id TEXT,
  context_json TEXT,
  error_code TEXT,
  error_impact TEXT,
  event_json TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_os_install_events_install_timeline
  ON os_install_events(install_id, occurred_at, producer, sequence, event_id);
CREATE INDEX IF NOT EXISTS idx_os_install_events_occurred_at
  ON os_install_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_install_events_error
  ON os_install_events(error_code, stage, occurred_at DESC)
  WHERE error_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS os_install_users (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_os_install_users_created_at
  ON os_install_users(created_at DESC);

CREATE TABLE IF NOT EXISTS os_install_user_workspaces (
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_os_install_user_workspaces_workspace
  ON os_install_user_workspaces(workspace_id, user_id);

CREATE TABLE IF NOT EXISTS os_install_diagnostic_bundles (
  bundle_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_os_install_diagnostic_install
  ON os_install_diagnostic_bundles(install_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_install_diagnostic_expires_at
  ON os_install_diagnostic_bundles(expires_at);

CREATE TABLE IF NOT EXISTS os_install_evidence (
  install_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (install_id, kind, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_os_install_evidence_install
  ON os_install_evidence(install_id, created_at);
