export const publicCheckoutCatalog = {
  professional: {
    monthlyCents: 9900,
    minutes: 1000,
    numbers: 3,
    legacyCode: 'single',
  },
  agency: {
    monthlyCents: 14900,
    minutes: 5000,
    numbers: 10,
    legacyCode: 'standard',
  },
  enterprise: {
    monthlyCents: 19900,
    minutes: 5000,
    numbers: 30,
    legacyCode: 'power',
  },
} as const;
export type PublicPlan = keyof typeof publicCheckoutCatalog;
export type PublicSelection = {
  plan: PublicPlan;
  billing: 'monthly' | 'annual';
  seats: number;
  mercurySeats: number;
  minutePack: number;
  numberPack: number;
};
export const publicMinutePacks = { 100: 1000, 600: 5000, 1400: 10000 } as const;
export const publicNumberPacks = { 1: 300, 10: 2800, 50: 12500 } as const;
const own = (value: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);
export const quotePublicCheckout = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_CHECKOUT_SELECTION');
  const s = value as PublicSelection;
  const keys = [
    'plan',
    'billing',
    'seats',
    'mercurySeats',
    'minutePack',
    'numberPack',
  ];
  if (
    Object.keys(s).some((key) => !keys.includes(key)) ||
    keys.some((key) => !own(s, key)) ||
    !own(publicCheckoutCatalog, s.plan) ||
    !['monthly', 'annual'].includes(s.billing) ||
    !Number.isSafeInteger(s.seats) ||
    s.seats < 1 ||
    s.seats > 1000 ||
    !Number.isSafeInteger(s.mercurySeats) ||
    s.mercurySeats < 0 ||
    s.mercurySeats > s.seats ||
    !Number.isSafeInteger(s.minutePack) ||
    !Number.isSafeInteger(s.numberPack) ||
    (s.minutePack !== 0 && !own(publicMinutePacks, s.minutePack)) ||
    (s.numberPack !== 0 && !own(publicNumberPacks, s.numberPack))
  )
    throw new Error('INVALID_CHECKOUT_SELECTION');
  const selection: PublicSelection = {
    plan: s.plan,
    billing: s.billing,
    seats: s.seats,
    mercurySeats: s.mercurySeats,
    minutePack: s.minutePack,
    numberPack: s.numberPack,
  };
  const months = s.billing === 'annual' ? 12 : 1;
  const items: Array<{
    code: string;
    billing: string;
    quantity: number;
    unitAmount: number;
  }> = [
    {
      code: s.plan,
      billing: s.billing,
      quantity: s.seats,
      unitAmount: publicCheckoutCatalog[s.plan].monthlyCents * months,
    },
  ];
  if (s.mercurySeats)
    items.push({
      code: 'mercury',
      billing: s.billing,
      quantity: s.mercurySeats,
      unitAmount: 2500 * months,
    });
  if (s.numberPack)
    items.push({
      code: 'numbers-' + s.numberPack,
      billing: s.billing,
      quantity: 1,
      unitAmount:
        publicNumberPacks[s.numberPack as keyof typeof publicNumberPacks] *
        months,
    });
  if (s.minutePack)
    items.push({
      code: 'minutes-' + s.minutePack,
      billing: 'once',
      quantity: 1,
      unitAmount:
        publicMinutePacks[s.minutePack as keyof typeof publicMinutePacks],
    });
  return {
    selection,
    items,
    totalCents: items.reduce(
      (total, item) => total + item.quantity * item.unitAmount,
      0,
    ),
  };
};
export const publicPriceLookupKey = (code: string, billing: string) =>
  'consuelo_launch_20261030_' + code.replaceAll('-', '_') + '_' + billing;
