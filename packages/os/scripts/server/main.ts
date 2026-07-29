#!/usr/bin/env bun

import path from 'node:path';

import { resolveConsueloHomeLayout } from '../lib/consuelo-home';
import { startDefaultNativeLifecycleEndpoint } from '../lib/native-lifecycle-endpoint';
import { startWorkspaceNodeHeartbeatScheduler } from '../lib/workspace-node-heartbeat-scheduler';
import { sendWorkspaceNodeHeartbeatFromConfig } from '../workspace-node-heartbeat';
import { createLocalOsApp } from './app';
import { loadLocalOsServerConfig } from './env';

if (import.meta.main) {
  const config = loadLocalOsServerConfig();
  const app = createLocalOsApp(config);

  const lifecycleEndpoint =
    process.platform === 'darwin'
      ? await startDefaultNativeLifecycleEndpoint()
      : undefined;

  try {
    Bun.serve({
      hostname: '127.0.0.1',
      port: config.port,
      fetch: app.fetch,
    });
  } catch (error: unknown) {
    await lifecycleEndpoint?.close();
    throw error;
  }

  if (process.platform === 'win32') {
    const heartbeatConfigPath = path.join(
      resolveConsueloHomeLayout().nodeSecurityGeneratedDir,
      'workspace-node-heartbeat.json',
    );
    startWorkspaceNodeHeartbeatScheduler({
      configPath: heartbeatConfigPath,
      send: sendWorkspaceNodeHeartbeatFromConfig,
      onError(error: unknown) {
        const message =
          error instanceof Error ? error.message : 'workspace node heartbeat failed';
        process.stderr.write(`[Consuelo OS] ${message}\n`);
      },
    });
  }

  process.stderr.write(
    `[Consuelo OS] ${config.name} listening on 127.0.0.1:${config.port}\n`,
  );
}
