-- DEV-856: Add indexes for call history queries

-- For workspace filtering (most queries)
CREATE INDEX IF NOT EXISTS idx_calls_workspace_start_time ON calls(workspace_id, start_time DESC);

-- For outcome filtering
CREATE INDEX IF NOT EXISTS idx_calls_workspace_outcome ON calls(workspace_id, outcome) WHERE outcome IS NOT NULL;

-- For date range filtering
CREATE INDEX IF NOT EXISTS idx_calls_workspace_date ON calls(workspace_id, start_time);

-- For contact_id filtering
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id) WHERE contact_id IS NOT NULL;

-- Composite index for history endpoint
CREATE INDEX IF NOT EXISTS idx_calls_history_query ON calls(workspace_id, outcome, start_time, contact_id);
