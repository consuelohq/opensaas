#!/usr/bin/env bun

import { startDefaultNativeLifecycleEndpoint } from '../lib/native-lifecycle-endpoint';
import { createLocalOsApp } from './app';
import {
  loadLocalOsServerConfig,
  type LocalOsServerConfig,
} from './env';

type LifecycleEndpoint = { close(): Promise<void> };
type LocalApp = { fetch(request: Request): Response | Promise<Response> };
type ServerHandle = unknown;

type StartLocalOsServerInput = {
  platform?: NodeJS.Platform;
  config?: LocalOsServerConfig;
  app?: LocalApp;
  startLifecycleEndpoint?: () => Promise<LifecycleEndpoint>;
  serve?: (input: {
    hostname: string;
    port: number;
    fetch: LocalApp['fetch'];
  }) => ServerHandle;
  registerSignal?: (
    signal: NodeJS.Signals,
    handler: () => void | Promise<void>,
  ) => void;
  writeError?: (message: string) => void;
};

export const startLocalOsServer = async (
  input: StartLocalOsServerInput = {},
): Promise<ServerHandle> => {
  const config = input.config ?? loadLocalOsServerConfig();
  const app = input.app ?? createLocalOsApp(config);
  const writeError =
    input.writeError ?? ((message: string) => process.stderr.write(message));
  const registerSignal =
    input.registerSignal ??
    ((signal: NodeJS.Signals, handler: () => void | Promise<void>) => {
      process.once(signal, () => void handler());
    });
  let lifecycleEndpoint: LifecycleEndpoint | undefined;

  if ((input.platform ?? process.platform) === 'darwin') {
    try {
      lifecycleEndpoint = await (
        input.startLifecycleEndpoint ?? startDefaultNativeLifecycleEndpoint
      )();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(
        `[Consuelo OS] lifecycle endpoint unavailable; HTTP server will continue: ${message}
`,
      );
    }
  }

  const closeLifecycleEndpoint = async (): Promise<void> => {
    await lifecycleEndpoint?.close();
  };
  registerSignal('SIGINT', closeLifecycleEndpoint);
  registerSignal('SIGTERM', closeLifecycleEndpoint);

  try {
    const server = (input.serve ?? ((options) => Bun.serve(options)))(
      {
        hostname: '127.0.0.1',
        port: config.port,
        fetch: app.fetch,
      },
    );
    writeError(
      `[Consuelo OS] ${config.name} listening on 127.0.0.1:${config.port}
`,
    );
    return server;
  } catch (error: unknown) {
    await closeLifecycleEndpoint();
    throw error;
  }
};

if (import.meta.main) {
  await startLocalOsServer();
}
