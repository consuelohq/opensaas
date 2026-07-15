import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveTraceDbPath } from '../scripts/server/services/trace-gateway';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('Trace gateway service DB resolution', () => {
  it('prefers the newest existing workspace shard while preserving explicit DB overrides', () => {
    const home = mkdtempSync(join(tmpdir(), 'trace-gateway-db-'));
    roots.push(home);
    const traceRoot = join(home, 'traces');
    const direct = join(traceRoot, 'traces.db');
    const olderShard = join(traceRoot, 'workspace-old', 'traces.db');
    const newestShard = join(traceRoot, 'workspace-new', 'traces.db');
    mkdirSync(join(traceRoot, 'workspace-old'), { recursive: true });
    mkdirSync(join(traceRoot, 'workspace-new'), { recursive: true });
    writeFileSync(direct, 'legacy');
    writeFileSync(olderShard, 'older');
    writeFileSync(newestShard, 'newest');
    utimesSync(direct, new Date(1_000), new Date(1_000));
    utimesSync(olderShard, new Date(2_000), new Date(2_000));
    utimesSync(newestShard, new Date(3_000), new Date(3_000));

    expect(
      resolveTraceDbPath({
        env: { CONSUELO_OS_HOME: home },
        platform: 'linux',
      }),
    ).toBe(newestShard);
    expect(
      resolveTraceDbPath({
        env: {
          CONSUELO_OS_HOME: home,
          CONSUELO_TRACE_DB: '/explicit/traces.db',
        },
        platform: 'linux',
      }),
    ).toBe('/explicit/traces.db');
  });
});
