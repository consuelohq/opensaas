import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parsePrRef, resolvePrRefNumber } = require('../scripts/lib/pr-ref.js');

describe('pr-ref parser', () => {
  it('accepts numbers and common PR text', () => {
    expect(resolvePrRefNumber('686')).toBe(686);
    expect(resolvePrRefNumber('#686')).toBe(686);
    expect(resolvePrRefNumber('PR #686')).toBe(686);
    expect(resolvePrRefNumber('pull/686')).toBe(686);
  });

  it('accepts GitHub, diffs, and Graphite URLs', () => {
    expect(parsePrRef('https://github.com/consuelohq/opensaas/pull/686/files')).toMatchObject({ prNumber: 686, source: 'github' });
    expect(parsePrRef('https://diffs.consuelohq.com/consuelohq/opensaas/pull/780')).toMatchObject({ prNumber: 780, source: 'diffs' });
    expect(parsePrRef('https://app.graphite.com/github/pr/consuelohq/opensaas/686/some-slug')).toMatchObject({ prNumber: 686, source: 'graphite' });
  });

  it('rejects ambiguous text and non-PR URLs', () => {
    expect(() => parsePrRef('PR #686 and PR #780')).toThrow(/ambiguous/);
    expect(() => parsePrRef('https://github.com/consuelohq/opensaas/issues/686')).toThrow(/unsupported GitHub URL/);
    expect(() => parsePrRef('build 20260608 run 686')).toThrow(/ambiguous/);
  });

  it('rejects wrong repo URLs unless repo is overridden', () => {
    expect(() => parsePrRef('https://github.com/other/opensaas/pull/686')).toThrow(/expected consuelohq\/opensaas/);
    expect(parsePrRef('https://github.com/other/opensaas/pull/686', { repo: 'other/opensaas' })).toMatchObject({ prNumber: 686, repo: 'other/opensaas' });
  });
});
