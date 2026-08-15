import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const createdHomes: string[] = [];

type GatewayModule = {
  getInstallId?: () => string | null;
};

function loadGateway(): GatewayModule {
  const resolved = require.resolve('../scripts/lib/index/embedding-gateway.js');
  delete require.cache[resolved];
  return require(resolved) as GatewayModule;
}

function withEnv<T>(values: Record<string, string | undefined>, callback: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

afterEach(() => {
  while (createdHomes.length > 0) {
    const home = createdHomes.pop();
    if (home) rmSync(home, { recursive: true, force: true });
  }
});

describe('Explore hosted embedding install identity', () => {
  it('persists one pseudonymous install id for ordinary interactive Explore processes', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-embedding-id-'));
    createdHomes.push(home);

    withEnv({
      CONSUELO_HOME: home,
      CONSUELO_INSTALL_ID: undefined,
      CONSUELO_OS_INSTALL_ID: undefined,
    }, () => {
      const firstGateway = loadGateway();
      expect(typeof firstGateway.getInstallId).toBe('function');
      const first = firstGateway.getInstallId?.();
      expect(first).toMatch(/^ins_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

      const secondGateway = loadGateway();
      const second = secondGateway.getInstallId?.();
      expect(second).toBe(first);

      const persistedPath = join(home, 'node', 'identity', 'install-id');
      expect(readFileSync(persistedPath, 'utf8').trim()).toBe(first);
      if (process.platform !== 'win32') {
        expect(statSync(persistedPath).mode & 0o777).toBe(0o600);
      }
    });
  });

  it('prefers an inherited installer identity without rewriting it', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-embedding-id-'));
    createdHomes.push(home);
    const inherited = 'ins_11111111-1111-4111-8111-111111111111';

    withEnv({
      CONSUELO_HOME: home,
      CONSUELO_INSTALL_ID: inherited,
      CONSUELO_OS_INSTALL_ID: undefined,
    }, () => {
      const gateway = loadGateway();
      expect(gateway.getInstallId?.()).toBe(inherited);
    });
  });
});
