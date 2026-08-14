import { describe, expect, it } from 'vitest';

import { startWorkspaceNodeHeartbeatScheduler } from '../scripts/lib/workspace-node-heartbeat-scheduler';

describe('workspace node heartbeat scheduler', () => {
  it('runs only when configured and prevents overlapping sends', async () => {
    let configured = false;
    let sends = 0;
    let releaseSend: (() => void) | undefined;
    const scheduler = startWorkspaceNodeHeartbeatScheduler({
      configPath: 'C:\\Users\\Ko\\.consuelo\\node\\security\\generated\\workspace-node-heartbeat.json',
      exists: () => configured,
      runAtStart: false,
      intervalSeconds: 60,
      send: async () => {
        sends += 1;
        await new Promise<void>((resolve) => {
          releaseSend = resolve;
        });
      },
    });

    await scheduler.runNow();
    expect(sends).toBe(0);

    configured = true;
    const first = scheduler.runNow();
    await Promise.resolve();
    const overlapping = scheduler.runNow();
    expect(sends).toBe(1);
    releaseSend?.();
    await Promise.all([first, overlapping]);

    scheduler.stop();
    await scheduler.runNow();
    expect(sends).toBe(1);
  });
});
