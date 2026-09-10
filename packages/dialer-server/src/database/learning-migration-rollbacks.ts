export const ROLLBACK_CONTEXTUAL_HARDENING_SQL = `
DO $$ BEGIN
  LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM consuelo_dialer_schema_migrations WHERE migration_id > '20260815_004_contextual_predictive_science_hardening') THEN
    RAISE EXCEPTION 'Roll back newer migrations first';
  END IF;
  ALTER TABLE dialer_learning_observations
    DROP CONSTRAINT IF EXISTS dialer_learning_feature_schema_version_check,
    DROP CONSTRAINT IF EXISTS dialer_learning_decision_context_schema_check;
  DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id = '20260815_004_contextual_predictive_science_hardening';
END $$;
`;

export const ROLLBACK_CONTEXTUAL_SCIENCE_SQL = `
DO $$ BEGIN
  LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM consuelo_dialer_schema_migrations WHERE migration_id > '20260815_003_contextual_predictive_science') THEN
    RAISE EXCEPTION 'Roll back newer migrations first';
  END IF;
  DROP TABLE IF EXISTS dialer_predictive_decisions;
  ALTER TABLE dialer_learning_observations
    DROP COLUMN IF EXISTS feature_schema_version,
    DROP COLUMN IF EXISTS decision_id,
    DROP COLUMN IF EXISTS decision_context;
  DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id = '20260815_003_contextual_predictive_science';
END $$;
`;

export const ROLLBACK_PREDICTIVE_LEARNING_SQL = `
DO $$ BEGIN
  LOCK TABLE consuelo_dialer_schema_migrations IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM consuelo_dialer_schema_migrations WHERE migration_id > '20260815_002_predictive_learning_observations') THEN
    RAISE EXCEPTION 'Roll back newer migrations first';
  END IF;
  DROP TABLE IF EXISTS dialer_learning_observations;
  DELETE FROM consuelo_dialer_schema_migrations WHERE migration_id = '20260815_002_predictive_learning_observations';
END $$;
`;
