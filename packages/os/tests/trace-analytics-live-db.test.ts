import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolveTraceAnalyticsDb, traceWindowStartUtc } from '../../../scripts/operator/trace-analytics-db';

const home = '/tmp/consuelo-trace-test';
const live = join(home, '.consuelo/node/db/traces.db');
const legacy = join(home, 'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db');

describe('trace analytics database selection', () => {
  it('uses the active Consuelo OS trace store instead of the retired OpenWorkspace store', () => {
    expect(resolveTraceAnalyticsDb({ home, argv: [], env: {}, exists: (path) => path === live })).toBe(live);
  });

  it('supports legacy installations when the current OS trace database is missing', () => {
    expect(resolveTraceAnalyticsDb({ home, argv: [], env: {}, exists: () => false })).toBe(legacy);
  });

  it('preserves explicit TRACE_DB and --db= override priority', () => {
    const options = { home, exists: () => true };
    expect(resolveTraceAnalyticsDb({ ...options, argv: ['--db=/from-flag'], env: { TRACE_DB: '/from-env' } })).toBe('/from-env');
    expect(resolveTraceAnalyticsDb({ ...options, argv: ['--db=/from-flag'], env: {} })).toBe('/from-flag');
  });

  it('computes an ISO UTC cutoff for rolling windows, without SQLite datetime lexical drift', () => {
    const now = new Date('2026-10-31T07:50:47.373Z');
    expect(traceWindowStartUtc(1, now)).toBe('2026-10-30T07:50:47.373Z');
    expect(traceWindowStartUtc(7, now)).toBe('2026-10-24T07:50:47.373Z');
  });
});
