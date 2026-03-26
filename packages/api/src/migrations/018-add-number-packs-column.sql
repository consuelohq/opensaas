-- add number_packs column to workspace_subscriptions
ALTER TABLE workspace_subscriptions 
ADD COLUMN IF NOT EXISTS number_packs JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN workspace_subscriptions.number_packs IS 'Array of purchased number pack subscriptions: [{ packSize: 5, subscriptionId: "sub_xxx", status: "active" }]';
