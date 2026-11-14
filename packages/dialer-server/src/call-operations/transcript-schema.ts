export const TRANSCRIPT_TIMING_MIGRATION_ID =
  '20261113_020_transcript_timing_outbox';

// Forward-only: retain existing transcript rows and add delivery references, never audio.
export const TRANSCRIPT_TIMING_SCHEMA_SQL = `
ALTER TABLE dialer_transcript_segments ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS transcript_coverage TEXT;
ALTER TABLE dialer_call_sessions ADD COLUMN IF NOT EXISTS transcript_cursor BIGINT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS dialer_transcript_outbox (
  workspace_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  cursor BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  PRIMARY KEY (workspace_id, event_id),
  UNIQUE (workspace_id, session_id, cursor),
  FOREIGN KEY (workspace_id, session_id)
    REFERENCES dialer_call_sessions(workspace_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS dialer_transcript_outbox_pending_idx
  ON dialer_transcript_outbox(workspace_id, session_id, cursor) WHERE delivered_at IS NULL;
`;
