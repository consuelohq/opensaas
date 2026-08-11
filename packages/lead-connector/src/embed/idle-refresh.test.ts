import { describe, expect, it, mock } from 'bun:test';

import { createLeadConnectorIdleRefreshScheduler } from './idle-refresh';

type Listener = () => void;

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

describe('LeadConnector idle refresh scheduling', () => {
  it('uses focus and visible transitions without polling and fully cleans up across remounts', () => {
    const windowTarget = new FakeEventTarget();
    const documentTarget = new FakeEventTarget() as FakeEventTarget & {
      visibilityState: 'hidden' | 'visible';
    };
    documentTarget.visibilityState = 'visible';
    const refresh = mock(() => undefined);
    const scheduler = createLeadConnectorIdleRefreshScheduler({
      windowTarget,
      documentTarget,
      refresh,
    });

    scheduler.start();
    scheduler.start();

    expect(windowTarget.count('focus')).toBe(1);
    expect(documentTarget.count('visibilitychange')).toBe(1);

    windowTarget.emit('focus');
    expect(refresh).toHaveBeenCalledTimes(1);

    documentTarget.visibilityState = 'hidden';
    documentTarget.emit('visibilitychange');
    expect(refresh).toHaveBeenCalledTimes(1);

    documentTarget.visibilityState = 'visible';
    documentTarget.emit('visibilitychange');
    expect(refresh).toHaveBeenCalledTimes(2);

    scheduler.stop();
    expect(windowTarget.count('focus')).toBe(0);
    expect(documentTarget.count('visibilitychange')).toBe(0);

    windowTarget.emit('focus');
    documentTarget.emit('visibilitychange');
    expect(refresh).toHaveBeenCalledTimes(2);

    scheduler.start();
    expect(windowTarget.count('focus')).toBe(1);
    expect(documentTarget.count('visibilitychange')).toBe(1);
    scheduler.stop();
  });
});
