export const TELEPHONY_MIGRATION_ID = '20260913_009_inbound_telephony';
export const CREATE_TELEPHONY_SQL = `
DO $migration$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 CREATE TABLE IF NOT EXISTS dialer_telephony_configuration(workspace_id text PRIMARY KEY,digest text NOT NULL);
 CREATE TABLE IF NOT EXISTS dialer_telephony_sessions(
 workspace_id text NOT NULL, request_id text NOT NULL, number_id text NOT NULL, queue_id text NOT NULL,
 caller_sid text NOT NULL, conference_name text NOT NULL, fallback_at timestamptz,
 mode text NOT NULL DEFAULT 'waiting' CHECK(mode IN ('waiting','callback_requested','voicemail','ended')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,request_id), UNIQUE(caller_sid));
 CREATE TABLE IF NOT EXISTS dialer_telephony_effects(
 workspace_id text NOT NULL, effect_id text NOT NULL, request_id text NOT NULL,
 assignment_id text NOT NULL, command_id text NOT NULL, endpoint_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('offer','bridge_caller','bridge_rep','terminate')),
 status text NOT NULL CHECK(status IN ('pending','dispatched','unknown','succeeded','failed')),
 call_sid text, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,effect_id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES dialer_telephony_sessions(workspace_id,request_id));
 CREATE INDEX IF NOT EXISTS dialer_telephony_effect_owner ON dialer_telephony_effects(workspace_id,assignment_id);
 CREATE TABLE IF NOT EXISTS dialer_telephony_facts(
 workspace_id text NOT NULL, fact_id text NOT NULL, request_id text NOT NULL, classification text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(workspace_id,fact_id));
 CREATE OR REPLACE FUNCTION dialer_telephony_immutable_fact() RETURNS trigger LANGUAGE plpgsql AS $fact$
 BEGIN RAISE EXCEPTION 'Telephony facts are immutable'; END $fact$;
 DROP TRIGGER IF EXISTS dialer_telephony_fact_immutable ON dialer_telephony_facts;
 CREATE TRIGGER dialer_telephony_fact_immutable BEFORE UPDATE OR DELETE ON dialer_telephony_facts
 FOR EACH ROW EXECUTE FUNCTION dialer_telephony_immutable_fact();
 CREATE TABLE IF NOT EXISTS dialer_telephony_voicemail(
 workspace_id text NOT NULL, recording_sid text NOT NULL, request_id text NOT NULL,
 expires_at timestamptz NOT NULL, deleted_at timestamptz,
 PRIMARY KEY(workspace_id,recording_sid),
 FOREIGN KEY(workspace_id,request_id) REFERENCES dialer_telephony_sessions(workspace_id,request_id));
 CREATE TABLE IF NOT EXISTS dialer_telephony_dispositions(
 workspace_id text NOT NULL, assignment_id text NOT NULL, rep_id text NOT NULL, disposition text NOT NULL, note text,
 PRIMARY KEY(workspace_id,assignment_id));
 CREATE TABLE IF NOT EXISTS dialer_telephony_outbound(
 workspace_id text NOT NULL, session_id text NOT NULL, request_id text NOT NULL, capacity_id text NOT NULL,
 assignment_id text NOT NULL, command_id text NOT NULL, generation integer NOT NULL,
 planned_calls integer NOT NULL CHECK(planned_calls BETWEEN 1 AND 20), call_sids text[] NOT NULL DEFAULT '{}',
 rep_sid text, group_id text, conference_name text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), end_requested_at timestamptz,
 status text NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','succeeded','unknown','ended')),
 PRIMARY KEY(workspace_id,session_id));
 INSERT INTO consuelo_dialer_schema_migrations(migration_id) VALUES ('20260913_009_inbound_telephony') ON CONFLICT DO NOTHING;
END $migration$;`;
export const DROP_TELEPHONY_SQL = `
DO $$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM consuelo_dialer_schema_migrations WHERE migration_id>'20260913_009_inbound_telephony') THEN
 RAISE EXCEPTION 'Roll back newer migrations first'; END IF;
 LOCK TABLE dialer_telephony_outbound,dialer_telephony_sessions,dialer_telephony_effects,dialer_telephony_voicemail,dialer_rep_capacity IN ACCESS EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM dialer_telephony_outbound WHERE status<>'ended')
 OR EXISTS(SELECT 1 FROM dialer_telephony_effects WHERE status IN ('pending','dispatched','unknown'))
 OR EXISTS(SELECT 1 FROM dialer_telephony_sessions WHERE mode <> 'ended')
 OR EXISTS(SELECT 1 FROM dialer_telephony_voicemail WHERE deleted_at IS NULL)
 OR EXISTS(SELECT 1 FROM dialer_rep_capacity c JOIN dialer_telephony_outbound o ON c.workspace_id=o.workspace_id AND c.snapshot->'owner'->>'assignmentId'=o.assignment_id)
 OR EXISTS(SELECT 1 FROM dialer_rep_capacity c JOIN dialer_telephony_sessions s ON c.workspace_id=s.workspace_id AND c.snapshot->'owner'->>'requestId'=s.request_id)
 THEN RAISE EXCEPTION 'Drain and reconcile telephony before rollback'; END IF;
 DROP TABLE dialer_telephony_configuration,dialer_telephony_dispositions,dialer_telephony_outbound,dialer_telephony_voicemail,dialer_telephony_facts,dialer_telephony_effects,dialer_telephony_sessions;
 DROP FUNCTION dialer_telephony_immutable_fact();
 DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id='20260913_009_inbound_telephony';
END $$;`;
