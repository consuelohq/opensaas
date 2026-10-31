import {
  pricingPlans,
  minutePacks,
  numberPacks,
  quotePlan,
  type PlanCode,
  type BillingPeriod,
} from '../data/pricing-content';

export const mercuryMonthlyCents = 2500;
export type CheckoutSelection = {
  plan: PlanCode;
  billing: BillingPeriod;
  seats: number;
  mercurySeats: number;
  minutePack: number;
  numberPack: number;
};
export const validateSelection = (
  value: CheckoutSelection,
): CheckoutSelection => {
  quotePlan(value.plan, value.billing, value.seats);
  if (
    !Number.isInteger(value.mercurySeats) ||
    value.mercurySeats < 0 ||
    value.mercurySeats > value.seats ||
    (value.minutePack !== 0 &&
      !minutePacks.some((p) => p.minutes === value.minutePack)) ||
    (value.numberPack !== 0 &&
      !numberPacks.some((p) => p.numbers === value.numberPack)) ||
    (value.plan === 'starter' &&
      (value.seats !== 1 ||
        value.mercurySeats ||
        value.minutePack ||
        value.numberPack))
  ) {
    throw new Error('Choose a valid plan, seat count and add-ons.');
  }
  return {
    plan: value.plan,
    billing: value.billing,
    seats: value.seats,
    mercurySeats: value.mercurySeats,
    minutePack: value.minutePack,
    numberPack: value.numberPack,
  };
};
export const selectionFromQuery = (
  query: URLSearchParams,
): CheckoutSelection => {
  const plan =
    pricingPlans.find((p) => p.code === query.get('plan'))?.code ??
    'professional';
  const seats = query.has('seats') ? Number(query.get('seats')) : 1;
  const addon = query.get('addon');
  return validateSelection({
    plan,
    billing: query.get('billing') === 'annual' ? 'annual' : 'monthly',
    seats,
    mercurySeats: query.has('mercurySeats')
      ? Number(query.get('mercurySeats'))
      : addon === 'mercury'
        ? seats
        : 0,
    minutePack: query.has('minutePack')
      ? Number(query.get('minutePack'))
      : addon?.startsWith('minutes-')
        ? Number(addon.slice(8))
        : 0,
    numberPack: query.has('numberPack')
      ? Number(query.get('numberPack'))
      : addon?.startsWith('numbers-')
        ? Number(addon.slice(8))
        : 0,
  });
};
export const selectionToQuery = (
  selection: CheckoutSelection,
): URLSearchParams => {
  const value = validateSelection(selection);
  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(value).map(([key, value]) => [key, String(value)]),
    ),
  );
};
export const quoteCheckout = (selection: CheckoutSelection) => {
  const value = validateSelection(selection);
  const plan = pricingPlans.find((p) => p.code === value.plan)!;
  const months = value.billing === 'annual' ? 12 : 1;
  const recurringMonthlyCents =
    plan.monthlyCents * value.seats +
    mercuryMonthlyCents * value.mercurySeats +
    (numberPacks.find((p) => p.numbers === value.numberPack)?.priceCents ?? 0);
  const oneTimeCents =
    minutePacks.find((p) => p.minutes === value.minutePack)?.priceCents ?? 0;
  return {
    recurringCents: recurringMonthlyCents * months,
    recurringMonthlyCents,
    oneTimeCents,
    dueCents: recurringMonthlyCents * months + oneTimeCents,
    months,
  };
};
export const checkoutPayload = (
  selection: CheckoutSelection,
  requestId: string,
  claimToken: string,
) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestId,
    )
  )
    throw new Error('Invalid checkout request.');
  if (selection.plan === 'starter')
    throw new Error('Starter does not require payment.');
  if (!/^[A-Za-z0-9_-]{43}$/.test(claimToken))
    throw new Error('Invalid setup token.');
  return {
    version: 1,
    requestId,
    claimToken,
    selection: validateSelection(selection),
  };
};
export const stripeCheckoutUrl = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Checkout URL is missing.');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'checkout.stripe.com' ||
    url.username ||
    url.password ||
    url.port ||
    !url.pathname.startsWith('/c/')
  ) {
    throw new Error('Checkout URL is invalid.');
  }
  return url.href;
};
