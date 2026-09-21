import { describe, expect, it } from 'vitest';

import {
  redactJson,
  redactText,
  redactTraceJson,
  redactTraceText,
} from '../scripts/lib/redaction';

const forbiddenStrings = [
  'correct-horse-battery',
  'sk_test_1234567890abcdef1234567890',
  'Bearer bearer-token-1234567890abcdef',
  'client-secret-value',
  '+1 (415) 555-1212',
  'raw payload secret text',
  'url-secret-token',
];

function expectNoForbiddenLeaks(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const forbidden of forbiddenStrings) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe('OS log redaction', () => {
  it('redacts sensitive values while preserving operational fields', () => {
    const redacted = redactJson({
      traceId: 'trc_safe_trace_123',
      workspaceId: 'ws_123',
      status: 'failed',
      durationMs: 42,
      authorization: 'Bearer bearer-token-1234567890abcdef',
      apiKey: 'sk_test_1234567890abcdef1234567890',
      password: 'correct-horse-battery',
      phone: '+1 (415) 555-1212',
      url: 'https://example.test/path?token=url-secret-token&workspaceId=ws_123',
      nested: {
        clientSecret: 'client-secret-value',
      },
      rawPayload: {
        message: 'raw payload secret text',
      },
    }) as Record<string, unknown>;

    expectNoForbiddenLeaks(redacted);
    expect(redacted.traceId).toBe('trc_safe_trace_123');
    expect(redacted.workspaceId).toBe('ws_123');
    expect(redacted.status).toBe('failed');
    expect(redacted.durationMs).toBe(42);
    expect(redacted.authorization).toBe('[REDACTED_SECRET]');
    expect(redacted.apiKey).toBe('[REDACTED_SECRET]');
    expect(redacted.password).toBe('[REDACTED_SECRET]');
    expect(redacted.phone).toBe('[REDACTED_PHONE:1212]');
    expect(String(redacted.url)).toContain('workspaceId=ws_123');
    expect(String(redacted.url)).toContain('token=%5BREDACTED%5D');
    expect(redacted.rawPayload).toMatchObject({
      redacted: true,
      type: '[REDACTED_RAW_PAYLOAD]',
    });
  });

  it('redacts sensitive data embedded in plain error text', () => {
    const redacted = redactText('failed with Bearer bearer-token-1234567890abcdef for phone +1 (415) 555-1212');

    expect(redacted).not.toContain('bearer-token-1234567890abcdef');
    expect(redacted).not.toContain('+1 (415) 555-1212');
    expect(redacted).toContain('Bearer [REDACTED_SECRET]');
    expect(redacted).toContain('[REDACTED_PHONE:1212]');
  });

  it('keeps strict generic opaque-token redaction outside the trace presentation boundary', () => {
    const opaque = '0123456789abcdef0123456789abcdef0123456789abcdef';
    expect(redactText(`value ${opaque}`)).toContain('[REDACTED_SECRET]');
  });

  it('preserves long diagnostic paths and hashes in trace text while redacting high-confidence credentials', () => {
    const longPath = '/packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts';
    const contentHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const redacted = redactTraceText(
      `${longPath} ${contentHash} Bearer bearer-token-1234567890abcdef sk_test_1234567890abcdef1234567890 token=opaque-secret-value-1234567890abcdef1234567890`,
    );

    expect(redacted).toContain(longPath);
    expect(redacted).toContain(contentHash);
    expect(redacted).toContain('Bearer [REDACTED_SECRET]');
    expect(redacted).toContain('[REDACTED_SECRET]');
    expect(redacted).not.toContain('bearer-token-1234567890abcdef');
    expect(redacted).not.toContain('sk_test_1234567890abcdef1234567890');
    expect(redacted).not.toContain('opaque-secret-value-1234567890abcdef1234567890');
  });

  it('preserves trace identity and numeric usage while still redacting credentials', () => {
    const redacted = redactTraceJson({
      traceId: 'trc_000000000001',
      mcpTraceId: 'trc_parent_000000000002',
      taskSession: 'tsk_b03a8a027a84',
      branch: 'task/os/wire-canonical-os-trace-persistence',
      worktree: '/tmp/consuelo-task-worktree',
      inputTokens: 12,
      output_tokens: 34,
      reasoningOutputTokens: 5,
      totalTokens: 51,
      apiKey: 'sk_test_1234567890abcdef1234567890',
      authorization: 'Bearer bearer-token-1234567890abcdef',
    }) as Record<string, unknown>;

    expect(redacted).toMatchObject({
      traceId: 'trc_000000000001',
      mcpTraceId: 'trc_parent_000000000002',
      taskSession: 'tsk_b03a8a027a84',
      branch: 'task/os/wire-canonical-os-trace-persistence',
      worktree: '/tmp/consuelo-task-worktree',
      inputTokens: 12,
      output_tokens: 34,
      reasoningOutputTokens: 5,
      totalTokens: 51,
      apiKey: '[REDACTED_SECRET]',
      authorization: '[REDACTED_SECRET]',
    });
    expectNoForbiddenLeaks(redacted);
  });

  it('preserves structured correlation identifiers even when their UUID tail resembles a phone number', () => {
    const requestId = '5e4c1d30-87c1-4e73-a42b-aa0240204048';
    const redacted = redactJson({ requestId, traceId: 'trc_example123', phone: '+1 (415) 555-1212' });
    expect(redacted.requestId).toBe(requestId);
    expect(redacted.traceId).toBe('trc_example123');
    expect(redacted.phone).toBe('[REDACTED_PHONE:1212]');
  });

});
