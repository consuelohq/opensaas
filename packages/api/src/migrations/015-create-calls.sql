-- calls table: stores call history for analytics, history, and recording lookup
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  call_sid VARCHAR(64),
  conference_name VARCHAR(128),
  recording_sid VARCHAR(64),
  contact_id UUID,
  direction VARCHAR(16),
  status VARCHAR(32),
  outcome VARCHAR(32),
  "from" VARCHAR(32),
  "to" VARCHAR(32),
  duration_seconds INTEGER DEFAULT 0,
  transcript TEXT,
  analysis JSONB,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  parallel_group_id VARCHAR(30),
  parallel_position SMALLINT,
  parallel_outcome VARCHAR(20) DEFAULT 'pending',
  parallel_termination_reason VARCHAR(30),
  parallel_terminated_at TIMESTAMPTZ,
  amd_result VARCHAR(20),
  amd_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_workspace ON calls(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_start_time ON calls(workspace_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_recording ON calls(recording_sid);
CREATE INDEX IF NOT EXISTS idx_calls_parallel_group ON calls(parallel_group_id);
