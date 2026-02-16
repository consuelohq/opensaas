-- DEV-824: parallel dialing columns on calls table
ALTER TABLE calls ADD COLUMN parallel_group_id VARCHAR(30);
ALTER TABLE calls ADD COLUMN parallel_position SMALLINT;
ALTER TABLE calls ADD COLUMN parallel_outcome VARCHAR(20) DEFAULT 'pending';
ALTER TABLE calls ADD COLUMN parallel_termination_reason VARCHAR(30);
ALTER TABLE calls ADD COLUMN parallel_terminated_at TIMESTAMPTZ;
ALTER TABLE calls ADD COLUMN amd_result VARCHAR(20);
ALTER TABLE calls ADD COLUMN amd_enabled BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_calls_parallel_group ON calls(parallel_group_id);
