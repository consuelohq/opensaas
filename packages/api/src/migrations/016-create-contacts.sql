-- contacts table: local contact records for call history joins and queue management
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(32),
  email VARCHAR(255),
  company VARCHAR(255),
  tags TEXT[],
  source VARCHAR(32),
  dnc_status VARCHAR(16) DEFAULT 'allowed',
  address TEXT,
  city VARCHAR(128),
  state VARCHAR(64),
  zip VARCHAR(16),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
