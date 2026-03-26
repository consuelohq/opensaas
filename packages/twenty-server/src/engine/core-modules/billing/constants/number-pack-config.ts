export const NUMBER_PACK_CONFIG = {
  5: { monthly: 800, annual: 8000, slots: 5 },
  10: { monthly: 1500, annual: 15000, slots: 10 },
  50: { monthly: 6000, annual: 60000, slots: 50 },
} as const;

export type NumberPackSize = keyof typeof NUMBER_PACK_CONFIG;
