-- caller ID locks — prevents concurrent use of the same outbound number
CREATE TABLE IF NOT EXISTS caller_id_locks (
  phone_number VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  call_sid VARCHAR(64) NOT NULL,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_caller_locks_call_sid ON caller_id_locks(call_sid);
CREATE INDEX IF NOT EXISTS idx_caller_locks_user ON caller_id_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_caller_locks_expires ON caller_id_locks(expires_at);

-- area code locations for geo-proximity (local presence)
CREATE TABLE IF NOT EXISTS area_code_locations (
  area_code VARCHAR(5) PRIMARY KEY,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50)
);
