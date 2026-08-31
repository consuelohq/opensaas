import { describe, expect, it } from 'bun:test';

import {
  createSyntheticDialerFixture,
  resolveLabScale,
  summarizeSamples,
} from './local-dialer-lab';

describe('local dialer lab fixtures', () => {
  it('creates deterministic synthetic histories without provider identifiers', () => {
    const first = createSyntheticDialerFixture({
      seed: 42,
      contactCount: 24,
      attemptsPerContact: 4,
      baseTime: new Date('2026-08-14T16:00:00.000Z'),
    });
    const second = createSyntheticDialerFixture({
      seed: 42,
      contactCount: 24,
      attemptsPerContact: 4,
      baseTime: new Date('2026-08-14T16:00:00.000Z'),
    });

    expect(second).toEqual(first);
    expect(first.contacts).toHaveLength(24);
    expect(first.outcomes).toHaveLength(96);
    expect(
      first.contacts.every((contact) =>
        contact.contactId.startsWith('lab-contact-'),
      ),
    ).toBe(true);
    expect(
      first.outcomes.every((outcome) =>
        outcome.contactId.startsWith('lab-history-'),
      ),
    ).toBe(true);
    expect(
      first.outcomes.every(
        (outcome) => outcome.attemptNumber >= 1 && outcome.attemptNumber <= 4,
      ),
    ).toBe(true);
    expect(
      first.outcomes.some((outcome) => outcome.outcome === 'answered'),
    ).toBe(true);
    expect(
      first.outcomes.some((outcome) => outcome.outcome !== 'answered'),
    ).toBe(true);
  });

  it('changes the generated history when the seed changes', () => {
    const options = {
      contactCount: 12,
      attemptsPerContact: 3,
      baseTime: new Date('2026-08-14T16:00:00.000Z'),
    };

    expect(createSyntheticDialerFixture({ ...options, seed: 7 })).not.toEqual(
      createSyntheticDialerFixture({ ...options, seed: 8 }),
    );
  });

  it('keeps smoke runs small and makes larger scales explicit', () => {
    const smoke = resolveLabScale('smoke');
    const standard = resolveLabScale('standard');
    const large = resolveLabScale('large');

    expect(smoke.contactCount).toBeLessThan(standard.contactCount);
    expect(standard.contactCount).toBeLessThan(large.contactCount);
    expect(smoke.rankingCandidateCounts.at(-1)).toBeLessThan(
      standard.rankingCandidateCounts.at(-1) ?? 0,
    );
  });

  it('summarizes observational latency samples without enforcing thresholds', () => {
    expect(summarizeSamples([8, 2, 5, 3, 10])).toEqual({
      samples: 5,
      minMs: 2,
      medianMs: 5,
      p95Ms: 10,
      maxMs: 10,
    });
  });
});
