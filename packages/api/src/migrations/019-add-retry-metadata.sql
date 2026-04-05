-- 019: persist retry metadata for calls and queue items (DEV-1299)
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS retry_strategy TEXT,
  ADD COLUMN IF NOT EXISTS retry_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_reason TEXT;

ALTER TABLE queue_items
  ADD COLUMN IF NOT EXISTS retry_strategy TEXT,
  ADD COLUMN IF NOT EXISTS retry_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_reason TEXT;
