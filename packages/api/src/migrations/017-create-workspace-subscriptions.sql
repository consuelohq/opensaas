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
