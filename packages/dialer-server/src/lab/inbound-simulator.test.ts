import { describe, expect, it } from 'bun:test';
import {
  createLabClock,
  createDeliverySchedule,
  createSimulatedCarrier,
  createSimulatedEndpoint,
} from './inbound-simulator';

describe('inbound lab simulator', () => {
  it('replays seeded delivery ordering with explicit duplicates and losses', () => {
    const facts = ['ringing', 'answered', 'ended'];
    const input = {
      seed: 42,
      facts,
      copies: [2, 0, 1],
      maxDelayMilliseconds: 20,
    };
    const schedule = createDeliverySchedule(input);
    expect(schedule).toEqual(createDeliverySchedule(input));
    expect(schedule.map((item) => item.fact).sort()).toEqual([
      'ended',
      'ringing',
      'ringing',
    ]);
    expect(
      schedule.every(
        (item, index) => index === 0 || item.at >= schedule[index - 1]!.at,
      ),
    ).toBe(true);
    expect(createDeliverySchedule({ ...input, seed: 71 })).not.toEqual(
      schedule,
    );
    expect(() => createDeliverySchedule({ ...input, copies: [1] })).toThrow();
    expect(() =>
      createDeliverySchedule({ ...input, maxDelayMilliseconds: -1 }),
    ).toThrow();
  });

  it('uses explicit monotonic time and independent browser/phone reachability', () => {
    const clock = createLabClock('2026-09-10T00:00:00.000Z');
    const browser = createSimulatedEndpoint('browser', clock);
    const phone = createSimulatedEndpoint('phone', clock);
    browser.setReachable(false);
    expect(browser.respond('accept')).toMatchObject({
      endpoint: 'browser',
      result: 'unreachable',
    });
    expect(phone.respond('accept')).toMatchObject({
      endpoint: 'phone',
      result: 'accept',
    });
    clock.advance(12_000);
    expect(phone.respond('decline').observedAt).toBe(
      '2026-09-10T00:00:12.000Z',
    );
    expect(() => clock.advance(-1)).toThrow();
    expect(() => clock.advance(Number.NaN)).toThrow();
  });

  it('retains carrier effect evidence after a lost response and can hide reconciliation evidence', () => {
    const carrier = createSimulatedCarrier();
    expect(carrier.execute('command-1', 'lose_response')).toEqual({
      outcome: 'unknown',
    });
    expect(carrier.inspect('command-1')).toEqual({ outcome: 'succeeded' });
    carrier.setLookupAvailable(false);
    expect(carrier.inspect('command-1')).toEqual({ outcome: 'unknown' });
    carrier.setLookupAvailable(true);
    expect(carrier.inspect('never-sent')).toEqual({ outcome: 'absent' });
    expect(carrier.evidence()).toEqual([
      { commandId: 'command-1', attempts: 1, effects: 1 },
    ]);
    carrier.execute('command-1', 'succeed');
    expect(carrier.evidence()[0]?.attempts).toBe(2);
    expect(carrier.evidence()[0]?.effects).toBe(2);
  });

  it('distinguishes known carrier rejection from an ambiguous accepted operation', () => {
    const carrier = createSimulatedCarrier();
    expect(carrier.execute('rejected', 'reject')).toEqual({
      outcome: 'failed',
    });
    expect(carrier.inspect('rejected')).toEqual({ outcome: 'failed' });
    expect(carrier.evidence()[0]).toEqual({
      commandId: 'rejected',
      attempts: 1,
      effects: 0,
    });
  });
});
