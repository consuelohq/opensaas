import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { isolateOsTestEnvironment } from './test-environment';

describe('OS test environment isolation', () => {
  it('runs each Vitest worker against a test-owned trace database', () => {
    expect(process.env.CONSUELO_TRACE_DB).toContain('consuelo-os-vitest-traces-');
    expect(process.env.CONSUELO_TRACE_DB).not.toContain('/.consuelo/node/db/traces.db');
    expect(process.env.TRACE_DB).toBeUndefined();
  });

  it('replaces installed trace database overrides with a test-owned trace database', () => {
    const env: NodeJS.ProcessEnv = {
      CONSUELO_HOME: '/tmp/test-home',
      CONSUELO_TRACE_DB: '/Users/ko/.consuelo/node/db/traces.db',
      TRACE_DB: '/Users/ko/.consuelo/node/db/compat-traces.db',
      KEEP_ME: 'yes',
    };

    const isolated = isolateOsTestEnvironment(env, '/tmp/consuelo-os-test/traces.db');

    expect(isolated.CONSUELO_TRACE_DB).toBe('/tmp/consuelo-os-test/traces.db');
    expect(isolated.TRACE_DB).toBeUndefined();
    expect(isolated.CONSUELO_HOME).toBe('/tmp/test-home');
    expect(isolated.KEEP_ME).toBe('yes');
  });

  it('allows a test to opt into an explicit trace database after isolation', () => {
    const isolated = isolateOsTestEnvironment(
      {
        CONSUELO_TRACE_DB: '/operator/traces.db',
        TRACE_DB: '/operator/compat.db',
      },
      '/tmp/consuelo-os-test/default.db',
    );
    isolated.CONSUELO_TRACE_DB = '/tmp/explicit-test.db';

    expect(isolated.CONSUELO_TRACE_DB).toBe('/tmp/explicit-test.db');
    expect(isolated.TRACE_DB).toBeUndefined();
  });

  it('installs the isolation helper for every OS Vitest worker', () => {
    const config = readFileSync(resolve(import.meta.dirname, '../vitest.config.ts'), 'utf8');
    expect(config).toContain("setupFiles: ['./tests/test-environment.ts']");
  });
});
