import fs from 'node:fs';

import { WORKSPACE_NODE_HEARTBEAT_INTERVAL_SECONDS } from './workspace-node-heartbeat-client';

export type WorkspaceNodeHeartbeatScheduler = {
  runNow: () => Promise<void>;
  stop: () => void;
};

export function startWorkspaceNodeHeartbeatScheduler(input: {
  configPath: string;
  send: (configPath: string) => Promise<unknown>;
  exists?: (configPath: string) => boolean;
  onError?: (error: unknown) => void;
  intervalSeconds?: number;
  runAtStart?: boolean;
}): WorkspaceNodeHeartbeatScheduler {
  const exists = input.exists ?? fs.existsSync;
  const onError = input.onError ?? (() => undefined);
  let stopped = false;
  let running = false;

  const runNow = async (): Promise<void> => {
    if (stopped || running || !exists(input.configPath)) return;
    running = true;
    try {
      await input.send(input.configPath);
    } catch (error: unknown) {
      onError(error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(
    () => void runNow(),
    (input.intervalSeconds ?? WORKSPACE_NODE_HEARTBEAT_INTERVAL_SECONDS) * 1_000,
  );
  timer.unref?.();
  if (input.runAtStart !== false) void runNow();

  return {
    runNow,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
