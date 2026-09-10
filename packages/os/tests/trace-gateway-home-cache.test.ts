import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveCanonicalTraceDbPath } from '../scripts/lib/trace-persistence';
import { traceGatewayEndpoints } from '../scripts/server/services/trace-gateway';

const homes: string[] = [];
const previousTraceDb = process.env.CONSUELO_TRACE_DB;
const previousTraceDbAlias = process.env.TRACE_DB;
const previousHome = process.env.CONSUELO_HOME;
const previousOsHome = process.env.CONSUELO_OS_HOME;

afterEach(() => {
  if (previousTraceDb === undefined) delete process.env.CONSUELO_TRACE_DB;
  else process.env.CONSUELO_TRACE_DB = previousTraceDb;
  if (previousTraceDbAlias === undefined) delete process.env.TRACE_DB;
  else process.env.TRACE_DB = previousTraceDbAlias;
  if (previousHome === undefined) delete process.env.CONSUELO_HOME;
  else process.env.CONSUELO_HOME = previousHome;
  if (previousOsHome === undefined) delete process.env.CONSUELO_OS_HOME;
  else process.env.CONSUELO_OS_HOME = previousOsHome;
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('trace gateway home cache', () => {
  it('does not reuse live endpoints from a previous canonical trace db path', () => {
    const homeA = mkdtempSync(join(tmpdir(), 'trace-gateway-home-a-'));
    const homeB = mkdtempSync(join(tmpdir(), 'trace-gateway-home-b-'));
    homes.push(homeA, homeB);
    delete process.env.TRACE_DB;

    process.env.CONSUELO_HOME = homeA;
    process.env.CONSUELO_OS_HOME = homeA;
    process.env.CONSUELO_TRACE_DB = join(homeA, 'node', 'db', 'traces-a.sqlite');
    const pathA = resolveCanonicalTraceDbPath();
    const first = traceGatewayEndpoints();
    expect(traceGatewayEndpoints()).toBe(first);

    process.env.CONSUELO_HOME = homeB;
    process.env.CONSUELO_OS_HOME = homeB;
    process.env.CONSUELO_TRACE_DB = join(homeB, 'node', 'db', 'traces-b.sqlite');
    const pathB = resolveCanonicalTraceDbPath();
    expect(pathB).not.toBe(pathA);
    const second = traceGatewayEndpoints();
    expect(second).not.toBe(first);
    expect(traceGatewayEndpoints()).toBe(second);
  });
});
