BEGIN;

-- === 001-create-files.sql ===
-- DEV-744: File storage backend — files + file_attachments tables
-- Phase 6.1: S3-backed file storage with workspace scoping

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  folder VARCHAR(255),
  tags TEXT[],
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_workspace ON files(workspace_id);
CREATE INDEX idx_files_folder ON files(workspace_id, folder);
CREATE INDEX idx_files_mime_type ON files(mime_type);

CREATE TABLE IF NOT EXISTS file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_file_attachments_file ON file_attachments(file_id);
CREATE INDEX idx_file_attachments_entity ON file_attachments(entity_type, entity_id);


-- === 004-create-caller-id-lock-tables.sql ===
-- caller ID locks — prevents concurrent use of the same outbound number
CREATE TABLE IF NOT EXISTS caller_id_locks (
  phone_number VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  call_sid VARCHAR(64) NOT NULL,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_caller_locks_call_sid ON caller_id_locks(call_sid);
CREATE INDEX IF NOT EXISTS idx_caller_locks_user ON caller_id_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_caller_locks_expires ON caller_id_locks(expires_at);

-- area code locations for geo-proximity (local presence)
CREATE TABLE IF NOT EXISTS area_code_locations (
  area_code VARCHAR(5) PRIMARY KEY,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50)
);


-- === 015-create-calls.sql ===
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


-- === 016-create-contacts.sql ===
-- contacts table: local contact records for call history joins and queue management
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(32),
  email VARCHAR(255),
  company VARCHAR(255),
  tags TEXT[],
  source VARCHAR(32),
  dnc_status VARCHAR(16) DEFAULT 'allowed',
  address TEXT,
  city VARCHAR(128),
  state VARCHAR(64),
  zip VARCHAR(16),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);


-- === 005-create-contact-notes-follow-ups.sql ===
-- contact notes — quick notes linked to contacts
CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  content TEXT NOT NULL,
  call_id VARCHAR(64),
  created_by VARCHAR(255) NOT NULL,
  workspace_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON contact_notes(contact_id);

-- contact follow-ups — scheduled follow-up reminders
CREATE TABLE IF NOT EXISTS contact_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  call_id VARCHAR(64),
  status VARCHAR(20) DEFAULT 'pending',
  created_by VARCHAR(255) NOT NULL,
  workspace_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_contact ON contact_follow_ups(contact_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON contact_follow_ups(scheduled_at) WHERE status = 'pending';


-- === 017-create-workspace-subscriptions.sql ===
-- workspace_subscriptions: stripe subscription state per workspace
CREATE TABLE IF NOT EXISTS workspace_subscriptions (
  workspace_id UUID PRIMARY KEY,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'inactive',
  plan_name VARCHAR(64),
  interval VARCHAR(16),
  current_period_end TIMESTAMPTZ,
  add_ons JSONB DEFAULT '[]'::jsonb,
  number_packs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- workspace_usage: metered usage tracking per workspace
CREATE TABLE IF NOT EXISTS workspace_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  metric VARCHAR(64) NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_usage_lookup ON workspace_usage(workspace_id, metric, period_start);


-- === 007-create-user-settings.sql ===
-- user_settings: per-user JSONB preferences (notifications, dialer, display, keyboard)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  workspace_id VARCHAR(255) NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_workspace
  ON user_settings (user_id, workspace_id);


-- === 008-create-workspace-settings.sql ===
-- 008-create-workspace-settings.sql
-- DEV-758: workspace settings — branding, team management, billing

CREATE TABLE IF NOT EXISTS workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL DEFAULT '',
  slug VARCHAR(255) NOT NULL DEFAULT '',
  branding JSONB NOT NULL DEFAULT '{}',
  billing_config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_id ON workspace_settings (workspace_id);

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id VARCHAR(255) NOT NULL,
  user_id UUID,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members (user_id);


-- === 009-create-ghl-connections.sql ===
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


-- === 010-create-assistant-conversations.sql ===
-- DEV-811: assistant conversation history + context management

CREATE TABLE IF NOT EXISTS assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  commands_executed JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation ON assistant_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user ON assistant_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_workspace ON assistant_conversations(workspace_id);


-- === 011-create-ghl-pipeline-mappings.sql ===
-- GHL pipeline stage mappings (GHL stages → Twenty stages)
CREATE TABLE IF NOT EXISTS ghl_pipeline_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  ghl_pipeline_id VARCHAR(255) NOT NULL,
  ghl_stage_id VARCHAR(255) NOT NULL,
  twenty_pipeline_id UUID NOT NULL,
  twenty_stage_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, ghl_stage_id)
);

CREATE INDEX idx_ghl_pipeline_mappings_workspace ON ghl_pipeline_mappings(workspace_id);

-- GHL opportunity sync tracking
CREATE TABLE IF NOT EXISTS ghl_opportunity_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  ghl_opportunity_id VARCHAR(255) NOT NULL,
  ghl_pipeline_id VARCHAR(255) NOT NULL,
  ghl_stage_id VARCHAR(255) NOT NULL,
  twenty_pipeline_id UUID NOT NULL,
  twenty_stage_id UUID NOT NULL,
  ghl_contact_id VARCHAR(255),
  monetary_value NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, ghl_opportunity_id)
);

CREATE INDEX idx_ghl_opportunity_sync_workspace ON ghl_opportunity_sync(workspace_id);


-- === 013-create-ghl-sync-mappings.sql ===
-- GHL sync mappings table for contact synchronization
CREATE TABLE IF NOT EXISTS ghl_sync_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    ghl_contact_id VARCHAR(255) NOT NULL,
    twenty_person_id UUID NOT NULL,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, ghl_contact_id)
);

CREATE INDEX IF NOT EXISTS idx_ghl_sync_mappings_workspace ON ghl_sync_mappings (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ghl_sync_mappings_ghl_contact ON ghl_sync_mappings (ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_ghl_sync_mappings_twenty_person ON ghl_sync_mappings (twenty_person_id);

-- GHL sync log table for tracking sync operations
CREATE TABLE IF NOT EXISTS ghl_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    sync_type VARCHAR(50) NOT NULL, -- 'import', 'incremental', 'webhook'
    status VARCHAR(50) NOT NULL, -- 'pending', 'completed', 'failed', 'partial'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_contacts INTEGER DEFAULT 0,
    imported_count INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_ghl_sync_logs_workspace ON ghl_sync_logs (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ghl_sync_logs_started_at ON ghl_sync_logs (started_at DESC);


-- === 014-ghl-schema-fixes.sql ===
-- GHL webhook events table for idempotency checking
CREATE TABLE IF NOT EXISTS ghl_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    location_id VARCHAR(255) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghl_webhook_events_location ON ghl_webhook_events (location_id);

-- Add disconnected_at column to ghl_connections (used by webhook handler)
ALTER TABLE ghl_connections ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;


-- === 003-file-attachments-unique.sql ===
-- DEV-749: Add unique constraint to prevent duplicate file attachments
-- and implement file CRUD (completing the 501 stubs from DEV-744)

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_attachments_unique
  ON file_attachments (file_id, entity_type, entity_id);


-- === 012-add-call-history-indexes.sql ===
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


-- === 006-create-call-queues.sql ===
CREATE TABLE IF NOT EXISTS call_queues (
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
CREATE TABLE IF NOT EXISTS queue_items (
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
CREATE INDEX IF NOT EXISTS idx_queue_items_queue_id ON queue_items(queue_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status);
CREATE INDEX IF NOT EXISTS idx_call_queues_user ON call_queues(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_call_queues_status ON call_queues(status);
CREATE INDEX IF NOT EXISTS idx_call_queues_workspace ON call_queues(workspace_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_contact ON queue_items(contact_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_queue_status ON queue_items(queue_id, status);

-- === workspace_twilio_config.sql ===
CREATE TABLE IF NOT EXISTS workspace_twilio_config (
  workspace_id UUID PRIMARY KEY,
  mode VARCHAR(10) NOT NULL DEFAULT 'hosted' CHECK (mode IN ('hosted', 'byok')),
  sub_account_sid VARCHAR(255),
  sub_account_token_encrypted TEXT,
  byok_account_sid_encrypted TEXT,
  byok_auth_token_encrypted TEXT,
  byok_api_key_encrypted TEXT,
  byok_api_secret_encrypted TEXT,
  twiml_app_sid VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === 002-knowledge-base (no pgvector) ===
CREATE TABLE IF NOT EXISTS knowledge_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  chunk_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_collections_workspace ON knowledge_collections(workspace_id);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chunks_collection ON knowledge_chunks(collection_id);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON knowledge_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON knowledge_chunks USING gin (metadata jsonb_path_ops);

ALTER TABLE files ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ;
ALTER TABLE files ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES knowledge_collections(id);

-- 019: contact attempt ledger for cadence suppression (DEV-1904)
CREATE TABLE IF NOT EXISTS contact_attempt_ledger (
  workspace_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  attempts_total INTEGER NOT NULL DEFAULT 0,
  attempts_today INTEGER NOT NULL DEFAULT 0,
  attempts_this_week INTEGER NOT NULL DEFAULT 0,
  outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  day_window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('day', NOW()),
  week_window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('week', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_attempt_ledger_last_attempt
  ON contact_attempt_ledger(workspace_id, last_attempt_at DESC);

WITH queue_attempts AS (
  SELECT
    cq.workspace_id,
    qi.contact_id,
    COALESCE(qi.last_attempt_at, qi.created_at) AS attempted_at,
    qi.call_outcome AS outcome
  FROM queue_items qi
  JOIN call_queues cq ON cq.id = qi.queue_id
  WHERE qi.last_attempt_at IS NOT NULL
),
call_attempts AS (
  SELECT
    calls.workspace_id::text AS workspace_id,
    calls.contact_id::text AS contact_id,
    COALESCE(calls.start_time, calls.created_at) AS attempted_at,
    calls.outcome
  FROM calls
  WHERE calls.contact_id IS NOT NULL
    AND (calls.start_time IS NOT NULL OR calls.created_at IS NOT NULL)
),
all_attempts AS (
  SELECT * FROM queue_attempts
  UNION ALL
  SELECT * FROM call_attempts
)
INSERT INTO contact_attempt_ledger (
  workspace_id,
  contact_id,
  last_attempt_at,
  attempts_total,
  attempts_today,
  attempts_this_week,
  outcomes,
  day_window_start,
  week_window_start
)
SELECT
  workspace_id,
  contact_id,
  MAX(attempted_at) AS last_attempt_at,
  COUNT(*)::int AS attempts_total,
  COUNT(*) FILTER (WHERE attempted_at >= date_trunc('day', NOW()))::int AS attempts_today,
  COUNT(*) FILTER (WHERE attempted_at >= date_trunc('week', NOW()))::int AS attempts_this_week,
  COALESCE(
    jsonb_agg(outcome ORDER BY attempted_at DESC)
      FILTER (WHERE outcome IS NOT NULL),
    '[]'::jsonb
  ) AS outcomes,
  date_trunc('day', NOW()) AS day_window_start,
  date_trunc('week', NOW()) AS week_window_start
FROM all_attempts
GROUP BY workspace_id, contact_id
ON CONFLICT (workspace_id, contact_id) DO UPDATE
SET
  last_attempt_at = EXCLUDED.last_attempt_at,
  attempts_total = EXCLUDED.attempts_total,
  attempts_today = EXCLUDED.attempts_today,
  attempts_this_week = EXCLUDED.attempts_this_week,
  outcomes = EXCLUDED.outcomes,
  day_window_start = EXCLUDED.day_window_start,
  week_window_start = EXCLUDED.week_window_start,
  updated_at = NOW();

COMMIT;

-- === 019-create-workspace-phone-numbers.sql ===
CREATE TABLE IF NOT EXISTS workspace_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  friendly_name VARCHAR(255) NOT NULL DEFAULT '',
  area_code VARCHAR(8) NOT NULL DEFAULT '',
  twilio_sid VARCHAR(64) NOT NULL UNIQUE,
  ownership_type VARCHAR(32) NOT NULL DEFAULT 'included',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_phone_numbers_workspace_status
  ON workspace_phone_numbers (workspace_id, status);

ALTER TABLE workspace_subscriptions
ADD COLUMN IF NOT EXISTS phone_number_add_ons JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN workspace_subscriptions.phone_number_add_ons IS 'Array of single-number add-on subscriptions: [{ quantity: 1, subscriptionId: "sub_xxx", status: "active" }]';
