// Additive RD1 schema. Each direction is one atomic PostgreSQL statement.
export const INBOUND_MIGRATION_ID = '20260910_006_inbound_journal';
export const CREATE_INBOUND_SCHEMA_SQL = `
DO $migration$ BEGIN
  LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
  CREATE TABLE IF NOT EXISTS dialer_inbound_entities (
    workspace_id text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('request','leg','assignment','bridge','callback','capacity')),
    entity_id text NOT NULL,
    version integer NOT NULL CHECK (version > 0),
    snapshot jsonb NOT NULL,
    PRIMARY KEY (workspace_id, kind, entity_id),
    CHECK ((snapshot->>'schemaVersion' = '1' AND
      snapshot->>'workspaceId' = workspace_id AND snapshot->>'entityId' = entity_id AND
      snapshot->'identity'->>'kind' = kind AND snapshot->>'version' = version::text) IS TRUE)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS dialer_inbound_rep_slot_unique ON dialer_inbound_entities
    (workspace_id, (snapshot->'identity'->>'repId'), (snapshot->'identity'->>'slot'))
    WHERE kind = 'capacity';
  CREATE TABLE IF NOT EXISTS dialer_inbound_links (
    workspace_id text NOT NULL, entity_kind text NOT NULL, entity_id text NOT NULL,
    relation text NOT NULL, target_kind text NOT NULL, target_id text NOT NULL,
    PRIMARY KEY (workspace_id, entity_kind, entity_id, relation),
    FOREIGN KEY (workspace_id, entity_kind, entity_id)
      REFERENCES dialer_inbound_entities(workspace_id, kind, entity_id),
    FOREIGN KEY (workspace_id, target_kind, target_id)
      REFERENCES dialer_inbound_entities(workspace_id, kind, entity_id)
  );
  CREATE TABLE IF NOT EXISTS dialer_inbound_facts (
    workspace_id text NOT NULL, source text NOT NULL, event_key text NOT NULL,
    digest text NOT NULL, fact jsonb NOT NULL, result jsonb,
    PRIMARY KEY (workspace_id, source, event_key)
  );
  CREATE TABLE IF NOT EXISTS dialer_inbound_events (
    sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id text NOT NULL, event_id text NOT NULL,
    kind text NOT NULL, entity_id text NOT NULL,
    source text NOT NULL, event_key text NOT NULL, event jsonb NOT NULL,
    applied boolean NOT NULL,
    UNIQUE (workspace_id, event_id),
    FOREIGN KEY (workspace_id, kind, entity_id)
      REFERENCES dialer_inbound_entities(workspace_id, kind, entity_id),
    FOREIGN KEY (workspace_id, source, event_key)
      REFERENCES dialer_inbound_facts(workspace_id, source, event_key)
  );
  CREATE INDEX IF NOT EXISTS dialer_inbound_replay_idx
    ON dialer_inbound_events(workspace_id, kind, entity_id, sequence);
  CREATE TABLE IF NOT EXISTS dialer_inbound_commands (
    workspace_id text NOT NULL, command_id text NOT NULL, event_id text NOT NULL,
    command jsonb NOT NULL, version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    status text NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','dispatched','unknown','succeeded','failed')),
    PRIMARY KEY (workspace_id, command_id),
    FOREIGN KEY (workspace_id, event_id) REFERENCES dialer_inbound_events(workspace_id, event_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS dialer_inbound_event_command_unique
    ON dialer_inbound_commands(workspace_id, event_id, (command->>'type'));
  CREATE INDEX IF NOT EXISTS dialer_inbound_pending_commands_idx
    ON dialer_inbound_commands(workspace_id, status, command_id);
  CREATE TABLE IF NOT EXISTS dialer_inbound_command_events (
    workspace_id text NOT NULL, command_id text NOT NULL, version integer NOT NULL,
    status text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    reconciled boolean NOT NULL,
    PRIMARY KEY (workspace_id, command_id, version),
    FOREIGN KEY (workspace_id, command_id) REFERENCES dialer_inbound_commands(workspace_id, command_id)
  );
  CREATE TABLE IF NOT EXISTS dialer_inbound_decisions (
    workspace_id text NOT NULL, decision_id text NOT NULL,
    request_kind text NOT NULL DEFAULT 'request' CHECK (request_kind = 'request'),
    request_id text NOT NULL, decision jsonb NOT NULL, source text NOT NULL, event_key text NOT NULL,
    FOREIGN KEY (workspace_id, source, event_key) REFERENCES dialer_inbound_facts(workspace_id, source, event_key),
    PRIMARY KEY (workspace_id, decision_id),
    FOREIGN KEY (workspace_id, request_kind, request_id)
      REFERENCES dialer_inbound_entities(workspace_id, kind, entity_id),
    CHECK ((decision->>'schemaVersion' = '1') IS TRUE)
  );
  INSERT INTO consuelo_dialer_schema_migrations(migration_id)
    VALUES ('20260910_006_inbound_journal') ON CONFLICT DO NOTHING;
END $migration$;
CREATE OR REPLACE FUNCTION dialer_inbound_immutable_history() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Inbound history is immutable'; END $$;
DROP TRIGGER IF EXISTS inbound_events_immutable ON dialer_inbound_events;
CREATE TRIGGER inbound_events_immutable BEFORE UPDATE OR DELETE ON dialer_inbound_events
  FOR EACH ROW EXECUTE FUNCTION dialer_inbound_immutable_history();
DROP TRIGGER IF EXISTS inbound_decisions_immutable ON dialer_inbound_decisions;
CREATE TRIGGER inbound_decisions_immutable BEFORE UPDATE OR DELETE ON dialer_inbound_decisions
  FOR EACH ROW EXECUTE FUNCTION dialer_inbound_immutable_history();
DROP TRIGGER IF EXISTS inbound_command_events_immutable ON dialer_inbound_command_events;
CREATE TRIGGER inbound_command_events_immutable BEFORE UPDATE OR DELETE ON dialer_inbound_command_events
  FOR EACH ROW EXECUTE FUNCTION dialer_inbound_immutable_history();
`;

export const DROP_INBOUND_SCHEMA_SQL = `
DO $$ BEGIN
  LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM consuelo_dialer_schema_migrations
    WHERE migration_id > '20260910_006_inbound_journal') THEN
    RAISE EXCEPTION 'Roll back newer migrations first';
  END IF;
  DROP TABLE IF EXISTS dialer_inbound_decisions, dialer_inbound_command_events,
    dialer_inbound_commands, dialer_inbound_events, dialer_inbound_links,
    dialer_inbound_facts, dialer_inbound_entities;
  DROP FUNCTION IF EXISTS dialer_inbound_immutable_history();
  DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id = '20260910_006_inbound_journal';
END $$;
`;
