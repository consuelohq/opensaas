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
