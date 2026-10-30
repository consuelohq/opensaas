import { normalizeAsyncError } from '../errors/normalize-async-error';
import type { CommercialSqlClient } from '../commercial/persistence';

export const PUBLIC_CHECKOUT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS dialer_public_purchases (
   id text PRIMARY KEY, selection jsonb NOT NULL, claim_hash text NOT NULL,
   origin text NOT NULL, provider_session_id text UNIQUE, provider_subscription_id text UNIQUE,
   provider_customer_id text, provider_status text, provider_items jsonb NOT NULL DEFAULT '[]',
   entitlement_selection jsonb, generation bigint NOT NULL DEFAULT 0,
   claimed_workspace_id text UNIQUE, claimed_user_id text,
   paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
   updated_at timestamptz NOT NULL DEFAULT now()
 )`,
  `CREATE TABLE IF NOT EXISTS dialer_public_purchase_events (
   provider_event_id text PRIMARY KEY, purchase_id text NOT NULL REFERENCES dialer_public_purchases(id),
   event_type text NOT NULL, attempts integer NOT NULL DEFAULT 1,
   received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, last_error_code text
 )`,
  `CREATE TABLE IF NOT EXISTS dialer_checkout_rate_limits (
   bucket text PRIMARY KEY, requests integer NOT NULL CHECK(requests > 0),
   expires_at timestamptz NOT NULL
 )`,
  `CREATE TABLE IF NOT EXISTS dialer_prepaid_minute_grants (
   purchase_id text PRIMARY KEY REFERENCES dialer_public_purchases(id),
   workspace_id text NOT NULL, minutes integer NOT NULL CHECK(minutes > 0),
   granted_at timestamptz NOT NULL DEFAULT now()
 )`,
  `CREATE OR REPLACE FUNCTION dialer_project_public_purchase(p_id text, p_generation bigint,
   p_customer text, p_subscription text, p_status text, p_items jsonb,
   p_selection jsonb, p_paid boolean)
 RETURNS boolean LANGUAGE plpgsql AS $$
 DECLARE purchase dialer_public_purchases%ROWTYPE; item jsonb;
 BEGIN
   SELECT * INTO purchase FROM dialer_public_purchases WHERE id=p_id FOR UPDATE;
   IF NOT FOUND OR purchase.generation <> p_generation THEN RETURN false; END IF;
   UPDATE dialer_public_purchases SET provider_customer_id=p_customer,
     provider_subscription_id=p_subscription, provider_status=p_status,
     provider_items=p_items, entitlement_selection=p_selection,
     paid_at=CASE WHEN p_paid THEN COALESCE(paid_at,now()) ELSE paid_at END, updated_at=now()
     WHERE id=p_id;
   IF purchase.claimed_workspace_id IS NOT NULL THEN
     UPDATE dialer_workspace_subscriptions SET status=p_status,
       payment_failed_at=CASE WHEN p_status='past_due' THEN COALESCE(payment_failed_at,now()) ELSE NULL END,
       cancel_at_period_end=COALESCE((p_selection->>'cancelAtPeriodEnd')::boolean,false), updated_at=now()
       WHERE workspace_id=purchase.claimed_workspace_id AND provider_subscription_id=p_subscription;
     IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_SUBSCRIPTION_CONFLICT'; END IF;
     DELETE FROM dialer_workspace_subscription_items WHERE workspace_id=purchase.claimed_workspace_id;
     FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
       INSERT INTO dialer_workspace_subscription_items(workspace_id,item_code,provider_item_id,provider_price_id,quantity)
       VALUES(purchase.claimed_workspace_id,item->>'code',item->>'id',item->>'priceId',(item->>'quantity')::integer);
     END LOOP;
   END IF;
   RETURN true;
 END $$`,
  `CREATE OR REPLACE FUNCTION dialer_claim_public_purchase(p_id text,p_hash text,p_workspace text,p_user text,p_generation bigint)
 RETURNS jsonb LANGUAGE plpgsql AS $$
 DECLARE purchase dialer_public_purchases%ROWTYPE; current_subscription dialer_workspace_subscriptions%ROWTYPE;
   item jsonb; seat_count integer; number_count integer; legacy_code text; capacity integer;
 BEGIN
   PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace,0));
   SELECT * INTO purchase FROM dialer_public_purchases WHERE id=p_id FOR UPDATE;
   IF NOT FOUND OR purchase.claim_hash <> p_hash THEN RAISE EXCEPTION 'PURCHASE_NOT_FOUND'; END IF;
   IF purchase.claimed_workspace_id IS NOT NULL AND purchase.claimed_workspace_id <> p_workspace THEN
     RAISE EXCEPTION 'PURCHASE_ALREADY_CLAIMED'; END IF;
   IF purchase.generation <> p_generation THEN RAISE EXCEPTION 'PURCHASE_RECONCILIATION_PENDING'; END IF;
   IF purchase.paid_at IS NULL OR purchase.provider_status <> 'active' THEN RAISE EXCEPTION 'PURCHASE_NOT_PAID'; END IF;
   IF purchase.claimed_workspace_id=p_workspace THEN
     RETURN jsonb_build_object('claimed',true,'workspaceId',p_workspace,'purchaseId',p_id);
   END IF;
   SELECT * INTO current_subscription FROM dialer_workspace_subscriptions WHERE workspace_id=p_workspace FOR UPDATE;
   IF FOUND AND current_subscription.provider_subscription_id IS NOT NULL
      AND current_subscription.provider_subscription_id <> purchase.provider_subscription_id
      AND current_subscription.status NOT IN ('canceled','incomplete_expired') THEN
     RAISE EXCEPTION 'SUBSCRIPTION_ALREADY_EXISTS'; END IF;
   legacy_code=CASE purchase.entitlement_selection->>'plan' WHEN 'professional' THEN 'single' WHEN 'agency' THEN 'standard' WHEN 'enterprise' THEN 'power' END;
   IF legacy_code IS NULL THEN RAISE EXCEPTION 'INVALID_CHECKOUT_SELECTION'; END IF;
   SELECT count(*) INTO seat_count FROM dialer_team_seats WHERE workspace_id=p_workspace AND status='active' AND user_id<>p_user;
   IF seat_count+1 > (purchase.entitlement_selection->>'seats')::integer THEN RAISE EXCEPTION 'SUBSCRIPTION_BELOW_ASSIGNED_SEATS'; END IF;
   capacity=(purchase.entitlement_selection->>'seats')::integer *
     CASE legacy_code WHEN 'single' THEN 3 WHEN 'standard' THEN 10 ELSE 30 END
     + (purchase.entitlement_selection->>'numberPack')::integer;
   SELECT count(*) INTO number_count FROM dialer_phone_numbers WHERE workspace_id=p_workspace AND status='active';
   IF number_count>capacity THEN RAISE EXCEPTION 'SUBSCRIPTION_BELOW_ACTIVE_NUMBERS'; END IF;
   UPDATE dialer_public_purchases SET claimed_workspace_id=p_workspace,claimed_user_id=p_user,updated_at=now() WHERE id=p_id;
   INSERT INTO dialer_workspace_subscriptions(workspace_id,provider_customer_id,provider_subscription_id,status,cancel_at_period_end)
   VALUES(p_workspace,purchase.provider_customer_id,purchase.provider_subscription_id,purchase.provider_status,
     COALESCE((purchase.entitlement_selection->>'cancelAtPeriodEnd')::boolean,false))
   ON CONFLICT(workspace_id) DO UPDATE SET provider_customer_id=EXCLUDED.provider_customer_id,
     provider_subscription_id=EXCLUDED.provider_subscription_id,status=EXCLUDED.status,
     payment_failed_at=NULL,cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=now();
   INSERT INTO dialer_billing_accounts(payer_user_id,provider_customer_id) VALUES(p_user,purchase.provider_customer_id)
     ON CONFLICT DO NOTHING;
   DELETE FROM dialer_workspace_subscription_items WHERE workspace_id=p_workspace;
   FOR item IN SELECT * FROM jsonb_array_elements(purchase.provider_items) LOOP
     INSERT INTO dialer_workspace_subscription_items(workspace_id,item_code,provider_item_id,provider_price_id,quantity)
     VALUES(p_workspace,item->>'code',item->>'id',item->>'priceId',(item->>'quantity')::integer);
   END LOOP;
   UPDATE dialer_team_seats SET plan_code=legacy_code,updated_at=now() WHERE workspace_id=p_workspace AND status='active';
   INSERT INTO dialer_team_seats(workspace_id,user_id,plan_code,status) VALUES(p_workspace,p_user,legacy_code,'active')
     ON CONFLICT(workspace_id,user_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status='active',updated_at=now();
   IF (purchase.selection->>'minutePack')::integer>0 THEN
     INSERT INTO dialer_prepaid_minute_grants(purchase_id,workspace_id,minutes)
     VALUES(p_id,p_workspace,(purchase.selection->>'minutePack')::integer) ON CONFLICT DO NOTHING;
   END IF;
   RETURN jsonb_build_object('claimed',true,'workspaceId',p_workspace,'purchaseId',p_id);
 END $$`,
] as const;

export const initializePublicCheckoutStore = async (
  database: CommercialSqlClient,
) => {
  try {
    for (const statement of PUBLIC_CHECKOUT_SCHEMA)
      await database.query(statement);
  } catch (cause: unknown) {
    throw normalizeAsyncError(cause);
  }
};

export const createPublicCheckoutStore = (database: CommercialSqlClient) => ({
  database,
  async rateLimit(bucket: string) {
    try {
      const result = await database.query(
        `INSERT INTO dialer_checkout_rate_limits(bucket,requests,expires_at)
   VALUES($1,1,now()+interval '2 hours') ON CONFLICT(bucket) DO UPDATE
   SET requests=dialer_checkout_rate_limits.requests+1 WHERE dialer_checkout_rate_limits.requests<20 RETURNING requests`,
        [bucket],
      );
      await database.query(
        'DELETE FROM dialer_checkout_rate_limits WHERE expires_at<now()',
      );
      if (!result.rows.length) throw new Error('CHECKOUT_RATE_LIMITED');
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async begin(input: {
    id: string;
    selection: unknown;
    claimHash: string;
    origin: string;
  }) {
    try {
      await database.query(
        `INSERT INTO dialer_public_purchases(id,selection,claim_hash,origin)
    VALUES($1,$2::jsonb,$3,$4) ON CONFLICT(id) DO NOTHING`,
        [
          input.id,
          JSON.stringify(input.selection),
          input.claimHash,
          input.origin,
        ],
      );
      return this.get(input.id);
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async get(id: string) {
    try {
      return (
        await database.query(
          'SELECT * FROM dialer_public_purchases WHERE id=$1',
          [id],
        )
      ).rows[0] as Record<string, unknown> | undefined;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async saveSession(id: string, sessionId: string) {
    try {
      await database.query(
        'UPDATE dialer_public_purchases SET provider_session_id=$2,updated_at=now() WHERE id=$1 AND (provider_session_id IS NULL OR provider_session_id=$2)',
        [id, sessionId],
      );
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async generation(id: string) {
    try {
      const row = (
        await database.query(
          'UPDATE dialer_public_purchases SET generation=generation+1 WHERE id=$1 RETURNING generation',
          [id],
        )
      ).rows[0] as { generation: unknown } | undefined;
      if (!row) throw new Error('PURCHASE_NOT_FOUND');
      return Number(row.generation);
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async findSubscription(id: string) {
    try {
      return (
        await database.query(
          'SELECT * FROM dialer_public_purchases WHERE provider_subscription_id=$1',
          [id],
        )
      ).rows[0] as Record<string, unknown> | undefined;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async claimed(workspaceId: string) {
    try {
      return (
        await database.query(
          'SELECT * FROM dialer_public_purchases WHERE claimed_workspace_id=$1',
          [workspaceId],
        )
      ).rows[0] as Record<string, unknown> | undefined;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
});
