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
