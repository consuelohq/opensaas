-- contact notes — quick notes linked to contacts
CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  content TEXT NOT NULL,
  call_id VARCHAR(64),
  created_by VARCHAR(255) NOT NULL,
  workspace_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON contact_notes(contact_id);

-- contact follow-ups — scheduled follow-up reminders
CREATE TABLE IF NOT EXISTS contact_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  call_id VARCHAR(64),
  status VARCHAR(20) DEFAULT 'pending',
  created_by VARCHAR(255) NOT NULL,
  workspace_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_contact ON contact_follow_ups(contact_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON contact_follow_ups(scheduled_at) WHERE status = 'pending';
