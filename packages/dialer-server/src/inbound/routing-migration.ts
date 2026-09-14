export const ROUTING_MIGRATION_ID = '20260913_008_inbound_routing';
export const CREATE_ROUTING_SQL = `
DO $migration$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 CREATE TABLE IF NOT EXISTS dialer_routing_queues(
 workspace_id text NOT NULL, queue_id text NOT NULL, version integer NOT NULL CHECK(version>0), policy jsonb NOT NULL,
 PRIMARY KEY(workspace_id,queue_id),
 CHECK((policy->>'workspaceId'=workspace_id AND policy->>'queueId'=queue_id AND policy->>'schemaVersion'='1') IS TRUE));
 CREATE TABLE IF NOT EXISTS dialer_routing_entries(
 workspace_id text NOT NULL, request_id text NOT NULL, queue_id text NOT NULL,
 entity_kind text NOT NULL DEFAULT 'request' CHECK(entity_kind='request'),
 version integer NOT NULL CHECK(version>0), metadata jsonb NOT NULL,
 routing_state text NOT NULL DEFAULT 'waiting' CHECK(routing_state IN ('waiting','fallback')),
 fallback_decision_id text,
 PRIMARY KEY(workspace_id,request_id),
 FOREIGN KEY(workspace_id,queue_id) REFERENCES dialer_routing_queues(workspace_id,queue_id),
 FOREIGN KEY(workspace_id,entity_kind,request_id) REFERENCES dialer_inbound_entities(workspace_id,kind,entity_id));
 CREATE TABLE IF NOT EXISTS dialer_routing_decisions(
 sequence bigserial UNIQUE NOT NULL, workspace_id text NOT NULL, decision_id text NOT NULL, queue_id text NOT NULL,
 frame jsonb NOT NULL, result jsonb NOT NULL, recorded_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,decision_id),
 FOREIGN KEY(workspace_id,queue_id) REFERENCES dialer_routing_queues(workspace_id,queue_id),
 CHECK((result->>'decisionId'=decision_id AND result->>'workspaceId'=workspace_id AND frame->'evaluation'->>'schemaVersion'='2') IS TRUE));
 CREATE INDEX IF NOT EXISTS dialer_routing_decision_order ON dialer_routing_decisions(workspace_id,queue_id,sequence);
 CREATE INDEX IF NOT EXISTS dialer_routing_entry_queue ON dialer_routing_entries(workspace_id,queue_id,routing_state,request_id);
 DROP TRIGGER IF EXISTS routing_decisions_immutable ON dialer_routing_decisions;
 CREATE TRIGGER routing_decisions_immutable BEFORE UPDATE OR DELETE ON dialer_routing_decisions FOR EACH ROW EXECUTE FUNCTION dialer_inbound_immutable_history();
 INSERT INTO consuelo_dialer_schema_migrations(migration_id) VALUES ('20260913_008_inbound_routing') ON CONFLICT DO NOTHING;
END $migration$;`;
export const DROP_ROUTING_SQL = `
DO $$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM consuelo_dialer_schema_migrations WHERE migration_id>'20260913_008_inbound_routing') THEN
 RAISE EXCEPTION 'Roll back newer migrations first'; END IF;
 LOCK TABLE dialer_routing_queues,dialer_routing_entries,dialer_routing_decisions,dialer_rep_capacity,dialer_inbound_entities IN ACCESS EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM dialer_rep_capacity c JOIN dialer_routing_entries e ON e.workspace_id=c.workspace_id AND e.request_id=c.snapshot->'owner'->>'requestId') THEN
 RAISE EXCEPTION 'Cannot remove routing evidence with owned calls'; END IF;
 IF EXISTS(SELECT 1 FROM dialer_routing_entries entry JOIN dialer_inbound_entities entity ON entity.workspace_id=entry.workspace_id AND entity.entity_id=entry.request_id AND entity.kind='request' WHERE entity.snapshot->>'state' IN ('created','queued','offering','bridging','connected')) THEN
 RAISE EXCEPTION 'Cannot remove routing with active requests'; END IF;
 DROP TABLE dialer_routing_decisions,dialer_routing_entries,dialer_routing_queues;
 DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id='20260913_008_inbound_routing';
END $$;`;
