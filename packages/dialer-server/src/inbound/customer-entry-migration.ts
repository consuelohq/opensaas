export const CUSTOMER_ENTRY_MIGRATION_ID = '20260913_011_customer_entry';

export const CREATE_CUSTOMER_ENTRY_SQL = `
DO $migration$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 CREATE TABLE IF NOT EXISTS dialer_customer_callback_admission(
  workspace_id text NOT NULL,
  number_id text NOT NULL,
  request_key text NOT NULL,
  request_digest text NOT NULL,
  client_hash text NOT NULL,
  callback_id text NOT NULL,
  timezone text NOT NULL,
  not_before timestamptz NOT NULL,
  deadline timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL,
  management_token_hash text NOT NULL,
  management_expires_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,number_id,request_key),
  UNIQUE(workspace_id,callback_id),
  UNIQUE(management_token_hash),
  CHECK (deadline > not_before),
  CHECK (management_expires_at > accepted_at)
 );
 CREATE INDEX IF NOT EXISTS dialer_customer_callback_admission_client_idx
  ON dialer_customer_callback_admission(workspace_id,number_id,client_hash,accepted_at);
 CREATE INDEX IF NOT EXISTS dialer_customer_callback_admission_number_idx
  ON dialer_customer_callback_admission(workspace_id,number_id,accepted_at);
 CREATE INDEX IF NOT EXISTS dialer_customer_callback_admission_expiry_idx
  ON dialer_customer_callback_admission(management_expires_at);

 CREATE TABLE IF NOT EXISTS dialer_customer_callback_consents(
  workspace_id text NOT NULL,
  consent_reference text NOT NULL,
  callback_id text NOT NULL,
  number_id text NOT NULL,
  activation_reference text NOT NULL,
  evidence_reference text NOT NULL,
  disclosure_hash text NOT NULL,
  accepted_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,consent_reference),
  UNIQUE(workspace_id,callback_id),
  CHECK (expires_at > accepted_at)
 );
 CREATE INDEX IF NOT EXISTS dialer_customer_callback_consents_callback_idx
  ON dialer_customer_callback_consents(workspace_id,callback_id);

 INSERT INTO consuelo_dialer_schema_migrations(migration_id)
  VALUES ('20260913_011_customer_entry') ON CONFLICT DO NOTHING;
END $migration$;`;

export const DROP_CUSTOMER_ENTRY_SQL = `
DO $$ BEGIN
 LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM consuelo_dialer_schema_migrations
   WHERE migration_id>'20260913_011_customer_entry') THEN
  RAISE EXCEPTION 'Roll back newer migrations first';
 END IF;
 LOCK TABLE dialer_customer_callback_admission IN ACCESS EXCLUSIVE MODE;
 IF EXISTS(
   SELECT 1 FROM dialer_customer_callback_admission
   WHERE management_expires_at > clock_timestamp()
 ) THEN
  RAISE EXCEPTION 'Wait for customer callback management capabilities to expire before rollback';
 END IF;
 DROP TABLE dialer_customer_callback_consents,dialer_customer_callback_admission;
 DELETE FROM consuelo_dialer_schema_migrations
  WHERE migration_id='20260913_011_customer_entry';
END $$;`;
