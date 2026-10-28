ALTER TABLE os_install_user_workspaces ADD COLUMN verified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_os_install_user_workspaces_verified
  ON os_install_user_workspaces(user_id, verified_at DESC)
  WHERE verified_at IS NOT NULL;
