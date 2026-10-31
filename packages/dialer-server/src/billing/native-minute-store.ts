import type { CommercialSqlClient } from '../commercial/persistence';
import { normalizeAsyncError } from '../errors/normalize-async-error';

export const NATIVE_MINUTE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS dialer_native_minute_intents (
    id text PRIMARY KEY, purchase_id text NOT NULL REFERENCES dialer_public_purchases(id),
    workspace_id text NOT NULL, provider_customer_id text NOT NULL, provider_session_id text UNIQUE,
    status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired')),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS dialer_native_minute_pending ON dialer_native_minute_intents(workspace_id) WHERE status='pending'`,
  `CREATE TABLE IF NOT EXISTS dialer_native_minute_grants (
    intent_id text PRIMARY KEY REFERENCES dialer_native_minute_intents(id), workspace_id text NOT NULL,
    provider_session_id text NOT NULL UNIQUE, minutes integer NOT NULL CHECK(minutes>=0 AND minutes<=210000),
    paid_cents integer NOT NULL CHECK(paid_cents>=0), created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS dialer_native_minute_debits (
    workspace_id text NOT NULL, user_id text NOT NULL, period date NOT NULL,
    quota integer NOT NULL CHECK(quota>=0), usage_seen bigint NOT NULL DEFAULT 0 CHECK(usage_seen>=0),
    debit_minutes bigint NOT NULL DEFAULT 0 CHECK(debit_minutes>=0),
    PRIMARY KEY(workspace_id,user_id,period)
  )`,
  `CREATE OR REPLACE FUNCTION dialer_reconcile_native_minute_debits(p_workspace text,p_user text DEFAULT NULL)
   RETURNS void LANGUAGE plpgsql AS $$
   DECLARE purchase dialer_public_purchases%ROWTYPE; quota_now integer; current_month date;
     fact record; ledger dialer_native_minute_debits%ROWTYPE;
   BEGIN
     SELECT * INTO purchase FROM dialer_public_purchases WHERE claimed_workspace_id=p_workspace AND billing_version='native-20261031' FOR SHARE;
     IF NOT FOUND THEN RETURN; END IF;
     quota_now=CASE purchase.entitlement_selection->>'plan' WHEN 'professional' THEN 1000 WHEN 'agency' THEN 5000 WHEN 'enterprise' THEN 5000 END;
     IF quota_now IS NULL THEN RAISE EXCEPTION 'INVALID_CHECKOUT_SELECTION'; END IF;
     current_month=date_trunc('month',now() AT TIME ZONE 'UTC')::date;
     INSERT INTO dialer_native_minute_debits(workspace_id,user_id,period,quota)
       SELECT p_workspace,user_id,current_month,quota_now FROM (
         SELECT user_id FROM dialer_team_seats WHERE workspace_id=p_workspace AND status='active'
         UNION SELECT p_user WHERE p_user IS NOT NULL
       ) users ORDER BY user_id ON CONFLICT DO NOTHING;
     FOR fact IN SELECT user_id,date_trunc('month',occurred_at AT TIME ZONE 'UTC')::date AS period,SUM(quantity)::bigint AS used
       FROM dialer_usage_events WHERE workspace_id=p_workspace AND occurred_at>=date_trunc('month',purchase.created_at)
       AND occurred_at<=now() GROUP BY user_id,date_trunc('month',occurred_at AT TIME ZONE 'UTC')::date ORDER BY user_id,period
     LOOP
       INSERT INTO dialer_native_minute_debits(workspace_id,user_id,period,quota)
         VALUES(p_workspace,fact.user_id,fact.period,quota_now) ON CONFLICT DO NOTHING;
       SELECT * INTO ledger FROM dialer_native_minute_debits WHERE workspace_id=p_workspace AND user_id=fact.user_id AND period=fact.period FOR UPDATE;
       UPDATE dialer_native_minute_debits SET
         debit_minutes=debit_minutes+GREATEST(GREATEST(fact.used-ledger.quota,0)-GREATEST(ledger.usage_seen-ledger.quota,0),0),
         usage_seen=GREATEST(usage_seen,fact.used),
         quota=CASE WHEN period=current_month THEN quota_now ELSE quota END
       WHERE workspace_id=p_workspace AND user_id=fact.user_id AND period=fact.period;
     END LOOP;
     UPDATE dialer_native_minute_debits SET quota=quota_now WHERE workspace_id=p_workspace AND period=current_month;
   END $$`,
  `CREATE OR REPLACE FUNCTION dialer_begin_native_minute_intent(p_purchase text,p_id text)
   RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE purchase dialer_public_purchases%ROWTYPE; intent dialer_native_minute_intents%ROWTYPE;
   BEGIN
     SELECT * INTO purchase FROM dialer_public_purchases WHERE id=p_purchase FOR UPDATE;
     IF NOT FOUND OR purchase.billing_version<>'native-20261031' OR purchase.claimed_workspace_id IS NULL OR purchase.provider_status<>'active' THEN RAISE EXCEPTION 'PURCHASE_NOT_PAID'; END IF;
     SELECT * INTO intent FROM dialer_native_minute_intents WHERE workspace_id=purchase.claimed_workspace_id AND status='pending' FOR UPDATE;
     IF FOUND THEN RETURN to_jsonb(intent); END IF;
     INSERT INTO dialer_native_minute_intents(id,purchase_id,workspace_id,provider_customer_id)
       VALUES(p_id,p_purchase,purchase.claimed_workspace_id,purchase.provider_customer_id) RETURNING * INTO intent;
     RETURN to_jsonb(intent);
   END $$`,
  `CREATE OR REPLACE FUNCTION dialer_grant_native_minutes(p_id text,p_session text,p_minutes integer,p_cents integer)
   RETURNS void LANGUAGE plpgsql AS $$
   DECLARE intent dialer_native_minute_intents%ROWTYPE; grant_row dialer_native_minute_grants%ROWTYPE;
   BEGIN
     SELECT * INTO intent FROM dialer_native_minute_intents WHERE id=p_id FOR UPDATE;
     IF NOT FOUND OR intent.provider_session_id IS DISTINCT FROM p_session THEN RAISE EXCEPTION 'PURCHASE_PROVIDER_MISMATCH'; END IF;
     INSERT INTO dialer_native_minute_grants(intent_id,workspace_id,provider_session_id,minutes,paid_cents)
       VALUES(p_id,intent.workspace_id,p_session,p_minutes,p_cents) ON CONFLICT(intent_id) DO NOTHING;
     SELECT * INTO grant_row FROM dialer_native_minute_grants WHERE intent_id=p_id;
     IF grant_row.minutes<>p_minutes OR grant_row.paid_cents<>p_cents OR grant_row.provider_session_id<>p_session THEN RAISE EXCEPTION 'MINUTE_GRANT_CONFLICT'; END IF;
     UPDATE dialer_native_minute_intents SET status='paid',updated_at=now() WHERE id=p_id;
   END $$`,
] as const;
export const createNativeMinuteStore = (database: CommercialSqlClient) => {
  const query = async (sql: string, parameters: unknown[]) => {
    try {
      return await database.query(sql, parameters);
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  return {
    async begin(purchaseId: string, id: string) {
      try {
        return (
          (
            await query(
              'SELECT dialer_begin_native_minute_intent($1,$2) AS intent',
              [purchaseId, id],
            )
          ).rows[0] as { intent: Record<string, unknown> }
        ).intent;
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    async get(id: string) {
      try {
        return (
          await query(
            'SELECT * FROM dialer_native_minute_intents WHERE id=$1',
            [id],
          )
        ).rows[0] as Record<string, unknown> | undefined;
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    async save(id: string, session: string) {
      try {
        if (
          !(
            await query(
              'UPDATE dialer_native_minute_intents SET provider_session_id=$2,updated_at=now() WHERE id=$1 AND (provider_session_id IS NULL OR provider_session_id=$2) RETURNING id',
              [id, session],
            )
          ).rows.length
        )
          throw new Error('MINUTE_SESSION_CONFLICT');
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    async expire(id: string) {
      try {
        await query(
          "UPDATE dialer_native_minute_intents SET status='expired',updated_at=now() WHERE id=$1 AND status='pending'",
          [id],
        );
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    async grant(id: string, session: string, minutes: number, cents: number) {
      try {
        await query('SELECT dialer_grant_native_minutes($1,$2,$3,$4)', [
          id,
          session,
          minutes,
          cents,
        ]);
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    async allowance(workspaceId: string, userId: string) {
      try {
        await query('SELECT dialer_reconcile_native_minute_debits($1,$2)', [
          workspaceId,
          userId,
        ]);
        return (
          await query(
            `SELECT
        (SELECT COALESCE(SUM(minutes),0) FROM dialer_prepaid_minute_grants WHERE workspace_id=$1)+
        (SELECT COALESCE(SUM(minutes),0) FROM dialer_native_minute_grants WHERE workspace_id=$1) AS granted,
        (SELECT COALESCE(SUM(debit_minutes),0) FROM dialer_native_minute_debits WHERE workspace_id=$1) AS consumed,
        (SELECT COALESCE(MAX(usage_seen),0) FROM dialer_native_minute_debits WHERE workspace_id=$1 AND user_id=$2 AND period=date_trunc('month',now() AT TIME ZONE 'UTC')::date) AS used`,
            [workspaceId, userId],
          )
        ).rows[0] as Record<string, unknown>;
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
  };
};
