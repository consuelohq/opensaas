import { describe, expect, it } from 'vitest';

import { sanitizeTraceHistoryRowForTest } from '../scripts/lib/trace-sites-local-read-backend';

describe('trace history redaction boundary', () => {
  it('should keep inspector fields when redacting credentials, prompts, environment values, and local paths', () => {
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
      }),
      resolved_input_json: JSON.stringify({
        apiKey: 'sk_fixture_secret_value_1234567890',
        path: '/Users/kokayi/.consuelo/private.json',
      }),
      result_json: JSON.stringify({
        ok: false,
        message: 'failed with Bearer output-secret-1234567890abcdef',
        token: 'output-token-secret-1234567890',
      }),
      stderr: 'stderr has Bearer stderr-secret-1234567890abcdef',
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
    });

    const serialized = JSON.stringify(row);
    expect(serialized).toContain('trc_safe_identity');
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
});
