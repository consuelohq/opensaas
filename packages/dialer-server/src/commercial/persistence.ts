import { Effect } from 'effect';

import { normalizeAsyncError } from '../errors/normalize-async-error';

type QueryResult = { rows: unknown[]; rowCount?: number };

export type CommercialSqlClient = {
  query: (
    sql: string,
    parameters?: readonly unknown[],
  ) => Promise<QueryResult>;
};

export const COMMERCIAL_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS dialer_plan_catalog (
    code text PRIMARY KEY CHECK (code IN ('single', 'standard', 'power')),
    configuration jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_billing_accounts (
    payer_user_id text PRIMARY KEY,
    provider_customer_id text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_workspace_subscriptions (
    workspace_id text PRIMARY KEY,
    provider_customer_id text,
    provider_subscription_id text UNIQUE,
    status text NOT NULL CHECK (status <> ''),
    payment_failed_at timestamptz,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_workspace_subscription_items (
    workspace_id text NOT NULL,
    item_code text NOT NULL CHECK (item_code <> ''),
    provider_item_id text UNIQUE,
    provider_price_id text NOT NULL,
    quantity integer NOT NULL CHECK (quantity >= 0),
    PRIMARY KEY (workspace_id, item_code)
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_team_seats (
    workspace_id text NOT NULL,
    user_id text NOT NULL,
    plan_code text NOT NULL CHECK (plan_code IN ('single', 'standard', 'power')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_workspace_telephony_accounts (
    workspace_id text PRIMARY KEY,
    provider_account_id text NOT NULL UNIQUE,
    status text NOT NULL CHECK (status IN ('active', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_phone_numbers (
    workspace_id text NOT NULL,
    phone_number text NOT NULL,
    user_id text,
    provider_number_id text UNIQUE,
    slot_type text CHECK (slot_type IN ('included', 'additional')),
    status text NOT NULL CHECK (status IN ('active', 'released')),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, phone_number),
    UNIQUE (workspace_id, user_id, phone_number)
  )`,
  `ALTER TABLE dialer_phone_numbers
    ADD COLUMN IF NOT EXISTS slot_type text`,
  `WITH capacities AS (
      SELECT workspace_id,
             GREATEST(
               1,
               COALESCE(SUM(quantity) FILTER (
                 WHERE item_code IN ('single', 'standard', 'power')
               ), 0)
             )::integer AS included_capacity
      FROM dialer_workspace_subscription_items
      GROUP BY workspace_id
    ), ranked AS (
      SELECT number.workspace_id, number.phone_number,
             row_number() OVER (
               PARTITION BY number.workspace_id
               ORDER BY number.updated_at, number.phone_number
             ) AS position,
             COALESCE(capacities.included_capacity, 1) AS included_capacity
      FROM dialer_phone_numbers AS number
      LEFT JOIN capacities ON capacities.workspace_id = number.workspace_id
      WHERE number.status = 'active'
        AND number.user_id IS NOT NULL
        AND number.slot_type IS NULL
    )
    UPDATE dialer_phone_numbers AS number
    SET slot_type = CASE
      WHEN ranked.position <= ranked.included_capacity THEN 'included'
      ELSE 'additional'
    END
    FROM ranked
    WHERE number.workspace_id = ranked.workspace_id
      AND number.phone_number = ranked.phone_number`,
  `CREATE TABLE IF NOT EXISTS dialer_usage_events (
    workspace_id text NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    user_id text NOT NULL,
    seat_id text NOT NULL,
    metric text NOT NULL CHECK (metric = 'connected_minutes'),
    quantity integer NOT NULL CHECK (quantity >= 0),
    provider_cost_micros bigint NOT NULL CHECK (provider_cost_micros >= 0),
    occurred_at timestamptz NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (workspace_id, source_type, source_id)
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_provider_webhook_events (
    workspace_id text NOT NULL,
    source text NOT NULL CHECK (source <> ''),
    source_id text NOT NULL,
    status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
    claimed_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    last_error_code text,
    PRIMARY KEY (workspace_id, source, source_id),
    UNIQUE (source, source_id)
  )`,
  `ALTER TABLE dialer_provider_webhook_events
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'processing'`,
  `ALTER TABLE dialer_provider_webhook_events
    ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1`,
  `ALTER TABLE dialer_provider_webhook_events
    ADD COLUMN IF NOT EXISTS completed_at timestamptz`,
  `ALTER TABLE dialer_provider_webhook_events
    ADD COLUMN IF NOT EXISTS last_error_code text`,
  `CREATE TABLE IF NOT EXISTS dialer_installation_lifecycle_events (
    workspace_id text NOT NULL,
    location_id text NOT NULL,
    source_id text NOT NULL UNIQUE,
    event_type text NOT NULL CHECK (event_type IN ('installed', 'uninstalled')),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, source_id)
  )`,
] as const;

export const initializeCommercialPersistence = (client: {
  query: (
    sql: string,
    parameters?: readonly unknown[],
  ) => Promise<unknown>;
}) =>
  Effect.forEach(
    COMMERCIAL_SCHEMA_STATEMENTS,
    (statement) =>
      Effect.tryPromise({
        try: () => client.query(statement),
        catch: (cause) => cause,
      }),
    { concurrency: 1, discard: true },
  );

export const createCommercialPersistence = (client: CommercialSqlClient) => ({
  claimProviderEvent: (input: {
    workspaceId: string;
    source: string;
    sourceId: string;
  }) =>
    Effect.tryPromise({
      try: async () => {
        try {
          const result = await client.query(
            `INSERT INTO dialer_provider_webhook_events (
              workspace_id, source, source_id, status, attempt_count
            ) VALUES ($1, $2, $3, 'processing', 1)
            ON CONFLICT (source, source_id) DO UPDATE
            SET status = 'processing',
                attempt_count = dialer_provider_webhook_events.attempt_count + 1,
                claimed_at = now(),
                completed_at = NULL,
                last_error_code = NULL
            WHERE dialer_provider_webhook_events.workspace_id = EXCLUDED.workspace_id
              AND (
                dialer_provider_webhook_events.status = 'failed'
                OR (
                  dialer_provider_webhook_events.status = 'processing'
                  AND dialer_provider_webhook_events.claimed_at < now() - interval '5 minutes'
                )
              )
            RETURNING true AS inserted`,
            [input.workspaceId, input.source, input.sourceId],
          );
          return (result.rowCount ?? result.rows.length) > 0;
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      },
      catch: (cause) => cause,
    }),
  completeProviderEvent: (input: {
    workspaceId: string;
    source: string;
    sourceId: string;
  }) =>
    Effect.tryPromise({
      try: async () => {
        try {
          await client.query(
            `UPDATE dialer_provider_webhook_events
             SET status = 'completed', completed_at = now(), last_error_code = NULL
             WHERE workspace_id = $1 AND source = $2 AND source_id = $3
               AND status = 'processing'`,
            [input.workspaceId, input.source, input.sourceId],
          );
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      },
      catch: (cause) => cause,
    }),
  failProviderEvent: (input: {
    workspaceId: string;
    source: string;
    sourceId: string;
    errorCode: string;
  }) =>
    Effect.tryPromise({
      try: async () => {
        try {
          await client.query(
            `UPDATE dialer_provider_webhook_events
             SET status = 'failed', completed_at = NULL, last_error_code = $4
             WHERE workspace_id = $1 AND source = $2 AND source_id = $3
               AND status = 'processing'`,
            [input.workspaceId, input.source, input.sourceId, input.errorCode],
          );
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      },
      catch: (cause) => cause,
    }),
  saveSeatAssignment: (input: {
    workspaceId: string;
    userId: string;
    planCode: string;
  }) =>
    Effect.tryPromise({
      try: async () => {
        try {
          await client.query(
            `INSERT INTO dialer_team_seats (
              workspace_id, user_id, plan_code, status
            ) VALUES ($1, $2, $3, 'active')
            ON CONFLICT (workspace_id, user_id) DO UPDATE
            SET plan_code = EXCLUDED.plan_code,
                status = 'active',
                updated_at = now()`,
            [input.workspaceId, input.userId, input.planCode],
          );
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      },
      catch: (cause) => cause,
    }),
  listActiveNumbersForUser: (workspaceId: string, userId: string) =>
    Effect.tryPromise({
      try: async () => {
        try {
          const result = await client.query(
            `SELECT phone_number, provider_number_id
            FROM dialer_phone_numbers
            WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
            ORDER BY phone_number`,
            [workspaceId, userId],
          );
          return result.rows;
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      },
      catch: (cause) => cause,
    }),
});
