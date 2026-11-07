export const TEAM_ACCESS_MIGRATION_ID = '20261106_018_team_access';
export const TEAM_ACCESS_SCHEMA = `CREATE TABLE IF NOT EXISTS dialer_team_configuration (
 workspace_id text PRIMARY KEY, revision integer NOT NULL CHECK(revision>0), location_id text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
 CREATE TABLE IF NOT EXISTS dialer_team_access (
 workspace_id text NOT NULL, user_id text NOT NULL, enabled boolean NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(workspace_id,user_id));
 CREATE TABLE IF NOT EXISTS dialer_team_access_events (
 workspace_id text NOT NULL, revision integer NOT NULL, actor_id text NOT NULL, user_id text NOT NULL,
 enabled boolean NOT NULL, queue_ids jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,revision));
 DROP TRIGGER IF EXISTS team_access_events_immutable ON dialer_team_access_events;
 CREATE OR REPLACE FUNCTION dialer_team_access_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Team access history is immutable'; END $$;
 CREATE TRIGGER team_access_events_immutable BEFORE UPDATE OR DELETE ON dialer_team_access_events FOR EACH ROW EXECUTE FUNCTION dialer_team_access_immutable();`;
