-- 006: call_queues + queue_items tables for queue system (DEV-829)

CREATE TABLE call_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  category TEXT NOT NULL DEFAULT 'all',
  calling_mode TEXT NOT NULL DEFAULT 'browser',
  status TEXT NOT NULL DEFAULT 'idle',
  settings JSONB NOT NULL DEFAULT '{}',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  completed_contacts INTEGER NOT NULL DEFAULT 0,
  skipped_contacts INTEGER NOT NULL DEFAULT 0,
  dnc_filtered_count INTEGER NOT NULL DEFAULT 0,
  aggregated_stats JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES call_queues(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  call_outcome TEXT,
  call_duration_seconds INTEGER,
  skip_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_queue_items_queue_id ON queue_items(queue_id);
CREATE INDEX idx_queue_items_status ON queue_items(status);
CREATE INDEX idx_call_queues_user ON call_queues(user_id, workspace_id);
CREATE INDEX idx_call_queues_status ON call_queues(status);
