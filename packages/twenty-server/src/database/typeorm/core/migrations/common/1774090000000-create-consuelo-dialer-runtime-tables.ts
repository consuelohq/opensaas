import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateConsueloDialerRuntimeTables1774090000000 implements MigrationInterface {
  name = 'CreateConsueloDialerRuntimeTables1774090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS caller_id_locks (
        phone_number varchar(20) PRIMARY KEY,
        user_id varchar(255) NOT NULL,
        call_sid varchar(64) NOT NULL,
        acquired_at timestamptz DEFAULT now(),
        expires_at timestamptz NOT NULL
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_caller_locks_call_sid ON caller_id_locks(call_sid)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_caller_locks_user ON caller_id_locks(user_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_caller_locks_expires ON caller_id_locks(expires_at)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS area_code_locations (
        area_code varchar(5) PRIMARY KEY,
        latitude decimal(9, 6) NOT NULL,
        longitude decimal(9, 6) NOT NULL,
        city varchar(100),
        state varchar(50)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS calls (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL,
        call_sid varchar(64),
        conference_name varchar(128),
        recording_sid varchar(64),
        contact_id uuid,
        direction varchar(16),
        status varchar(32),
        outcome varchar(32),
        "from" varchar(32),
        "to" varchar(32),
        duration_seconds integer DEFAULT 0,
        transcript text,
        analysis jsonb,
        retry_strategy text,
        retry_scheduled_at timestamptz,
        retry_reason text,
        start_time timestamptz,
        end_time timestamptz,
        parallel_group_id varchar(30),
        parallel_position smallint,
        parallel_outcome varchar(20) DEFAULT 'pending',
        parallel_termination_reason varchar(30),
        parallel_terminated_at timestamptz,
        amd_result varchar(20),
        amd_enabled boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_calls_workspace ON calls(workspace_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_calls_start_time ON calls(workspace_id, start_time DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_calls_recording ON calls(recording_sid)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_calls_parallel_group ON calls(parallel_group_id)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL,
        name varchar(255),
        phone varchar(32),
        email varchar(255),
        company varchar(255),
        tags text[],
        source varchar(32),
        dnc_status varchar(16) DEFAULT 'allowed',
        address text,
        city varchar(128),
        state varchar(64),
        zip varchar(16),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS call_queues (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id text NOT NULL,
        user_id text NOT NULL,
        name text NOT NULL,
        description text,
        source_type text NOT NULL DEFAULT 'manual',
        source_id text,
        category text NOT NULL DEFAULT 'all',
        calling_mode text NOT NULL DEFAULT 'browser',
        status text NOT NULL DEFAULT 'idle',
        settings jsonb NOT NULL DEFAULT '{}'::jsonb,
        total_contacts integer NOT NULL DEFAULT 0,
        completed_contacts integer NOT NULL DEFAULT 0,
        skipped_contacts integer NOT NULL DEFAULT 0,
        dnc_filtered_count integer NOT NULL DEFAULT 0,
        aggregated_stats jsonb,
        started_at timestamptz,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS queue_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_id uuid NOT NULL REFERENCES call_queues(id) ON DELETE CASCADE,
        contact_id text NOT NULL,
        position integer NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0,
        last_attempt_at timestamptz,
        call_outcome text,
        call_duration_seconds integer,
        retry_strategy text,
        retry_scheduled_at timestamptz,
        retry_reason text,
        skip_reason text,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_queue_items_queue_id ON queue_items(queue_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_call_queues_user ON call_queues(user_id, workspace_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_call_queues_status ON call_queues(status)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_call_queues_workspace ON call_queues(workspace_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_call_queues_workspace_status ON call_queues(workspace_id, status)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_queue_items_queue ON queue_items(queue_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_queue_items_contact ON queue_items(contact_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_queue_items_queue_status ON queue_items(queue_id, status)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_queue_items_outcome ON queue_items(call_outcome) WHERE call_outcome IS NOT NULL',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contact_attempt_ledger (
        workspace_id text NOT NULL,
        contact_id text NOT NULL,
        last_attempt_at timestamptz,
        attempts_total integer NOT NULL DEFAULT 0,
        attempts_today integer NOT NULL DEFAULT 0,
        attempts_this_week integer NOT NULL DEFAULT 0,
        outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
        day_window_start timestamptz NOT NULL DEFAULT date_trunc('day', now()),
        week_window_start timestamptz NOT NULL DEFAULT date_trunc('week', now()),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (workspace_id, contact_id)
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_contact_attempt_ledger_last_attempt ON contact_attempt_ledger(workspace_id, last_attempt_at DESC)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workspace_subscriptions (
        workspace_id uuid PRIMARY KEY,
        stripe_customer_id varchar(255),
        stripe_subscription_id varchar(255),
        status varchar(32) NOT NULL DEFAULT 'inactive',
        plan_name varchar(64),
        interval varchar(16),
        current_period_end timestamptz,
        add_ons jsonb DEFAULT '[]'::jsonb,
        number_packs jsonb DEFAULT '[]'::jsonb,
        phone_number_add_ons jsonb DEFAULT '[]'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workspace_usage (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL,
        metric varchar(64) NOT NULL,
        amount numeric NOT NULL DEFAULT 0,
        period_start timestamptz NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_workspace_usage_lookup ON workspace_usage(workspace_id, metric, period_start)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workspace_phone_numbers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL,
        phone_number varchar(32) NOT NULL,
        friendly_name varchar(255) NOT NULL DEFAULT '',
        area_code varchar(8) NOT NULL DEFAULT '',
        twilio_sid varchar(64) NOT NULL UNIQUE,
        ownership_type varchar(32) NOT NULL DEFAULT 'included',
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_workspace_phone_numbers_workspace_status
      ON workspace_phone_numbers (workspace_id, status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar(255) NOT NULL,
        workspace_id varchar(255) NOT NULL,
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, workspace_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_settings_user_workspace
      ON user_settings (user_id, workspace_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_user_settings_user_workspace',
    );
    await queryRunner.query('DROP TABLE IF EXISTS user_settings');
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_workspace_phone_numbers_workspace_status',
    );
    await queryRunner.query('DROP TABLE IF EXISTS workspace_phone_numbers');
    await queryRunner.query('DROP INDEX IF EXISTS idx_workspace_usage_lookup');
    await queryRunner.query('DROP TABLE IF EXISTS workspace_usage');
    await queryRunner.query('DROP TABLE IF EXISTS workspace_subscriptions');
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_contact_attempt_ledger_last_attempt',
    );
    await queryRunner.query('DROP TABLE IF EXISTS contact_attempt_ledger');
    await queryRunner.query('DROP INDEX IF EXISTS idx_queue_items_outcome');
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_queue_items_queue_status',
    );
    await queryRunner.query('DROP INDEX IF EXISTS idx_queue_items_contact');
    await queryRunner.query('DROP INDEX IF EXISTS idx_queue_items_queue');
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_call_queues_workspace_status',
    );
    await queryRunner.query('DROP INDEX IF EXISTS idx_call_queues_workspace');
    await queryRunner.query('DROP INDEX IF EXISTS idx_call_queues_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_call_queues_user');
    await queryRunner.query('DROP INDEX IF EXISTS idx_queue_items_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_queue_items_queue_id');
    await queryRunner.query('DROP TABLE IF EXISTS queue_items');
    await queryRunner.query('DROP TABLE IF EXISTS call_queues');
    await queryRunner.query('DROP INDEX IF EXISTS idx_contacts_email');
    await queryRunner.query('DROP INDEX IF EXISTS idx_contacts_phone');
    await queryRunner.query('DROP INDEX IF EXISTS idx_contacts_workspace');
    await queryRunner.query('DROP TABLE IF EXISTS contacts');
    await queryRunner.query('DROP INDEX IF EXISTS idx_calls_parallel_group');
    await queryRunner.query('DROP INDEX IF EXISTS idx_calls_recording');
    await queryRunner.query('DROP INDEX IF EXISTS idx_calls_contact');
    await queryRunner.query('DROP INDEX IF EXISTS idx_calls_start_time');
    await queryRunner.query('DROP INDEX IF EXISTS idx_calls_call_sid');
    await queryRunner.query('DROP INDEX IF EXISTS idx_calls_workspace');
    await queryRunner.query('DROP TABLE IF EXISTS calls');
    await queryRunner.query('DROP TABLE IF EXISTS area_code_locations');
    await queryRunner.query('DROP INDEX IF EXISTS idx_caller_locks_expires');
    await queryRunner.query('DROP INDEX IF EXISTS idx_caller_locks_user');
    await queryRunner.query('DROP INDEX IF EXISTS idx_caller_locks_call_sid');
    await queryRunner.query('DROP TABLE IF EXISTS caller_id_locks');
  }
}
