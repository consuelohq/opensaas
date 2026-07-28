import { createServer } from 'node:http';

import {
  signFixtureManifest,
  type FixtureRuntimeManifest,
} from './fixtures';

type RuntimeFixtureServerOptions = {
  bundle?: Uint8Array;
  failBundleStatus?: number;
  failManifestStatus?: number;
  manifest?: FixtureRuntimeManifest;
};

export async function startRuntimeFixtureServer(
  options: RuntimeFixtureServerOptions = {},
): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  try {
    const bundle = options.bundle ?? new TextEncoder().encode('fixture-runtime');
    const manifest = await signFixtureManifest(
      options.manifest ?? {
        bundleDigest: 'sha256:fixture-runtime',
        channel: 'dev',
        schemaVersion: 1,
        version: '0.0.0-fixture.1',
      },
    );
    const server = createServer((request, response) => {
      if (request.url === '/channels/dev.json') {
        response.statusCode = options.failManifestStatus ?? 200;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(manifest));
        return;
      }

      if (request.url === '/bundles/runtime.tar.gz') {
        response.statusCode = options.failBundleStatus ?? 200;
        response.setHeader('content-type', 'application/gzip');
        response.end(bundle);
        return;
      }

      if (request.url === '/health') {
        response.statusCode = 200;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      response.statusCode = 404;
      response.end('Not found');
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Runtime fixture server did not bind a TCP port.');
    }

    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      close: () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    };
  } catch (error: unknown) {
    throw new Error('Failed to start the runtime fixture server.', {
      cause: error,
    });
  }
}

if (import.meta.main) {
  const fixture = await startRuntimeFixtureServer();
  process.stdout.write(`${JSON.stringify({ baseUrl: fixture.baseUrl })}\n`);

  const close = async () => {
    try {
      await fixture.close();
      process.exit(0);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Failed to close fixture server: ${message}\n`);
      process.exit(1);
    }
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
