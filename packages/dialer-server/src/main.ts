#!/usr/bin/env bun

import { websocket } from 'hono/bun';

import { createDialerServer } from './app';
import { loadDialerServerRuntime } from './runtime/environment';

if (import.meta.main) {
  const runtime = await loadDialerServerRuntime();
  const app = createDialerServer(runtime.dependencies);
  Bun.serve({
    hostname: runtime.hostname,
    port: runtime.port,
    fetch: app.fetch,
    websocket,
  });
  process.stderr.write(
    `[dialer-server] listening on ${runtime.hostname}:${runtime.port}\n`,
  );
}
