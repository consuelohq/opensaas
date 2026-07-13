#!/usr/bin/env bun

import { createLocalOsApp } from './app';
import { loadLocalOsServerConfig } from './env';

if (import.meta.main) {
  const config = loadLocalOsServerConfig();
  const app = createLocalOsApp(config);

  Bun.serve({
    hostname: '127.0.0.1',
    port: config.port,
    fetch: app.fetch,
  });

  process.stderr.write(
    `[Consuelo OS] ${config.name} listening on 127.0.0.1:${config.port}\n`,
  );
}
