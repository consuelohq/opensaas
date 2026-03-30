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

-- backfill from existing queue_items and calls attempts
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
