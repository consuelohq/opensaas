// Reserve time after ringing for the provider buffer, prompt, DTMF and webhook.
export const PHONE_SCREENING_RESERVE_MILLISECONDS = 20_000;
export const DEFAULT_PHONE_OFFER_MILLISECONDS = 40_000;

export const resolvePhoneOfferMilliseconds = (value: unknown): number => {
  if (value === undefined) return DEFAULT_PHONE_OFFER_MILLISECONDS;
  if (
    typeof value !== 'number' || !Number.isInteger(value) ||
    value < 25_000 || value > 80_000
  )
    throw new Error(
      'Phone offer budget must be an integer from 25000 to 80000 milliseconds',
    );
  return value;
};

export const phoneRingTimeoutSeconds = (remainingMilliseconds: number): number =>
  Math.max(1, Math.min(60, Math.floor(
    (remainingMilliseconds - PHONE_SCREENING_RESERVE_MILLISECONDS) / 1000,
  )));
