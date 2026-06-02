import { describe, expect, it } from 'vitest';

import { redactJson, redactText } from '../scripts/lib/redaction';

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
});
