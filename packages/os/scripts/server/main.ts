#!/usr/bin/env bun

import { startDefaultNativeLifecycleEndpoint } from '../lib/native-lifecycle-endpoint';
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

  process.stderr.write(
    `[Consuelo OS] ${config.name} listening on 127.0.0.1:${config.port}\n`,
  );
}
