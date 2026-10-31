import {
  publicCheckoutCatalog,
  publicMinutePacks,
  publicNumberPacks,
  quotePublicCheckout,
  type PublicPlan,
  type PublicSelection,
} from './public-checkout-catalog';

export const nativeBillingVersion = 'native-20261031';
export type NativePriceDefinition = {
  code: string;
  billing: 'monthly' | 'annual' | 'once';
  unitAmount: number;
  role: 'base' | 'numbers' | 'minutes' | 'choice';
  plan?: PublicPlan;
  mercury?: boolean;
  pack?: number;
};
export const nativePriceLookupKey = (code: string, billing: string) =>
  'consuelo_native_20261031_' + code.replaceAll('-', '_') + '_' + billing;
export const nativePriceDefinitions: NativePriceDefinition[] = [
  { code: 'minutes-choice', billing: 'once', unitAmount: 0, role: 'choice' },
  ...Object.entries(publicCheckoutCatalog).flatMap(([plan, definition]) =>
    [false, true].flatMap((mercury) =>
      (['monthly', 'annual'] as const).map((billing) => ({
        code: plan + (mercury ? '-with-mercury' : ''),
        billing,
        unitAmount:
          (definition.monthlyCents + (mercury ? 2500 : 0)) *
          (billing === 'annual' ? 12 : 1),
        role: 'base' as const,
        plan: plan as PublicPlan,
        mercury,
      })),
    ),
  ),
  ...Object.entries({ 0: 0, ...publicNumberPacks }).flatMap(([pack, amount]) =>
    (['monthly', 'annual'] as const).map((billing) => ({
      code: 'numbers-' + pack,
      billing,
      unitAmount: amount * (billing === 'annual' ? 12 : 1),
      role: 'numbers' as const,
      pack: Number(pack),
    })),
  ),
  ...Object.entries(publicMinutePacks).map(([pack, amount]) => ({
    code: 'minutes-' + pack,
    billing: 'once' as const,
    unitAmount: amount,
    role: 'minutes' as const,
    pack: Number(pack),
  })),
];
export const quoteNativeCheckout = (value: unknown) => {
  const { selection } = quotePublicCheckout(value);
  if (
    selection.mercurySeats !== 0 &&
    selection.mercurySeats !== selection.seats
  )
    throw new Error('NATIVE_COACHING_REQUIRES_ALL_SEATS');
  const definition = (code: string, billing: string) => {
    const found = nativePriceDefinitions.find(
      (price) => price.code === code && price.billing === billing,
    );
    if (!found) throw new Error('NATIVE_PRICE_NOT_FOUND');
    return found;
  };
  const item = (code: string, billing: string, quantity: number) => {
    const price = definition(code, billing);
    return { code, billing, quantity, unitAmount: price.unitAmount };
  };
  const baseItems = [
    item(
      selection.plan + (selection.mercurySeats ? '-with-mercury' : ''),
      selection.billing,
      selection.seats,
    ),
  ];
  if (selection.minutePack)
    baseItems.push(item('minutes-' + selection.minutePack, 'once', 1));
  const numberItems = selection.numberPack
    ? [item('numbers-' + selection.numberPack, selection.billing, 1)]
    : [];
  const total = (items: typeof baseItems) =>
    items.reduce((sum, price) => sum + price.unitAmount * price.quantity, 0);
  const baseDueCents = total(baseItems),
    numberDueCents = total(numberItems);
  return {
    selection,
    baseItems,
    numberItems,
    baseDueCents,
    numberDueCents,
    totalCents: baseDueCents + numberDueCents,
  };
};
type NativeItem = { id: string; priceId: string; quantity: number };
type NativeBase = Pick<
  PublicSelection,
  'plan' | 'billing' | 'seats' | 'mercurySeats'
>;
type NativeNumbers = Pick<PublicSelection, 'billing' | 'numberPack'>;
export function normalizeNativeSubscription(
  items: NativeItem[],
  prices: ReadonlyMap<string, NativePriceDefinition>,
  role: 'base',
): NativeBase;
export function normalizeNativeSubscription(
  items: NativeItem[],
  prices: ReadonlyMap<string, NativePriceDefinition>,
  role: 'numbers',
): NativeNumbers;
export function normalizeNativeSubscription(
  items: NativeItem[],
  prices: ReadonlyMap<string, NativePriceDefinition>,
  role: 'base' | 'numbers',
): NativeBase | NativeNumbers;
export function normalizeNativeSubscription(
  items: NativeItem[],
  prices: ReadonlyMap<string, NativePriceDefinition>,
  role: 'base' | 'numbers',
): NativeBase | NativeNumbers {
  if (items.length !== 1) throw new Error('NATIVE_SUBSCRIPTION_ITEMS_MISMATCH');
  const actual = items[0],
    definition = prices.get(actual.priceId);
  if (
    !definition ||
    definition.role !== role ||
    definition.billing === 'once' ||
    !actual.id ||
    !Number.isSafeInteger(actual.quantity) ||
    actual.quantity < 1 ||
    actual.quantity > (role === 'base' ? 1000 : 1)
  )
    throw new Error('NATIVE_SUBSCRIPTION_ITEMS_MISMATCH');
  if (role === 'base' && definition.plan)
    return {
      plan: definition.plan,
      billing: definition.billing,
      seats: actual.quantity,
      mercurySeats: definition.mercury ? actual.quantity : 0,
    };
  if (role === 'numbers' && definition.pack !== undefined)
    return { numberPack: definition.pack, billing: definition.billing };
  throw new Error('NATIVE_SUBSCRIPTION_ITEMS_MISMATCH');
}
