#!/usr/bin/env bun

import { websocket } from 'hono/bun';

import { createDialerServer } from './app';
import { resolveTrustedClientAddress } from './runtime/edge-client-identity';
import { loadDialerServerRuntime } from './runtime/environment';

if (import.meta.main) {
  const runtime = await loadDialerServerRuntime();
  const app = createDialerServer(runtime.dependencies);
  const server = Bun.serve({
    hostname: runtime.hostname,
    port: runtime.port,
    fetch: (request, server) => {
      const socketAddress = server.requestIP(request)?.address ?? 'unknown';
      const edgeSecret = process.env.DIALER_EDGE_PROXY_SECRET;
      const clientAddress = resolveTrustedClientAddress(
        request,
        socketAddress,
        edgeSecret,
      );
      return app.fetch(request, {
        clientAddress: clientAddress ?? 'unknown',
        trustedClientIdentity: !edgeSecret?.trim() || clientAddress !== null,
      });
    },
    websocket,
  });
  runtime.dependencies.inbound?.start();
  let stopping = false;
  const stopRuntime = async () => {
    try {
      if (stopping) return;
      stopping = true;
      server.stop();
      await Promise.race([
        runtime.dependencies.inbound?.close(),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);
      process.exit(0);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', {
        cause,
      });
    }
  };
  process.once('SIGTERM', () => {
    void stopRuntime();
  });
  process.once('SIGINT', () => {
    void stopRuntime();
  });
  process.stderr.write(
    `[dialer-server] listening on ${runtime.hostname}:${runtime.port}\n`,
  );
}
