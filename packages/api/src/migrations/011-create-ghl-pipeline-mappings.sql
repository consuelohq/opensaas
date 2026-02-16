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
