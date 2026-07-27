import { describe, expect, it, vi } from 'vitest';

import { startLocalOsServer } from '../scripts/server/main';

describe('local OS server startup', () => {
  it('should serve HTTP when the optional lifecycle endpoint cannot start', async () => {
    const serve = vi.fn(() => ({ stop: vi.fn() }));
    const writeError = vi.fn();

    await expect(
      startLocalOsServer({
        platform: 'darwin',
        config: { port: 46321, name: 'test-os' },
        app: { fetch: vi.fn() },
        startLifecycleEndpoint: vi.fn(async () => {
          throw new Error('socket unavailable');
        }),
        serve,
        registerSignal: vi.fn(),
        writeError,
      }),
    ).resolves.toBeDefined();

    expect(serve).toHaveBeenCalledOnce();
    expect(writeError).toHaveBeenCalledWith(
      expect.stringContaining('lifecycle endpoint unavailable'),
    );
  });

  it('should close the lifecycle endpoint when a termination signal is received', async () => {
    const close = vi.fn(async () => undefined);
    const handlers = new Map<string, () => void | Promise<void>>();

    await startLocalOsServer({
      platform: 'darwin',
      config: { port: 46321, name: 'test-os' },
      app: { fetch: vi.fn() },
      startLifecycleEndpoint: vi.fn(async () => ({ close })),
      serve: vi.fn(() => ({ stop: vi.fn() })),
      registerSignal: (signal, handler) => handlers.set(signal, handler),
      writeError: vi.fn(),
    });

    expect(handlers.has('SIGINT')).toBe(true);
    expect(handlers.has('SIGTERM')).toBe(true);
    await handlers.get('SIGTERM')?.();
    expect(close).toHaveBeenCalledOnce();
  });
});
