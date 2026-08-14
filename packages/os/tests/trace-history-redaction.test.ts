import { describe, expect, it } from 'vitest';

import { sanitizeTraceHistoryRowForTest } from '../scripts/lib/trace-sites-local-read-backend';

describe('trace history redaction boundary', () => {
  it('keeps safe inspector metadata while redacting credentials, prompts, environment values, and local user paths', () => {
    const row = sanitizeTraceHistoryRowForTest({
      rowid: 1,
      id: 'row_secret',
      ts: '2026-07-23T20:00:00.000Z',
      trace_id: 'trc_safe_identity',
      mcp_trace_id: 'mcp_safe_identity',
      source: 'workspace',
      tool: 'code.call',
      task_session: 'tsk_safe_session',
      branch: 'task/os-web/safe-traces',
      worktree: '/Users/kokayi/Dev/private-worktree',
      status: 'error',
      ok: 0,
      code: 'COMMAND_FAILED',
      exit_code: 1,
      duration_ms: 42,
      input_json: JSON.stringify({
        authorization: 'Bearer bearer-secret-1234567890abcdef',
        prompt: 'private system prompt fixture',
        env: { DATABASE_URL: 'postgres://user:password@private.example/db' },
        taskSession: 'tsk_safe_session',
        traceId: 'trc_safe_identity',
        route: '/gateway/traces/recent',
        requiredScope: 'trace:read',
      }),
      resolved_input_json: JSON.stringify({
        apiKey: 'sk_fixture_secret_value_1234567890',
        path: '/Users/kokayi/.consuelo/private.json',
        branch: 'task/os-web/safe-traces',
      }),
      result_json: JSON.stringify({
        ok: false,
        message: 'failed with Bearer output-secret-1234567890abcdef',
        token: 'output-token-secret-1234567890',
        requestId: 'req_safe_identity',
      }),
      stderr: 'stderr has Bearer stderr-secret-1234567890abcdef',
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
    });

    const serialized = JSON.stringify(row);
    expect(row.taskSession).toBe('tsk_safe_session');
    expect(row.branch).toBe('task/os-web/safe-traces');
    expect(row.traceId).toBe('trc_safe_identity');
    expect(row.worktree).toBe('/Users/[user]/Dev/private-worktree');
    expect(row.rawInputJson).toContain('tsk_safe_session');
    expect(row.rawInputJson).toContain('/gateway/traces/recent');
    expect(row.rawInputJson).toContain('trace:read');
    expect(row.rawResultJson).toContain('req_safe_identity');
    expect(row.rawResolvedInputJson).toContain('task/os-web/safe-traces');
    expect(row.rawResolvedInputJson).toContain('/Users/[user]/.consuelo/private.json');
    expect(serialized).toContain('COMMAND_FAILED');
    expect(serialized).toContain('[REDACTED');
    expect(serialized).not.toContain('bearer-secret-1234567890abcdef');
    expect(serialized).not.toContain('private system prompt fixture');
    expect(serialized).not.toContain('postgres://user:password@private.example/db');
    expect(serialized).not.toContain('sk_fixture_secret_value_1234567890');
    expect(serialized).not.toContain('output-secret-1234567890abcdef');
    expect(serialized).not.toContain('stderr-secret-1234567890abcdef');
    expect(serialized).not.toContain('/Users/kokayi');
  });
  it('keeps safe batch children and token accounting in rich history rows', () => {
    const row = sanitizeTraceHistoryRowForTest({
      rowid: 2,
      id: 'row_batch',
      ts: '2026-08-12T02:00:00.000Z',
      trace_id: 'trc_batch',
      source: 'facade',
      tool: 'batch',
      status: 'ok',
      ok: 1,
      code: 'OK',
      exit_code: 0,
      duration_ms: 25,
      input_json: JSON.stringify({ steps: [{ tool: 'fs.read', input: { path: 'packages/os/README.md' } }] }),
      resolved_input_json: JSON.stringify({ steps: [{ tool: 'fs.read', input: { path: 'packages/os/README.md' } }] }),
      result_json: JSON.stringify({
        ok: true,
        data: {
          results: [
            { tool: 'fs.read', traceId: 'trc_child', inputTokens: 7, outputTokens: 11, totalTokens: 18, ok: true, code: 'OK' },
          ],
        },
      }),
      input_tokens: 7,
      output_tokens: 11,
      total_tokens: 18,
    });

    expect(row.tokens).toBe(18);
    expect(row.batchResultsCount).toBe(1);
    expect(row.batchResultsJson).toEqual([
      expect.objectContaining({
        tool: 'fs.read',
        traceId: 'trc_child',
        totalTokens: 18,
      }),
    ]);
  });

});
