import { createNativeMinuteStore } from './native-minute-store';
import { createNativeMinuteCheckout } from './native-minute-checkout';
import { createHmac, randomUUID } from 'node:crypto';
import { authorizeCommercialAction } from '../teams/application';
import type { DialerIdentity } from '../contracts';
import { normalizeAsyncError } from '../errors/normalize-async-error';
import {
  checkoutRecord as record,
  checkoutUuid as uuid,
  checkoutTokenHash as tokenHash,
  verifyCheckoutClaim as verifyClaim,
  checkoutSelectionOnly as selectionOnly,
  isPublicCheckoutOrigin,
  type PublicCheckout,
  type PublicCheckoutProvider,
  type PublicPrice,
  type PublicSubscription,
} from './public-checkout';
import { createPublicCheckoutStore } from './public-checkout-store';
import { createNativeBillingStore } from './native-billing-store';
import {
  nativeBillingVersion,
  nativePriceDefinitions,
  nativePriceLookupKey,
  normalizeNativeSubscription,
  quoteNativeCheckout,
  type NativePriceDefinition,
} from './native-billing-catalog';
import {
  publicCheckoutCatalog,
  publicNumberPacks,
  type PublicSelection,
} from './public-checkout-catalog';

type Store = ReturnType<typeof createPublicCheckoutStore>;
type Purchase = Record<string, unknown>;
type ProjectionItem = {
  code: string;
  id: string;
  priceId: string;
  quantity: number;
};
const native = (purchase: Purchase | undefined) =>
  purchase?.billing_version === nativeBillingVersion;
const authorize = (identity: DialerIdentity) =>
  authorizeCommercialAction({
    identity: {
      workspaceId: identity.workspaceId,
      userId: identity.userId,
      role: identity.role ?? 'user',
    },
    targetWorkspaceId: identity.workspaceId,
    action: 'billing.manage',
  });
const portalUrl = (value: string) => {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'billing.stripe.com' ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error('BILLING_PORTAL_URL_INVALID');
  return url.href;
};
const hostedUrl = (value: string | null) => {
  if (!value) throw new Error('CHECKOUT_PROVIDER_URL_INVALID');
  const url = new URL(value);
  if (
    url.origin !== 'https://checkout.stripe.com' ||
    url.username ||
    url.password
  )
    throw new Error('CHECKOUT_PROVIDER_URL_INVALID');
  return url.href;
};
export const createNativeCheckout = (input: {
  legacy: PublicCheckout;
  store: Store;
  nativeStore: ReturnType<typeof createNativeBillingStore>;
  provider: PublicCheckoutProvider;
  enabled: boolean;
  rateLimitSecret: string;
  websiteOrigin: string;
  installUrl: string;
  portalConfigurations: { base: string; numbers: string };
}) => {
  let loading:
    | Promise<{
        byLookup: Map<string, PublicPrice>;
        byId: Map<string, NativePriceDefinition>;
      }>
    | undefined;
  const prices = () =>
    (loading ??= (async () => {
      try {
        const rows = await input.provider.listPrices(
          nativePriceDefinitions.map((definition) =>
            nativePriceLookupKey(definition.code, definition.billing),
          ),
        );
        const byLookup = new Map<string, PublicPrice>(),
          byId = new Map<string, NativePriceDefinition>();
        for (const definition of nativePriceDefinitions) {
          const lookup = nativePriceLookupKey(
              definition.code,
              definition.billing,
            ),
            matches = rows.filter((row) => row.lookupKey === lookup);
          const price = matches[0];
          if (
            matches.length !== 1 ||
            price.unitAmount !== definition.unitAmount ||
            price.currency !== 'usd' ||
            price.interval !==
              (definition.billing === 'once'
                ? null
                : definition.billing === 'annual'
                  ? 'year'
                  : 'month') ||
            !price.productId ||
            byId.has(price.id)
          )
            throw new Error('NATIVE_PRICE_CATALOG_MISMATCH');
          byLookup.set(lookup, price);
          byId.set(price.id, definition);
        }
        return { byLookup, byId };
      } catch (cause: unknown) {
        loading = undefined;
        throw normalizeAsyncError(cause);
      }
    })());
  const priceFor = async (code: string, billing: string) => {
    try {
      const price = (await prices()).byLookup.get(
        nativePriceLookupKey(code, billing),
      );
      if (!price) throw new Error('NATIVE_PRICE_NOT_FOUND');
      return price;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const minuteStore = createNativeMinuteStore(input.store.database);
  const minuteCheckout = createNativeMinuteCheckout({
    store: minuteStore,
    provider: input.provider,
    websiteOrigin: input.websiteOrigin,
    prices,
  });
  const getOwned = async (identity: DialerIdentity) => {
    try {
      authorize(identity);
      const purchase = await input.store.claimed(identity.workspaceId);
      if (!native(purchase)) throw new Error('NATIVE_PURCHASE_NOT_FOUND');
      return purchase!;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const numberProjection = (
    subscription: PublicSubscription,
    map: Map<string, NativePriceDefinition>,
  ) => normalizeNativeSubscription(subscription.items, map, 'numbers');
  const checkNumber = (
    subscription: PublicSubscription,
    purchase: Purchase,
    attempt: Purchase,
  ) => {
    if (
      subscription.customerId !== purchase.provider_customer_id ||
      subscription.metadata.enrollmentId !== purchase.id ||
      subscription.metadata.attemptId !== attempt.id ||
      subscription.metadata.component !== 'number_pool' ||
      subscription.metadata.catalogVersion !== nativeBillingVersion
    )
      throw new Error('PURCHASE_PROVIDER_MISMATCH');
  };
  const ensureNumber = async (purchase: Purchase, restart: boolean) => {
    try {
      if (
        !input.provider.createSubscription ||
        !input.provider.retrieveSubscription ||
        !input.provider.findNumberSubscription
      )
        throw new Error('NATIVE_BILLING_UNAVAILABLE');
      const selection = selectionOnly(
        purchase.entitlement_selection ?? purchase.selection,
      );
      const attempt = await input.nativeStore.beginNumber({
        purchaseId: String(purchase.id),
        id: randomUUID(),
        pack: selectionOnly(purchase.selection).numberPack,
        billing: selection.billing,
        restart,
      });
      if (attempt.provider_subscription_id) return attempt;
      let found = await input.provider.findNumberSubscription(
        String(purchase.provider_customer_id),
        String(attempt.id),
      );
      if (!found) {
        if (
          Date.now() - new Date(String(attempt.created_at)).getTime() >
          1800000
        )
          throw new Error('PURCHASE_RECONCILIATION_PENDING');
        const free = await priceFor(
          'numbers-0',
          String(attempt.requested_billing),
        );
        if (free.unitAmount !== 0)
          throw new Error('NATIVE_FREE_COMPONENT_PRICE_MISMATCH');
        const base = await input.provider.retrieveSubscription(
          String(purchase.provider_subscription_id),
        );
        if (
          base.customerId !== purchase.provider_customer_id ||
          base.metadata.enrollmentId !== purchase.id
        )
          throw new Error('PURCHASE_PROVIDER_MISMATCH');
        found = await input.provider.createSubscription(
          {
            customer: purchase.provider_customer_id,
            ...(base.defaultPaymentMethodId
              ? { default_payment_method: base.defaultPaymentMethodId }
              : {}),
            items: [{ price: free.id, quantity: 1 }],
            payment_behavior: 'default_incomplete',
            proration_behavior: 'none',
            metadata: {
              enrollmentId: String(purchase.id),
              attemptId: String(attempt.id),
              component: 'number_pool',
              catalogVersion: nativeBillingVersion,
            },
          },
          'native-number-component:' + attempt.id,
        );
        if (
          found.latestInvoiceAmountDue !== 0 ||
          found.status !== 'active' ||
          numberProjection(found, (await prices()).byId).numberPack !== 0
        )
          throw new Error('NATIVE_FREE_COMPONENT_UNSAFE');
      }
      checkNumber(found, purchase, attempt);
      await input.nativeStore.saveNumberSubscription(
        String(attempt.id),
        found.id,
      );
      return (await input.nativeStore.number(String(purchase.id)))!;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const createPortal = async (
    purchase: Purchase,
    component: 'base' | 'numbers',
    target?: { price: string; quantity: number },
  ) => {
    try {
      if (!input.provider.createPortal)
        throw new Error('BILLING_PORTAL_UNAVAILABLE');
      const configuration = input.portalConfigurations[component];
      if (!configuration) throw new Error('BILLING_PORTAL_UNAVAILABLE');
      const number =
        component === 'numbers'
          ? await input.nativeStore.number(String(purchase.id))
          : undefined;
      const subscriptionId =
        component === 'base'
          ? purchase.provider_subscription_id
          : number?.provider_subscription_id;
      if (!subscriptionId) throw new Error('BILLING_SUBSCRIPTION_NOT_FOUND');
      const success = new URL('/get-started', String(purchase.origin));
      success.searchParams.set('purchase', String(purchase.id));
      success.searchParams.set('numbers', 'done');
      const cancel = new URL(success);
      cancel.searchParams.set('checkout', 'cancelled');
      let flow: Record<string, unknown> = {
        type: 'subscription_update',
        subscription_update: { subscription: subscriptionId },
      };
      if (target) {
        if (!input.provider.retrieveSubscription)
          throw new Error('NATIVE_BILLING_UNAVAILABLE');
        const current = await input.provider.retrieveSubscription(
          String(subscriptionId),
        );
        if (
          current.customerId !== purchase.provider_customer_id ||
          current.metadata.enrollmentId !== purchase.id
        )
          throw new Error('PURCHASE_PROVIDER_MISMATCH');
        normalizeNativeSubscription(
          current.items,
          (await prices()).byId,
          component === 'base' ? 'base' : 'numbers',
        );
        flow = {
          type: 'subscription_update_confirm',
          subscription_update_confirm: {
            subscription: subscriptionId,
            items: [
              {
                id: current.items[0].id,
                price: target.price,
                quantity: target.quantity,
              },
            ],
          },
          after_completion: {
            type: 'redirect',
            redirect: { return_url: success.href },
          },
        };
      }
      const result = await input.provider.createPortal({
        customer: purchase.provider_customer_id,
        configuration,
        return_url: cancel.href,
        ...(record(purchase.entitlement_selection).paymentPending !== true &&
        ['active', 'trialing'].includes(
          String(
            component === 'base'
              ? purchase.provider_status
              : number?.provider_status,
          ),
        )
          ? { flow_data: flow }
          : {}),
      });
      return { id: result.id, url: portalUrl(result.url) };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const project = async (
    purchase: Purchase,
    generation: number,
    subscription: PublicSubscription,
    items: ProjectionItem[],
    selection: PublicSelection,
    number: Purchase | undefined,
    numberSub: PublicSubscription | undefined,
    numberPack: number,
    numberBilling: string | null,
    baseStatus: string,
    paymentPending: boolean,
  ) => {
    try {
      const result = await input.store.database.query(
        'SELECT dialer_project_native_purchase($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14) AS applied',
        [
          purchase.id,
          generation,
          subscription.customerId,
          subscription.id,
          baseStatus,
          JSON.stringify(items),
          JSON.stringify({
            ...selection,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            paymentPending,
          }),
          true,
          number?.id ?? null,
          numberSub?.id ?? number?.provider_subscription_id ?? null,
          numberSub?.status ?? number?.provider_status ?? null,
          !!numberSub && numberPack > 0 && numberSub.latestInvoicePaid === true,
          numberPack,
          numberBilling,
        ],
      );
      if (!record(result.rows[0]).applied)
        throw new Error('PURCHASE_RECONCILIATION_PENDING');
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const reconcile = async (
    purchase: Purchase,
    allowProvision = true,
  ): Promise<{
    paid: boolean;
    status: string;
    generation: number;
    claimed: boolean;
    allSelectedPaid: boolean;
    paymentPending: boolean;
    nextPortalUrl: string | null;
  }> => {
    try {
      const generation = await input.store.generation(String(purchase.id));
      if (!purchase.provider_session_id)
        return {
          paid: false,
          status: 'pending',
          generation,
          claimed: !!purchase.claimed_workspace_id,
          allSelectedPaid: false,
          paymentPending: false,
          nextPortalUrl: null,
        };
      const session = await input.provider.retrieveSession(
        String(purchase.provider_session_id),
      );
      if (
        session.metadata.enrollmentId !== purchase.id ||
        session.metadata.catalogVersion !== nativeBillingVersion
      )
        throw new Error('PURCHASE_PROVIDER_MISMATCH');
      if (
        session.status !== 'complete' ||
        session.paymentStatus !== 'paid' ||
        !session.subscription
      )
        return {
          paid: false,
          status: session.status === 'expired' ? 'expired' : 'pending',
          generation,
          claimed: !!purchase.claimed_workspace_id,
          allSelectedPaid: false,
          paymentPending: false,
          nextPortalUrl: null,
        };
      const base = session.subscription;
      if (
        base.metadata.enrollmentId !== purchase.id ||
        base.metadata.catalogVersion !== nativeBillingVersion ||
        base.customerId !== session.customerId ||
        !session.customerId ||
        (purchase.provider_customer_id &&
          purchase.provider_customer_id !== base.customerId) ||
        (purchase.provider_subscription_id &&
          purchase.provider_subscription_id !== base.id)
      )
        throw new Error('PURCHASE_PROVIDER_MISMATCH');
      const map = await prices(),
        initial = selectionOnly(purchase.selection),
        observed = normalizeNativeSubscription(base.items, map.byId, 'base');
      const initialBase = {
        plan: initial.plan,
        billing: initial.billing,
        seats: initial.seats,
        mercurySeats: initial.mercurySeats,
      };
      if (
        !purchase.paid_at &&
        JSON.stringify(observed) !== JSON.stringify(initialBase)
      )
        throw new Error('NATIVE_INITIAL_ITEMS_MISMATCH');
      const previous = purchase.entitlement_selection
        ? selectionOnly(purchase.entitlement_selection)
        : initial;
      const changed =
        observed.plan !== previous.plan ||
        observed.billing !== previous.billing ||
        observed.seats !== previous.seats ||
        observed.mercurySeats !== previous.mercurySeats;
      const waiting =
        !!purchase.paid_at &&
        (base.pendingUpdate === true ||
          (changed && base.latestInvoicePaid !== true));
      const selected = waiting
        ? {
            plan: previous.plan,
            billing: previous.billing,
            seats: previous.seats,
            mercurySeats: previous.mercurySeats,
          }
        : observed;
      const actual = base.items[0],
        oldItems = (purchase.provider_items ?? []) as ProjectionItem[];
      const baseItem = waiting
        ? oldItems.find((item) =>
            ['single', 'standard', 'power'].includes(item.code),
          )
        : {
            code: publicCheckoutCatalog[selected.plan].legacyCode,
            id: actual.id,
            priceId: actual.priceId,
            quantity: selected.seats,
          };
      if (!baseItem) throw new Error('NATIVE_BASE_PROJECTION_MISSING');
      const items: ProjectionItem[] = [baseItem];
      if (selected.mercurySeats) {
        const oldMercury = oldItems.find((item) => item.code === 'mercury');
        items.push(
          waiting && oldMercury
            ? oldMercury
            : {
                code: 'mercury',
                id: actual.id + ':mercury',
                priceId: actual.priceId,
                quantity: selected.mercurySeats,
              },
        );
      }
      const attempt = await input.nativeStore.number(String(purchase.id));
      let numberSub: PublicSubscription | undefined,
        numberPack = 0,
        numberBilling: string | null = null,
        numberWaiting = false;
      if (attempt?.provider_subscription_id) {
        if (!input.provider.retrieveSubscription)
          throw new Error('NATIVE_BILLING_UNAVAILABLE');
        numberSub = await input.provider.retrieveSubscription(
          String(attempt.provider_subscription_id),
        );
        checkNumber(
          numberSub,
          { ...purchase, provider_customer_id: base.customerId },
          attempt,
        );
        const observedNumber = numberProjection(numberSub, map.byId);
        numberWaiting =
          numberSub.pendingUpdate === true ||
          ((observedNumber.numberPack !==
            Number(attempt.entitlement_pack ?? 0) ||
            observedNumber.billing !==
              String(attempt.entitlement_billing ?? observedNumber.billing)) &&
            numberSub.latestInvoicePaid !== true);
        numberBilling = numberWaiting
          ? String(attempt.entitlement_billing ?? observedNumber.billing)
          : observedNumber.billing;
        numberPack =
          numberSub.status === 'active'
            ? numberWaiting
              ? Number(attempt.entitlement_pack ?? 0)
              : observedNumber.numberPack
            : 0;
        if (numberPack)
          items.push({
            code: 'additional-number',
            id: numberSub.items[0].id,
            priceId: numberSub.items[0].priceId,
            quantity: numberPack,
          });
      }
      const selection = {
        ...selected,
        minutePack: initial.minutePack,
        numberPack,
      };
      await project(
        purchase,
        generation,
        base,
        items,
        selection,
        attempt,
        numberSub,
        numberPack,
        numberBilling,
        base.status,
        waiting || numberWaiting,
      );
      let fresh = (await input.store.get(String(purchase.id)))!;
      if (
        allowProvision &&
        base.status === 'active' &&
        ((initial.numberPack > 0 && !attempt) ||
          (attempt &&
            !attempt.provider_subscription_id &&
            attempt.provider_status === 'pending'))
      ) {
        await ensureNumber(fresh, false);
        fresh = (await input.store.get(String(purchase.id)))!;
        return reconcile(fresh, false);
      }
      const current = attempt
        ? await input.nativeStore.number(String(purchase.id))
        : undefined;
      const allSelectedPaid = initial.numberPack === 0 || !!current?.paid_at;
      let nextPortalUrl: string | null = null;
      if (
        !allSelectedPaid &&
        current?.provider_status === 'active' &&
        numberPack === 0 &&
        !numberWaiting
      ) {
        const target = await priceFor(
          'numbers-' + initial.numberPack,
          String(current.entitlement_billing ?? current.requested_billing),
        );
        nextPortalUrl = (
          await createPortal(fresh, 'numbers', {
            price: target.id,
            quantity: 1,
          })
        ).url;
      }
      return {
        paid: true,
        status: base.status,
        generation,
        claimed: !!fresh.claimed_workspace_id,
        allSelectedPaid,
        paymentPending: waiting || numberWaiting,
        nextPortalUrl,
      };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const continueNumbers = async (idValue: unknown, token: unknown) => {
    try {
      const purchase = await input.store.get(uuid(idValue));
      verifyClaim(purchase, token);
      if (!native(purchase)) throw new Error('NATIVE_PURCHASE_NOT_FOUND');
      const result = await reconcile(purchase!);
      if (!result.paid || result.status !== 'active')
        throw new Error('PURCHASE_NOT_PAID');
      const fresh = (await input.store.get(String(purchase!.id)))!;
      await ensureNumber(fresh, true);
      const current = (await input.nativeStore.number(String(purchase!.id)))!;
      const pack = selectionOnly(purchase!.selection).numberPack;
      if (!pack) return createPortal(fresh, 'numbers');
      const price = await priceFor(
        'numbers-' + pack,
        String(current.entitlement_billing ?? current.requested_billing),
      );
      return createPortal(fresh, 'numbers', { price: price.id, quantity: 1 });
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const managedPortal = async (identity: DialerIdentity, body: unknown) => {
    try {
      let purchase = await getOwned(identity);
      await reconcile(purchase);
      purchase = (await input.store.get(String(purchase.id)))!;
      if (record(body).component === 'minutes')
        return minuteCheckout.create(purchase);
      const component =
        record(body).component === 'numbers' ? 'numbers' : 'base';
      if (component === 'numbers') {
        await ensureNumber(purchase, true);
        purchase = (await input.store.get(String(purchase.id)))!;
      }
      return createPortal(purchase, component);
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const managedCheckout = async (identity: DialerIdentity, body: unknown) => {
    try {
      let purchase = await getOwned(identity);
      await reconcile(purchase);
      purchase = (await input.store.get(String(purchase.id)))!;
      const value = record(body);
      if (value.component === 'minutes') return minuteCheckout.create(purchase);
      if (value.component === 'numbers') {
        await ensureNumber(purchase, true);
        const component = (await input.nativeStore.number(
          String(purchase.id),
        ))!;
        if (value.pack === undefined) return createPortal(purchase, 'numbers');
        const pack = Number(value.pack);
        if (
          pack !== 0 &&
          !Object.prototype.hasOwnProperty.call(publicNumberPacks, pack)
        )
          throw new Error('INVALID_NUMBER_PACK');
        const price = await priceFor(
          'numbers-' + pack,
          String(component.entitlement_billing ?? component.requested_billing),
        );
        return createPortal(purchase, 'numbers', {
          price: price.id,
          quantity: 1,
        });
      }
      const current = selectionOnly(purchase.entitlement_selection),
        quantities = record(value.quantities),
        mapping = {
          single: 'professional',
          standard: 'agency',
          power: 'enterprise',
        } as const;
      const chosen = Object.entries(mapping).filter(
        ([key]) => Number(quantities[key] ?? 0) > 0,
      );
      if (chosen.length > 1) throw new Error('CHOOSE_ONE_PLAN');
      const plan = chosen.length ? chosen[0][1] : current.plan;
      const seats = chosen.length
        ? Number(quantities[chosen[0][0]])
        : value.seats === undefined
          ? current.seats
          : Number(value.seats);
      if (!Number.isInteger(seats) || seats < 1 || seats > 1000)
        throw new Error('INVALID_SEAT_QUANTITY');
      const coaching =
        value.component === 'mercury' ? true : current.mercurySeats > 0;
      const price = await priceFor(
        plan + (coaching ? '-with-mercury' : ''),
        current.billing,
      );
      return createPortal(purchase, 'base', {
        price: price.id,
        quantity: seats,
      });
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const capacityFor = async (identity: DialerIdentity) => {
    try {
      const purchase = await input.store.claimed(identity.workspaceId);
      if (!native(purchase)) return { allowed: true };
      const selection = selectionOnly(purchase!.entitlement_selection);
      const counts = record(
        (
          await input.store.database.query(
            `SELECT
      (SELECT count(*) FROM dialer_team_seats WHERE workspace_id=$1 AND status='active') AS seats,
      (SELECT count(*) FROM dialer_phone_numbers WHERE workspace_id=$1 AND status='active') AS numbers`,
            [identity.workspaceId],
          )
        ).rows[0],
      );
      return {
        allowed:
          Number(counts.seats) <= selection.seats &&
          Number(counts.numbers) <=
            selection.seats * publicCheckoutCatalog[selection.plan].numbers +
              selection.numberPack,
      };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  return {
    ...input.legacy,
    native: {
      capacityFor,
      isNative: async (workspaceId: string) =>
        native(await input.store.claimed(workspaceId)),
      createPortal: managedPortal,
      createCheckout: managedCheckout,
    },
    continueNumbers,
    ready: async () => {
      try {
        if (input.enabled) {
          await prices();
          if (
            !input.portalConfigurations.base ||
            !input.portalConfigurations.numbers
          )
            throw new Error('BILLING_PORTAL_UNAVAILABLE');
          return { ready: true };
        }
        return input.legacy.ready();
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    create: async (
      body: unknown,
      context: { origin: string; clientAddress: string },
    ) => {
      try {
        const value = record(body),
          id = uuid(value.requestId),
          existing = await input.store.get(id);
        if ((existing && !native(existing)) || (!existing && !input.enabled))
          return input.legacy.create(body, context);
        if (!isPublicCheckoutOrigin(context.origin))
          throw new Error('CHECKOUT_ORIGIN_DENIED');
        if (
          value.version !== 1 ||
          Object.keys(value).some(
            (key) =>
              !['version', 'requestId', 'selection', 'claimToken'].includes(
                key,
              ),
          )
        )
          throw new Error('INVALID_CHECKOUT_REQUEST');
        const hash = tokenHash(value.claimToken),
          quote = quoteNativeCheckout(value.selection);
        if (!existing)
          await input.store.rateLimit(
            createHmac('sha256', input.rateLimitSecret)
              .update(
                'public-checkout:' +
                  context.clientAddress +
                  ':' +
                  Math.floor(Date.now() / 3600000),
              )
              .digest('hex'),
          );
        await input.nativeStore.begin({
          id,
          selection: quote.selection,
          claimHash: hash,
          origin: context.origin,
        });
        const purchase = (await input.store.get(id))!;
        verifyClaim(purchase, value.claimToken);
        if (
          JSON.stringify(selectionOnly(purchase.selection)) !==
            JSON.stringify(quote.selection) ||
          purchase.origin !== context.origin ||
          !native(purchase)
        )
          throw new Error('CHECKOUT_REQUEST_CONFLICT');
        if (
          Date.now() - new Date(String(purchase.created_at)).getTime() >
          1800000
        ) {
          if (!purchase.provider_session_id)
            throw new Error('PURCHASE_RECONCILIATION_PENDING');
          const current = await input.provider.retrieveSession(
            String(purchase.provider_session_id),
          );
          if (current.status === 'expired')
            throw new Error('CHECKOUT_SESSION_EXPIRED');
          throw new Error(
            current.status === 'complete'
              ? 'PURCHASE_ALREADY_PAID'
              : 'PURCHASE_RECONCILIATION_PENDING',
          );
        }
        const success = new URL('/get-started', context.origin);
        success.searchParams.set('purchase', id);
        const cancel = new URL(success);
        cancel.searchParams.set('checkout', 'cancelled');
        const map = await prices();
        const response = await input.provider.createSession(
          {
            mode: 'subscription',
            client_reference_id: id,
            line_items: quote.baseItems.map((item) => ({
              price: map.byLookup.get(
                nativePriceLookupKey(item.code, item.billing),
              )!.id,
              quantity: item.quantity,
            })),
            metadata: {
              enrollmentId: id,
              catalogVersion: nativeBillingVersion,
              component: 'base',
            },
            subscription_data: {
              metadata: {
                enrollmentId: id,
                catalogVersion: nativeBillingVersion,
                component: 'base',
              },
            },
            success_url: success.href,
            cancel_url: cancel.href,
            expires_at:
              Math.floor(
                new Date(String(purchase.created_at)).getTime() / 1000,
              ) + 1800,
            ...(quote.numberItems.length
              ? {
                  custom_text: {
                    submit: {
                      message:
                        'Your calling plan and number pool have separate subscriptions and invoices. After this payment, Stripe will ask you to confirm the selected number pack and any proration. No number-pack charge is made until you confirm.',
                    },
                  },
                }
              : {}),
          },
          'native-base-checkout:' + id,
        );
        const url = hostedUrl(response.url);
        await input.store.saveSession(id, response.id);
        return { id, url };
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    status: async (idValue: unknown, token: unknown) => {
      try {
        const purchase = await input.store.get(uuid(idValue));
        if (!native(purchase)) {
          const previous = await input.legacy.status(idValue, token);
          return {
            ...previous,
            allSelectedPaid: previous.paid,
            paymentPending: false,
            nextPortalUrl: null,
          };
        }
        verifyClaim(purchase, token);
        const result = await reconcile(purchase!);
        return {
          purchaseId: purchase!.id,
          ...result,
          installUrl: result.paid ? input.installUrl : null,
        };
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    claim: async (identity: DialerIdentity, body: unknown) => {
      try {
        const value = record(body),
          id = uuid(value.purchaseId),
          purchase = await input.store.get(id);
        if (!native(purchase)) return input.legacy.claim(identity, body);
        authorize(identity);
        const hash = verifyClaim(purchase, value.claimToken),
          result = await reconcile(purchase!);
        if (!result.paid || result.status !== 'active')
          throw new Error('PURCHASE_NOT_PAID');
        return record(
          (
            await input.store.database.query(
              'SELECT dialer_claim_public_purchase($1,$2,$3,$4,$5) AS result',
              [
                id,
                hash,
                identity.workspaceId,
                identity.userId,
                result.generation,
              ],
            )
          ).rows[0],
        ).result;
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    webhook: async (event: Parameters<PublicCheckout['webhook']>[0]) => {
      try {
        const object = record(record(event.data).object),
          metadata = record(object.metadata);
        let purchase =
          typeof metadata.enrollmentId === 'string'
            ? await input.store.get(metadata.enrollmentId)
            : undefined;
        if (!purchase) {
          const parent = record(object.parent),
            details = record(parent.subscription_details);
          const id =
            typeof object.subscription === 'string'
              ? object.subscription
              : typeof details.subscription === 'string'
                ? details.subscription
                : typeof object.id === 'string' && object.id.startsWith('sub_')
                  ? object.id
                  : '';
          if (id) purchase = await input.nativeStore.findSubscription(id);
        }
        if (!native(purchase)) return input.legacy.webhook(event);
        await input.store.database.query(
          'INSERT INTO dialer_public_purchase_events(provider_event_id,purchase_id,event_type) VALUES($1,$2,$3) ON CONFLICT(provider_event_id) DO UPDATE SET attempts=dialer_public_purchase_events.attempts+1',
          [event.id, purchase!.id, event.type],
        );
        try {
          if (
            metadata.component === 'minute_topup' &&
            typeof metadata.nativeMinuteId === 'string'
          ) {
            const intent = await minuteStore.get(metadata.nativeMinuteId);
            if (!intent || intent.purchase_id !== purchase!.id)
              throw new Error('PURCHASE_PROVIDER_MISMATCH');
            if (
              !intent.provider_session_id &&
              typeof object.id === 'string' &&
              object.id.startsWith('cs_')
            )
              await minuteStore.save(String(intent.id), object.id);
            await minuteCheckout.reconcile(
              (await minuteStore.get(String(intent.id)))!,
            );
          } else {
            if (
              !purchase!.provider_session_id &&
              metadata.component === 'base' &&
              metadata.catalogVersion === nativeBillingVersion &&
              typeof object.id === 'string' &&
              object.id.startsWith('cs_')
            ) {
              const recovered = await input.provider.retrieveSession(object.id);
              if (
                recovered.mode !== 'subscription' ||
                recovered.metadata.enrollmentId !== purchase!.id ||
                recovered.metadata.catalogVersion !== nativeBillingVersion ||
                recovered.metadata.component !== 'base'
              )
                throw new Error('PURCHASE_PROVIDER_MISMATCH');
              await input.store.saveSession(String(purchase!.id), recovered.id);
              purchase = (await input.store.get(String(purchase!.id)))!;
            }
            await reconcile(purchase!);
          }
          await input.store.database.query(
            'UPDATE dialer_public_purchase_events SET processed_at=now(),last_error_code=NULL WHERE provider_event_id=$1',
            [event.id],
          );
        } catch (cause: unknown) {
          await input.store.database.query(
            "UPDATE dialer_public_purchase_events SET last_error_code='NATIVE_PURCHASE_RECONCILIATION_FAILED' WHERE provider_event_id=$1",
            [event.id],
          );
          throw normalizeAsyncError(cause);
        }
        return true;
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    catalogFor: async (identity: DialerIdentity) => {
      try {
        const catalog = await input.legacy.catalogFor(identity),
          purchase = await input.store.claimed(identity.workspaceId);
        if (!catalog || !native(purchase)) return catalog;
        const selection = selectionOnly(purchase!.entitlement_selection),
          definition = publicCheckoutCatalog[selection.plan];
        const allowance = await minuteStore.allowance(
          identity.workspaceId,
          identity.userId,
        );
        const remaining = Math.max(
          0,
          Number(allowance.granted) - Number(allowance.consumed),
        );
        catalog.plans[definition.legacyCode].includedMinutes =
          Math.max(definition.minutes, Number(allowance.used)) + remaining;
        return catalog;
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    summaryFor: async (workspaceId: string) => {
      try {
        const purchase = await input.store.claimed(workspaceId);
        if (!native(purchase)) return input.legacy.summaryFor(workspaceId);
        const selection = selectionOnly(purchase!.entitlement_selection),
          number = await input.nativeStore.number(String(purchase!.id)),
          base = quoteNativeCheckout({
            ...selection,
            numberPack: 0,
            minutePack: 0,
          });
        const numberBilling = number?.entitlement_billing ?? selection.billing,
          numberPrice = selection.numberPack
            ? await priceFor(
                'numbers-' + selection.numberPack,
                String(numberBilling),
              )
            : undefined;
        return {
          ...selection,
          recurringCents: base.baseDueCents,
          baseRecurringCents: base.baseDueCents,
          numberRecurringCents: numberPrice?.unitAmount ?? 0,
          numberBilling,
          separateInvoices: true,
          numberStatus: String(number?.provider_status ?? 'not_selected'),
          paymentPending:
            record(purchase!.entitlement_selection).paymentPending === true,
        };
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
  };
};
