export const CALLBACK_BOOKING_EVENTS_MIGRATION_ID =
  '20260919_012_callback_booking_events';

export const CREATE_CALLBACK_BOOKING_EVENTS_SQL = `
DO $migration$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 CREATE TABLE IF NOT EXISTS dialer_callback_booking_events(
  workspace_id text NOT NULL,
  callback_id text NOT NULL,
  revision integer NOT NULL CHECK(revision > 0),
  event_kind text NOT NULL CHECK(event_kind IN ('cancel_dispatched','cancelled')),
  provider_reference text NOT NULL,
  evidence_reference text,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,callback_id,revision,event_kind),
  FOREIGN KEY(workspace_id,callback_id,revision)
   REFERENCES dialer_callback_bookings(workspace_id,callback_id,revision),
  CHECK ((event_kind='cancelled') = (evidence_reference IS NOT NULL))
 );
 DROP TRIGGER IF EXISTS dialer_callback_booking_events_immutable ON dialer_callback_booking_events;
 CREATE TRIGGER dialer_callback_booking_events_immutable BEFORE UPDATE OR DELETE ON dialer_callback_booking_events
  FOR EACH ROW EXECUTE FUNCTION dialer_callback_immutable_history();
 INSERT INTO consuelo_dialer_schema_migrations(migration_id)
  VALUES ('20260919_012_callback_booking_events') ON CONFLICT DO NOTHING;
END $migration$;`;

export const DROP_CALLBACK_BOOKING_EVENTS_SQL = `
DO $$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM consuelo_dialer_schema_migrations
   WHERE migration_id>'20260919_012_callback_booking_events') THEN
  RAISE EXCEPTION 'Roll back newer migrations first';
 END IF;
 LOCK TABLE dialer_callback_booking_events IN ACCESS EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM dialer_callback_booking_events) THEN
  RAISE EXCEPTION 'Retain callback booking cancellation evidence before rollback';
 END IF;
 DROP TABLE dialer_callback_booking_events;
 DELETE FROM consuelo_dialer_schema_migrations
  WHERE migration_id='20260919_012_callback_booking_events';
END $$;`;
