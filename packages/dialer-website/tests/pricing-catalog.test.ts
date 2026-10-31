import { describe, expect, it } from 'bun:test';
import {
  pricingPlans,
  minutePacks,
  numberPacks,
  quotePlan,
  comparisonGroups,
} from '../src/data/pricing-content';

describe('approved launch pricing', () => {
  it('uses four named offers with the approved prices and allowances', () => {
    expect(
      pricingPlans.map((p) => [
        p.code,
        p.monthlyCents,
        p.includedMinutes,
        p.numbers,
      ]),
    ).toEqual([
      ['starter', 0, 100, 1],
      ['professional', 9900, 1000, 3],
      ['agency', 14900, 5000, 10],
      ['enterprise', 19900, 5000, 30],
    ]);
  });
  it('quotes whole annual bills and never multiplies monthly minute allowances by the billing term', () => {
    expect(quotePlan('agency', 'monthly', 3)).toEqual({
      totalCents: 44700,
      monthlyCents: 44700,
      months: 1,
    });
    expect(quotePlan('agency', 'annual', 3)).toEqual({
      totalCents: 536400,
      monthlyCents: 44700,
      months: 12,
    });
    expect(pricingPlans.find((p) => p.code === 'agency')?.includedMinutes).toBe(
      5000,
    );
    for (const seats of [0, -1, 1.5, NaN, Infinity, 1001])
      expect(() => quotePlan('agency', 'monthly', seats)).toThrow();
    expect(() => quotePlan('__proto__', 'monthly', 1)).toThrow();
    expect(() => quotePlan('agency', 'weekly', 1)).toThrow();
  });
  it('makes larger minute packs strictly better than every cheaper pack combination at the same spend', () => {
    expect(minutePacks.map((p) => p.priceCents)).toEqual([1000, 5000, 10000]);
    for (let i = 1; i < minutePacks.length; i++) {
      const target = minutePacks[i];
      let best = 0;
      for (let a = 0; a <= 10; a++)
        for (let b = 0; b <= 2; b++) {
          const picks = [a, b];
          const spend = minutePacks
            .slice(0, i)
            .reduce((s, p, j) => s + p.priceCents * picks[j], 0);
          if (spend <= target.priceCents)
            best = Math.max(
              best,
              minutePacks
                .slice(0, i)
                .reduce((s, p, j) => s + p.minutes * picks[j], 0),
            );
        }
      expect(target.minutes).toBeGreaterThan(best);
    }
    // Stress envelope: $0.05 total variable cost per customer-connected minute.
    for (const p of minutePacks)
      expect(
        (p.priceCents - p.minutes * 5) / p.priceCents,
      ).toBeGreaterThanOrEqual(0.3);
  });
  it('discounts number packs without making smaller packs better or losing the modeled reserve', () => {
    expect(numberPacks.map((p) => p.numbers)).toEqual([1, 10, 50]);
    expect(numberPacks[0].priceCents).toBe(300);
    for (let i = 1; i < numberPacks.length; i++) {
      expect(numberPacks[i].priceCents / numberPacks[i].numbers).toBeLessThan(
        numberPacks[i - 1].priceCents / numberPacks[i - 1].numbers,
      );
    }
    for (const p of numberPacks)
      expect(
        (p.priceCents - p.numbers * 115 * 1.25) / p.priceCents,
      ).toBeGreaterThan(0.4);
  });
  it('keeps inbound and outbound separate, Professional calling features included, and upcoming identity/MCP explicit', () => {
    const row = (id: string) =>
      comparisonGroups.flatMap((g) => g.rows).find((r) => r.id === id);
    expect(comparisonGroups.some((g) => g.id === 'inbound')).toBe(true);
    expect(comparisonGroups.some((g) => g.id === 'outbound')).toBe(true);
    expect(row('local-presence')?.values).toEqual([false, true, true, true]);
    expect(row('spam')?.values).toEqual([false, true, true, true]);
    expect(row('predictive')?.values).toEqual([false, true, true, true]);
    expect(row('mcp')?.values[3]).toBe('Coming soon');
    expect(row('sso')?.values[3]).toBe('Coming soon');
    for (const g of comparisonGroups)
      for (const r of g.rows) expect(r.values).toHaveLength(4);
  });
});
