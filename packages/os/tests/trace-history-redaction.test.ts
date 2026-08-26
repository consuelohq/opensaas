import { describe, expect, it } from 'vitest';

import { sanitizeTraceHistoryRowForTest } from '../scripts/lib/trace-sites-local-read-backend';
import { estimateTraceCost } from '../scripts/lib/trace-cost-estimator';

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
      work_session: 'wrk_safe_session',
      work_path: '/Users/kokayi/Developer/raycast-extensions/private-extension',
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
    expect(row.workSession).toBe('wrk_safe_session');
    expect(row.workPath).toBe('/Users/[user]/Developer/raycast-extensions/private-extension');
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

  it('estimates non-zero trace cost from safe model metadata and falls back to Sol-equivalent pricing', () => {
    const explicitModel = sanitizeTraceHistoryRowForTest({
      rowid: 3,
      id: 'row_priced_model',
      ts: '2026-08-26T05:00:00.000Z',
      trace_id: 'trc_priced_model',
      source: 'facade',
      tool: 'subagent',
      status: 'ok',
      ok: 1,
      code: 'OK',
      exit_code: 0,
      duration_ms: 42,
      input_json: JSON.stringify({ provider: 'codex', model: 'gpt-5.5-codex' }),
      resolved_input_json: JSON.stringify({ provider: 'codex', model: 'gpt-5.5-codex' }),
      result_json: JSON.stringify({ ok: true }),
      input_tokens: 1_000,
      output_tokens: 500,
      total_tokens: 1_500,
    });
    const explicitMetadata = explicitModel.metadata as Record<string, unknown>;

    expect(Number(explicitModel.cost)).toBeGreaterThan(0);
    expect(explicitModel.costLabel).not.toBe('$0.0000');
    expect(explicitMetadata.pricingModel).toBe('gpt-5.5-codex');
    expect(explicitMetadata.pricingRateModel).toBe('gpt-5.5');
    expect(explicitMetadata.pricingSource).toBe('trace_model');

    const fallback = sanitizeTraceHistoryRowForTest({
      rowid: 4,
      id: 'row_priced_fallback',
      ts: '2026-08-26T05:00:01.000Z',
      trace_id: 'trc_priced_fallback',
      source: 'facade',
      tool: 'fs.search',
      status: 'ok',
      ok: 1,
      code: 'OK',
      exit_code: 0,
      duration_ms: 25,
      input_json: '{}',
      resolved_input_json: '{}',
      result_json: JSON.stringify({ ok: true }),
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    });
    const fallbackMetadata = fallback.metadata as Record<string, unknown>;

    expect(Number(fallback.cost)).toBeGreaterThan(0);
    expect(fallback.costLabel).not.toBe('$0.0000');
    expect(fallbackMetadata.pricingModel).toBe('gpt-5.6-sol');
    expect(fallbackMetadata.pricingSource).toBe('sol_fallback');
  });

  it('does not count an input-only failed trace as output payload', () => {
    const estimate = estimateTraceCost({
      tool: 'code.call',
      inputTokens: 0,
      outputTokens: 0,
      rawInputJson: JSON.stringify({ command: 'failed before producing a result' }),
      rawResultJson: '',
    });

    expect(estimate?.inputTokens).toBeGreaterThan(0);
    expect(estimate?.outputTokens).toBe(0);
  });

  it('keeps recorded total tokens authoritative and detects model names from sanitized text fallbacks', () => {
    const estimate = estimateTraceCost({
      tool: 'subagent',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 100,
      rawInputJson: 'provider=anthropic model=claude-sonnet-4-6',
      rawResultJson: 'completed with a deliberately longer textual result payload for allocation',
    });

    expect(estimate).not.toBeNull();
    expect((estimate?.inputTokens ?? 0) + (estimate?.outputTokens ?? 0)).toBe(100);
    expect(estimate?.model).toBe('claude-sonnet-4-6');
    expect(estimate?.provider).toBe('anthropic');
    expect(estimate?.rateModel).toBe('gpt-5.6-sol');
    expect(estimate?.pricingSource).toBe('trace_model_fallback');
  });

});
