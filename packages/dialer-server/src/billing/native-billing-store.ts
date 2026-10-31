import { NATIVE_MINUTE_SCHEMA } from './native-minute-store';
import type { CommercialSqlClient } from '../commercial/persistence';
import { normalizeAsyncError } from '../errors/normalize-async-error';

export const NATIVE_BILLING_MIGRATION_ID = '20261031_016_native_billing';
export const NATIVE_BILLING_SCHEMA = [
  `ALTER TABLE dialer_public_purchases ADD COLUMN IF NOT EXISTS billing_version text NOT NULL DEFAULT 'launch-20261030'`,
  `ALTER TABLE dialer_public_purchases ADD COLUMN IF NOT EXISTS number_component_id text`,
  `CREATE TABLE IF NOT EXISTS dialer_native_number_components (
    id text PRIMARY KEY, purchase_id text NOT NULL REFERENCES dialer_public_purchases(id),
    attempt integer NOT NULL, requested_pack integer NOT NULL CHECK(requested_pack IN (0,1,10,50)),
    requested_billing text NOT NULL CHECK(requested_billing IN ('monthly','annual')),
    provider_customer_id text NOT NULL, provider_subscription_id text UNIQUE,
    provider_status text NOT NULL DEFAULT 'pending', entitlement_pack integer NOT NULL DEFAULT 0,
    entitlement_billing text, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(purchase_id,attempt)
  )`,
  ...NATIVE_MINUTE_SCHEMA,
  `CREATE OR REPLACE FUNCTION dialer_begin_native_number_component(p_purchase text,p_id text,p_pack integer,p_billing text,p_restart boolean)
   RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE purchase dialer_public_purchases%ROWTYPE; current_attempt dialer_native_number_components%ROWTYPE; next_attempt integer;
   BEGIN
     SELECT * INTO purchase FROM dialer_public_purchases WHERE id=p_purchase FOR UPDATE;
     IF NOT FOUND OR purchase.billing_version<>'native-20261031' OR purchase.paid_at IS NULL OR purchase.provider_status<>'active' THEN RAISE EXCEPTION 'PURCHASE_NOT_PAID'; END IF;
     IF p_pack NOT IN (0,1,10,50) OR p_billing NOT IN ('monthly','annual') THEN RAISE EXCEPTION 'INVALID_NUMBER_PACK'; END IF;
     SELECT * INTO current_attempt FROM dialer_native_number_components WHERE id=purchase.number_component_id FOR UPDATE;
     IF FOUND AND current_attempt.provider_status NOT IN ('expired','canceled','incomplete_expired') THEN
       IF current_attempt.requested_pack<>p_pack OR current_attempt.requested_billing<>p_billing THEN RAISE EXCEPTION 'NUMBER_CHECKOUT_PENDING'; END IF;
       RETURN to_jsonb(current_attempt);
     END IF;
     IF FOUND AND NOT p_restart THEN RETURN to_jsonb(current_attempt); END IF;
     SELECT COALESCE(MAX(attempt),0)+1 INTO next_attempt FROM dialer_native_number_components WHERE purchase_id=p_purchase;
     INSERT INTO dialer_native_number_components(id,purchase_id,attempt,requested_pack,requested_billing,provider_customer_id)
     VALUES(p_id,p_purchase,next_attempt,p_pack,p_billing,purchase.provider_customer_id) RETURNING * INTO current_attempt;
     UPDATE dialer_public_purchases SET number_component_id=p_id,generation=generation+1,updated_at=now() WHERE id=p_purchase;
     RETURN to_jsonb(current_attempt);
   END $$`,
  `CREATE OR REPLACE FUNCTION dialer_project_native_purchase(p_id text,p_generation bigint,p_customer text,p_subscription text,p_status text,p_items jsonb,p_selection jsonb,p_paid boolean,
   p_attempt text,p_number_subscription text,p_number_status text,p_number_paid boolean,p_number_pack integer,p_number_billing text)
   RETURNS boolean LANGUAGE plpgsql AS $$
   DECLARE purchase dialer_public_purchases%ROWTYPE; applied boolean; legacy_code text;
   BEGIN
     SELECT * INTO purchase FROM dialer_public_purchases WHERE id=p_id FOR UPDATE;
     IF NOT FOUND OR purchase.billing_version<>'native-20261031' OR purchase.generation<>p_generation OR purchase.number_component_id IS DISTINCT FROM p_attempt THEN RETURN false; END IF;
     IF purchase.provider_customer_id IS NOT NULL AND purchase.provider_customer_id<>p_customer THEN RAISE EXCEPTION 'PURCHASE_PROVIDER_MISMATCH'; END IF;
     IF purchase.provider_subscription_id IS NOT NULL AND purchase.provider_subscription_id<>p_subscription THEN RAISE EXCEPTION 'PURCHASE_PROVIDER_MISMATCH'; END IF;
     IF p_attempt IS NOT NULL THEN
       UPDATE dialer_native_number_components SET provider_subscription_id=p_number_subscription,
         provider_status=p_number_status,entitlement_pack=p_number_pack,entitlement_billing=p_number_billing,
         paid_at=CASE WHEN p_number_paid THEN COALESCE(paid_at,now()) ELSE paid_at END,updated_at=now()
       WHERE id=p_attempt AND purchase_id=p_id AND provider_customer_id=p_customer AND (provider_subscription_id IS NULL OR provider_subscription_id IS NOT DISTINCT FROM p_number_subscription);
       IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_PROVIDER_MISMATCH'; END IF;
     END IF;
     IF purchase.claimed_workspace_id IS NOT NULL THEN PERFORM dialer_reconcile_native_minute_debits(purchase.claimed_workspace_id); END IF;
     SELECT dialer_project_public_purchase(p_id,p_generation,p_customer,p_subscription,p_status,p_items,p_selection,p_paid) INTO applied;
     IF NOT applied THEN RAISE EXCEPTION 'PURCHASE_RECONCILIATION_PENDING'; END IF;
     IF purchase.claimed_workspace_id IS NOT NULL THEN
       legacy_code=CASE p_selection->>'plan' WHEN 'professional' THEN 'single' WHEN 'agency' THEN 'standard' WHEN 'enterprise' THEN 'power' END;
       IF legacy_code IS NULL THEN RAISE EXCEPTION 'INVALID_CHECKOUT_SELECTION'; END IF;
       UPDATE dialer_team_seats SET plan_code=legacy_code,updated_at=now() WHERE workspace_id=purchase.claimed_workspace_id AND status='active';
       PERFORM dialer_reconcile_native_minute_debits(purchase.claimed_workspace_id);
     END IF;
     RETURN true;
   END $$`,
] as const;
export const initializeNativeBillingStore = async (
  database: CommercialSqlClient,
) => {
  try {
    for (const statement of NATIVE_BILLING_SCHEMA)
      await database.query(statement);
  } catch (cause: unknown) {
    throw normalizeAsyncError(cause);
  }
};
export const createNativeBillingStore = (database: CommercialSqlClient) => ({
  async begin(input: {
    id: string;
    selection: unknown;
    claimHash: string;
    origin: string;
  }) {
    try {
      await database.query(
        `INSERT INTO dialer_public_purchases(id,selection,claim_hash,origin,billing_version) VALUES($1,$2::jsonb,$3,$4,'native-20261031') ON CONFLICT(id) DO NOTHING`,
        [
          input.id,
          JSON.stringify(input.selection),
          input.claimHash,
          input.origin,
        ],
      );
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async number(purchaseId: string) {
    try {
      return (
        await database.query(
          'SELECT n.* FROM dialer_native_number_components n JOIN dialer_public_purchases p ON p.number_component_id=n.id WHERE p.id=$1',
          [purchaseId],
        )
      ).rows[0] as Record<string, unknown> | undefined;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async beginNumber(input: {
    purchaseId: string;
    id: string;
    pack: number;
    billing: string;
    restart: boolean;
  }) {
    try {
      const row = (
        await database.query(
          'SELECT dialer_begin_native_number_component($1,$2,$3,$4,$5) AS attempt',
          [
            input.purchaseId,
            input.id,
            input.pack,
            input.billing,
            input.restart,
          ],
        )
      ).rows[0] as { attempt?: Record<string, unknown> } | undefined;
      if (!row?.attempt) throw new Error('NUMBER_COMPONENT_NOT_FOUND');
      return row.attempt;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async saveNumberSubscription(id: string, subscriptionId: string) {
    try {
      const result = await database.query(
        `UPDATE dialer_native_number_components SET provider_subscription_id=$2,updated_at=now() WHERE id=$1 AND (provider_subscription_id IS NULL OR provider_subscription_id=$2) RETURNING id`,
        [id, subscriptionId],
      );
      if (!result.rows.length) throw new Error('NUMBER_SUBSCRIPTION_CONFLICT');
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  async findSubscription(id: string) {
    try {
      return (
        await database.query(
          `SELECT p.* FROM dialer_public_purchases p LEFT JOIN dialer_native_number_components n ON n.purchase_id=p.id WHERE p.provider_subscription_id=$1 OR n.provider_subscription_id=$1 LIMIT 1`,
          [id],
        )
      ).rows[0] as Record<string, unknown> | undefined;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
});
