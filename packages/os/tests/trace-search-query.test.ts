import { describe, expect, it } from 'vitest';

import {
  compileTraceHistorySearch,
  parseTraceSearchTerms,
} from '../scripts/lib/trace-search-query';

describe('trace history search query', () => {
  it('parses free text, quoted text, and structured fields deterministically', () => {
    expect(parseTraceSearchTerms('fs.read branch:feature/search date:2026-08-13 "pull request"')).toEqual([
      { field: null, value: 'fs.read' },
      { field: 'branch', value: 'feature/search' },
      { field: 'date', value: '2026-08-13' },
      { field: null, value: 'pull request' },
    ]);
  });

  it('compiles structured metadata and date terms into parameterized SQL without embedding query values', () => {
    const compiled = compileTraceHistorySearch('tool:fs.read branch:feature/search status:error date:2026-08-13');
    expect(compiled.sql).toContain('lower(coalesce(tool');
    expect(compiled.sql).toContain('lower(coalesce(branch');
    expect(compiled.sql).toContain('ts >= ?');
    expect(compiled.sql).toContain('ts < ?');
    expect(compiled.sql).not.toContain('feature/search');
    expect(compiled.values).toEqual(expect.arrayContaining(['%fs.read%', '%feature/search%']));
    expect(compiled.values.some((value) => String(value).startsWith('2026-08-13'))).toBe(true);
    expect(compiled.values.some((value) => String(value).startsWith('2026-08-14'))).toBe(true);
  });

  it('keeps free-text full-history search on non-payload metadata columns', () => {
    const compiled = compileTraceHistorySearch('trc_history_3');
    expect(compiled.sql).toContain('trace_id');
    expect(compiled.sql).toContain('tool');
    expect(compiled.sql).not.toContain('input_json');
    expect(compiled.sql).not.toContain('result_json');
    expect(compiled.sql).not.toContain('stderr');
    const slash = String.fromCharCode(92);
    expect(compiled.values).toContain(`%trc${slash}_history${slash}_3%`);
  });
});
