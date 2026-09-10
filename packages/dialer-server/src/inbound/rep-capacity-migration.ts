export const REP_CAPACITY_MIGRATION_ID = '20260910_007_rep_capacity';
export const CREATE_REP_CAPACITY_SQL = `
DO $migration$ BEGIN
  LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
  CREATE TABLE IF NOT EXISTS dialer_rep_capacity (
    workspace_id text NOT NULL, capacity_id text NOT NULL, rep_id text NOT NULL,
    entity_kind text NOT NULL DEFAULT 'capacity' CHECK (entity_kind='capacity'),
    version integer NOT NULL CHECK(version>0), snapshot jsonb NOT NULL,
    PRIMARY KEY(workspace_id,capacity_id), UNIQUE(workspace_id,rep_id),
    FOREIGN KEY(workspace_id,entity_kind,capacity_id)
      REFERENCES dialer_inbound_entities(workspace_id,kind,entity_id),
    CHECK ((snapshot->>'schemaVersion'='1' AND snapshot->>'workspaceId'=workspace_id
      AND snapshot->>'capacityId'=capacity_id AND snapshot->>'repId'=rep_id
      AND snapshot->>'version'=version::text) IS TRUE)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS dialer_rep_capacity_request_owner
    ON dialer_rep_capacity(workspace_id,(snapshot->'owner'->>'requestId'))
    WHERE snapshot->'owner'->>'requestId' IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS dialer_rep_capacity_assignment_owner
    ON dialer_rep_capacity(workspace_id,(snapshot->'owner'->>'assignmentId'))
    WHERE snapshot->'owner'->>'assignmentId' IS NOT NULL;
  CREATE TABLE IF NOT EXISTS dialer_rep_capacity_events (
    workspace_id text NOT NULL, capacity_id text NOT NULL, operation_id text NOT NULL,
    version integer NOT NULL CHECK(version>0), digest text NOT NULL,
    event jsonb NOT NULL, snapshot jsonb NOT NULL,
    PRIMARY KEY(workspace_id,capacity_id,version), UNIQUE(workspace_id,operation_id),
    FOREIGN KEY(workspace_id,capacity_id) REFERENCES dialer_rep_capacity(workspace_id,capacity_id),
    CHECK ((event->>'schemaVersion'='1' AND event->>'workspaceId'=workspace_id
      AND event->>'capacityId'=capacity_id AND event->>'operationId'=operation_id
      AND snapshot->>'version'=version::text) IS TRUE)
  );
  DROP TRIGGER IF EXISTS rep_capacity_events_immutable ON dialer_rep_capacity_events;
  CREATE TRIGGER rep_capacity_events_immutable BEFORE UPDATE OR DELETE ON dialer_rep_capacity_events
    FOR EACH ROW EXECUTE FUNCTION dialer_inbound_immutable_history();
  INSERT INTO consuelo_dialer_schema_migrations(migration_id)
    VALUES ('20260910_007_rep_capacity') ON CONFLICT DO NOTHING;
END $migration$;
`;
export const DROP_REP_CAPACITY_SQL = `
DO $$ BEGIN
  LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM consuelo_dialer_schema_migrations WHERE migration_id > '20260910_007_rep_capacity') THEN
    RAISE EXCEPTION 'Roll back newer migrations first';
  END IF;
  LOCK TABLE dialer_rep_capacity_events, dialer_rep_capacity IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM dialer_rep_capacity WHERE snapshot->'owner' <> 'null'::jsonb) THEN
    RAISE EXCEPTION 'Cannot remove capacity authority with owned calls';
  END IF;
  DROP TABLE IF EXISTS dialer_rep_capacity_events, dialer_rep_capacity;
  DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id='20260910_007_rep_capacity';
END $$;
`;
