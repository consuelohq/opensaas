import { describe, expect, it, vi } from 'vitest';

import { reloadCaddyAfterTopologyChange } from '../scripts/migrations/reconcile-caddy-worker-pool';

describe('Caddy worker-pool migration reloads', () => {
  it('does not signal Caddy when reconciliation is a no-op', () => {
    const runLaunchctl = vi.fn(() => ({ exitCode: 0, stdout: '', stderr: '' }));

    reloadCaddyAfterTopologyChange({
      result: { changed: false, upstreams: ['127.0.0.1:46321', '127.0.0.1:46322'] },
      platform: 'darwin',
      userId: 501,
      runLaunchctl,
    });

    expect(runLaunchctl).not.toHaveBeenCalled();
  });

  it('signals a loaded Caddy exactly once when topology changed', () => {
    const calls: string[][] = [];
    const runLaunchctl = vi.fn((args: string[]) => {
      calls.push(args);
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    reloadCaddyAfterTopologyChange({
      result: { changed: true, upstreams: ['127.0.0.1:46321', '127.0.0.1:46322'] },
      platform: 'darwin',
      userId: 501,
      runLaunchctl,
    });

    expect(calls).toEqual([
      ['print', 'gui/501/com.consuelo.caddy'],
      ['kill', 'SIGUSR1', 'gui/501/com.consuelo.caddy'],
    ]);
  });
});
