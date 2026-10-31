import { normalizeAsyncError } from '../errors/normalize-async-error';
import { randomUUID } from 'node:crypto';
import type { PublicCheckoutProvider, PublicPrice } from './public-checkout';
import { createNativeMinuteStore } from './native-minute-store';
import {
  nativeBillingVersion,
  nativePriceLookupKey,
  type NativePriceDefinition,
} from './native-billing-catalog';

type Row = Record<string, unknown>;
export const createNativeMinuteCheckout = (input: {
  store: ReturnType<typeof createNativeMinuteStore>;
  provider: PublicCheckoutProvider;
  websiteOrigin: string;
  prices: () => Promise<{
    byLookup: Map<string, PublicPrice>;
    byId: Map<string, NativePriceDefinition>;
  }>;
}) => {
  const safeUrl = (value: string | null | undefined) => {
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
  const reconcile = async (intent: Row) => {
    try {
      if (!intent.provider_session_id)
        throw new Error('PURCHASE_RECONCILIATION_PENDING');
      const session = await input.provider.retrieveSession(
        String(intent.provider_session_id),
      );
      if (
        session.mode !== 'payment' ||
        session.customerId !== intent.provider_customer_id ||
        session.metadata.nativeMinuteId !== intent.id ||
        session.metadata.enrollmentId !== intent.purchase_id ||
        session.metadata.catalogVersion !== nativeBillingVersion ||
        session.metadata.component !== 'minute_topup' ||
        session.subscription
      )
        throw new Error('PURCHASE_PROVIDER_MISMATCH');
      if (session.status === 'expired') {
        await input.store.expire(String(intent.id));
        return 'expired';
      }
      if (session.status !== 'complete') return 'pending';
      if (
        session.paymentStatus !== 'paid' &&
        session.paymentStatus !== 'no_payment_required'
      )
        return 'pending';
      if (!input.provider.retrieveLineItems)
        throw new Error('NATIVE_BILLING_UNAVAILABLE');
      const lines = await input.provider.retrieveLineItems(session.id),
        map = await input.prices();
      if (
        lines.length < 1 ||
        lines.length > 4 ||
        new Set(lines.map((line) => line.priceId)).size !== lines.length
      )
        throw new Error('MINUTE_ITEMS_MISMATCH');
      let minutes = 0,
        cents = 0,
        choice = false;
      for (const line of lines) {
        const price = map.byId.get(line.priceId);
        if (
          !price ||
          price.billing !== 'once' ||
          !Number.isSafeInteger(line.quantity) ||
          line.quantity < 1 ||
          line.quantity > 100
        )
          throw new Error('MINUTE_ITEMS_MISMATCH');
        if (price.role === 'choice' && line.quantity === 1) choice = true;
        else if (price.role === 'minutes' && price.pack) {
          minutes += price.pack * line.quantity;
          cents += price.unitAmount * line.quantity;
        } else throw new Error('MINUTE_ITEMS_MISMATCH');
      }
      if (
        !choice ||
        session.currency !== 'usd' ||
        session.amountTotal !== cents ||
        minutes > 210000 ||
        (cents > 0 && session.paymentStatus !== 'paid')
      )
        throw new Error('MINUTE_PAYMENT_MISMATCH');
      await input.store.grant(String(intent.id), session.id, minutes, cents);
      return 'paid';
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  const create = async (purchase: Row) => {
    try {
      if (!input.provider.findCheckoutSession)
        throw new Error('NATIVE_BILLING_UNAVAILABLE');
      for (let attempt = 0; attempt < 2; attempt++) {
        const intent = await input.store.begin(
          String(purchase.id),
          randomUUID(),
        );
        if (!intent) throw new Error('PURCHASE_NOT_PAID');
        if (!intent.provider_session_id) {
          const known = await input.provider.findCheckoutSession(
            String(intent.provider_customer_id),
            String(intent.id),
          );
          if (known) {
            await input.store.save(String(intent.id), known.id);
            intent.provider_session_id = known.id;
          }
        }
        if (intent.provider_session_id) {
          if ((await reconcile(intent)) !== 'pending') continue;
          const current = await input.provider.retrieveSession(
            String(intent.provider_session_id),
          );
          if (current.status !== 'open')
            throw new Error('PURCHASE_RECONCILIATION_PENDING');
          return { id: current.id, url: safeUrl(current.url) };
        }
        if (
          Date.now() - new Date(String(intent.created_at)).getTime() >
          1800000
        )
          throw new Error('PURCHASE_RECONCILIATION_PENDING');
        const map = await input.prices(),
          price = (code: string) =>
            map.byLookup.get(nativePriceLookupKey(code, 'once'))!.id;
        const metadata = {
          enrollmentId: String(purchase.id),
          nativeMinuteId: String(intent.id),
          catalogVersion: nativeBillingVersion,
          component: 'minute_topup',
        };
        const response = await input.provider.createSession(
          {
            mode: 'payment',
            customer: intent.provider_customer_id,
            client_reference_id: intent.id,
            line_items: [{ price: price('minutes-choice'), quantity: 1 }],
            optional_items: [100, 600, 1400].map((pack) => ({
              price: price('minutes-' + pack),
              quantity: 1,
              adjustable_quantity: { enabled: true, minimum: 1, maximum: 100 },
            })),
            metadata,
            invoice_creation: { enabled: true, invoice_data: { metadata } },
            success_url: new URL('/pricing/?minutes=paid', input.websiteOrigin)
              .href,
            cancel_url: new URL(
              '/pricing/?minutes=cancelled',
              input.websiteOrigin,
            ).href,
            expires_at:
              Math.floor(new Date(String(intent.created_at)).getTime() / 1000) +
              1800,
          },
          'native-minute-checkout:' + intent.id,
        );
        const url = safeUrl(response.url);
        await input.store.save(String(intent.id), response.id);
        return { id: response.id, url };
      }
      throw new Error('PURCHASE_RECONCILIATION_PENDING');
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  return { create, reconcile };
};
