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
