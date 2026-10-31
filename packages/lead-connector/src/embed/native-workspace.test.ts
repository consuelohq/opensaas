import { describe, expect, it } from 'bun:test';
import { createNativeWorkspaceLauncher } from './native-workspace';

describe('native sidebar presentation', () => {
  it('retries the same presentation-only launch until acknowledged, then never reopens on refresh', () => {
    const launches: unknown[] = [];
    const timers = new Map<number, () => void>();
    let n = 0;
    let opened = 0;
    const launcher = createNativeWorkspaceLauncher({
      open: (l) => launches.push(l),
      onOpened: () => opened++,
      newId: () => 'launch-1',
      schedule: (fn) => {
        timers.set(++n, fn);
        return n;
      },
      cancel: (id) => {
        timers.delete(id);
      },
    });
    launcher.requestOnce();
    launcher.requestOnce();
    expect(launches).toEqual([
      { id: 'launch-1', mode: 'inbound', action: 'open' },
    ]);
    const retry = [...timers.values()][0]!;
    timers.clear();
    retry();
    expect(launches).toHaveLength(2);
    expect(launches[1]).toEqual(launches[0]);
    launcher.acknowledge('wrong');
    expect(opened).toBe(0);
    launcher.acknowledge('launch-1');
    expect(opened).toBe(1);
    expect(timers.size).toBe(0);
    launcher.requestOnce();
    expect(launches).toHaveLength(2);
    launcher.dispose();
  });
  it('bounds retries and cancels them on disposal', () => {
    let sends = 0;
    let timer: (() => void) | undefined;
    const launcher = createNativeWorkspaceLauncher({
      open: () => sends++,
      onOpened: () => {},
      newId: () => 'id',
      schedule: (fn) => {
        timer = fn;
        return 1;
      },
      cancel: () => {
        timer = undefined;
      },
    });
    launcher.requestOnce();
    for (let i = 0; i < 10; i++) {
      const fn = timer;
      timer = undefined;
      fn?.();
    }
    expect(sends).toBe(4);
    expect(timer).toBeUndefined();
    launcher.open();
    expect(sends).toBe(5);
    launcher.dispose();
    expect(timer).toBeUndefined();
  });
});
