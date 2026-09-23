export const CALLBACK_BOOKING_ATTEMPTS_MIGRATION_ID =
  '20260921_013_callback_booking_attempts';

export const CREATE_CALLBACK_BOOKING_ATTEMPTS_SQL = `
DO $migration$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 CREATE TABLE IF NOT EXISTS dialer_callback_booking_attempts(
  workspace_id text NOT NULL,
  callback_id text NOT NULL,
  revision integer NOT NULL CHECK(revision > 0),
  request jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,callback_id,revision),
  FOREIGN KEY(workspace_id,callback_id)
   REFERENCES dialer_callback_obligations(workspace_id,callback_id)
 );
 DROP TRIGGER IF EXISTS dialer_callback_booking_attempts_immutable ON dialer_callback_booking_attempts;
 CREATE TRIGGER dialer_callback_booking_attempts_immutable BEFORE UPDATE OR DELETE ON dialer_callback_booking_attempts
  FOR EACH ROW EXECUTE FUNCTION dialer_callback_immutable_history();
 INSERT INTO consuelo_dialer_schema_migrations(migration_id)
  VALUES ('20260921_013_callback_booking_attempts') ON CONFLICT DO NOTHING;
END $migration$;`;

export const DROP_CALLBACK_BOOKING_ATTEMPTS_SQL = `
DO $$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM consuelo_dialer_schema_migrations
  WHERE migration_id>'20260921_013_callback_booking_attempts') THEN
  RAISE EXCEPTION 'Roll back newer migrations first';
 END IF;
 LOCK TABLE dialer_callback_booking_attempts IN ACCESS EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM dialer_callback_booking_attempts) THEN
  RAISE EXCEPTION 'Retain callback booking attempt evidence before rollback';
 END IF;
 DROP TABLE dialer_callback_booking_attempts;
 DELETE FROM consuelo_dialer_schema_migrations
  WHERE migration_id='20260921_013_callback_booking_attempts';
END $$;`;
