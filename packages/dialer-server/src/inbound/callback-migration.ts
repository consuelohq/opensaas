export const CALLBACK_MIGRATION_ID = '20260913_010_callback_obligations';
export const CREATE_CALLBACK_SQL = `
DO $migration$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 CREATE TABLE IF NOT EXISTS dialer_callback_obligations(
  workspace_id text NOT NULL,
  callback_id text NOT NULL,
  request_id text NOT NULL,
  source_request_id text,
  queue_id text NOT NULL,
  number_id text NOT NULL,
  version integer NOT NULL CHECK(version > 0),
  state jsonb NOT NULL,
  policy jsonb NOT NULL,
  recipient_ciphertext text,
  recipient_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,callback_id),
  UNIQUE(workspace_id,request_id),
  CHECK ((state->>'schemaVersion'='1' AND state->>'workspaceId'=workspace_id
    AND state->>'callbackId'=callback_id AND state->>'requestId'=request_id
    AND state->>'queueId'=queue_id AND state->>'version'=version::text) IS TRUE),
  CHECK ((policy->>'schemaVersion'='1') IS TRUE)
 );
 CREATE INDEX IF NOT EXISTS dialer_callback_due_idx ON dialer_callback_obligations
  (workspace_id,queue_id,(state->>'status'),(state->>'notBefore'),callback_id);
 CREATE INDEX IF NOT EXISTS dialer_callback_recipient_retention_idx ON dialer_callback_obligations
  (recipient_expires_at) WHERE recipient_ciphertext IS NOT NULL;
 CREATE TABLE IF NOT EXISTS dialer_callback_events(
  workspace_id text NOT NULL,
  callback_id text NOT NULL,
  operation_id text NOT NULL,
  version integer NOT NULL CHECK(version > 0),
  action jsonb NOT NULL,
  snapshot jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,operation_id),
  UNIQUE(workspace_id,callback_id,version),
  FOREIGN KEY(workspace_id,callback_id)
   REFERENCES dialer_callback_obligations(workspace_id,callback_id)
 );
 CREATE INDEX IF NOT EXISTS dialer_callback_replay_idx ON dialer_callback_events
  (workspace_id,callback_id,version);
 CREATE TABLE IF NOT EXISTS dialer_callback_effects(
  workspace_id text NOT NULL,
  callback_id text NOT NULL,
  attempt_id text NOT NULL,
  effect_kind text NOT NULL CHECK(effect_kind IN ('rep_bridge','customer_dial','terminate_rep','terminate_customer')),
  command_id text NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','dispatched','unknown','succeeded','failed')),
  call_sid text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,callback_id,attempt_id,effect_kind),
  FOREIGN KEY(workspace_id,callback_id)
   REFERENCES dialer_callback_obligations(workspace_id,callback_id)
 );
 CREATE INDEX IF NOT EXISTS dialer_callback_effect_command_idx ON dialer_callback_effects
  (workspace_id,command_id,status);
 CREATE TABLE IF NOT EXISTS dialer_callback_bookings(
  workspace_id text NOT NULL,
  callback_id text NOT NULL,
  revision integer NOT NULL CHECK(revision > 0),
  status text NOT NULL CHECK(status IN ('unavailable','requested','confirmed','cancelled')),
  provider_reference text,
  evidence_reference text,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,callback_id,revision),
  FOREIGN KEY(workspace_id,callback_id)
   REFERENCES dialer_callback_obligations(workspace_id,callback_id),
  CHECK ((status='confirmed') = (provider_reference IS NOT NULL AND evidence_reference IS NOT NULL))
 );
 CREATE OR REPLACE FUNCTION dialer_callback_immutable_history() RETURNS trigger
 LANGUAGE plpgsql AS $history$ BEGIN RAISE EXCEPTION 'Callback history is immutable'; END $history$;
 DROP TRIGGER IF EXISTS dialer_callback_events_immutable ON dialer_callback_events;
 CREATE TRIGGER dialer_callback_events_immutable BEFORE UPDATE OR DELETE ON dialer_callback_events
  FOR EACH ROW EXECUTE FUNCTION dialer_callback_immutable_history();
 DROP TRIGGER IF EXISTS dialer_callback_bookings_immutable ON dialer_callback_bookings;
 CREATE TRIGGER dialer_callback_bookings_immutable BEFORE UPDATE OR DELETE ON dialer_callback_bookings
  FOR EACH ROW EXECUTE FUNCTION dialer_callback_immutable_history();
 INSERT INTO consuelo_dialer_schema_migrations(migration_id)
  VALUES ('20260913_010_callback_obligations') ON CONFLICT DO NOTHING;
END $migration$;`;

export const DROP_CALLBACK_SQL = `
DO $$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM consuelo_dialer_schema_migrations
   WHERE migration_id>'20260913_010_callback_obligations') THEN
  RAISE EXCEPTION 'Roll back newer migrations first';
 END IF;
 LOCK TABLE dialer_callback_obligations IN ACCESS EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM dialer_callback_obligations
   WHERE state->>'status' NOT IN ('fulfilled','cancelled','exhausted','expired'))
 OR EXISTS(SELECT 1 FROM dialer_callback_obligations WHERE recipient_ciphertext IS NOT NULL)
 THEN RAISE EXCEPTION 'Drain callbacks and purge retained recipients before rollback';
 END IF;
 DROP TABLE dialer_callback_bookings,dialer_callback_effects,dialer_callback_events,dialer_callback_obligations;
 DROP FUNCTION dialer_callback_immutable_history();
 DELETE FROM consuelo_dialer_schema_migrations
  WHERE migration_id='20260913_010_callback_obligations';
END $$;`;
