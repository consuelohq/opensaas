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
