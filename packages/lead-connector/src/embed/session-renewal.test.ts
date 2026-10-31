import { it, expect } from 'bun:test';
import { createSessionRenewal } from './session-renewal';
it('renews before expiry, coalesces requests, bounds failures and recovers explicitly', () => {
  let now = 0,
    next = 0,
    requests = 0,
    failures = 0;
  const tasks = new Map<number, { at: number; run: () => void }>();
  const scheduler = createSessionRenewal({
    now: () => now,
    schedule: (run, delay) => {
      tasks.set(++next, { at: now + delay, run });
      return next;
    },
    cancel: (id) => {
      tasks.delete(id);
    },
    requestContext: () => requests++,
    onExhausted: () => failures++,
  });
  const advance = (at: number) => {
    now = at;
    for (const [id, t] of [...tasks])
      if (t.at <= now) {
        tasks.delete(id);
        t.run();
      }
  };
  scheduler.succeeded(new Date(900000).toISOString());
  advance(809999);
  expect(requests).toBe(0);
  advance(810000);
  expect(requests).toBe(1);
  scheduler.request();
  expect(requests).toBe(1);
  advance(818000);
  advance(826000);
  advance(834000);
  expect(requests).toBe(3);
  expect(failures).toBe(1);
  scheduler.check();
  expect(requests).toBe(3);
  scheduler.retry();
  expect(requests).toBe(4);
  scheduler.succeeded(new Date(1800000).toISOString());
  advance(900000);
  expect(requests).toBe(4);
  scheduler.dispose();
  expect(tasks.size).toBe(0);
});
it('does not turn an unusually long session duration into a timeout overflow loop', () => {
  let requests = 0;
  const delays: number[] = [];
  const scheduler = createSessionRenewal({
    now: () => 0,
    schedule: (_fn, delay) => {
      delays.push(delay);
      return 1;
    },
    cancel: () => {},
    requestContext: () => requests++,
    onExhausted: () => {},
  });
  scheduler.succeeded('2030-01-01T00:00:00Z');
  expect(delays[0]).toBeLessThanOrEqual(86400000);
  expect(requests).toBe(0);
  scheduler.dispose();
});

it('gives short lived credentials room to renew without an immediate success loop', () => {
  const delays: number[] = [];
  const scheduler = createSessionRenewal({
    now: () => 1000,
    schedule: (_fn, delay) => {
      delays.push(delay);
      return 1;
    },
    cancel: () => {},
    requestContext: () => {},
    onExhausted: () => {},
  });
  scheduler.succeeded(new Date(21000).toISOString());
  expect(delays[0]).toBe(18000);
  scheduler.succeeded(new Date(900).toISOString());
  expect(delays).toHaveLength(1);
  scheduler.dispose();
});
