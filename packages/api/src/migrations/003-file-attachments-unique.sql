-- DEV-749: Add unique constraint to prevent duplicate file attachments
-- and implement file CRUD (completing the 501 stubs from DEV-744)

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_attachments_unique
  ON file_attachments (file_id, entity_type, entity_id);
