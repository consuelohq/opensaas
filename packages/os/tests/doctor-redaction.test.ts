import { Database } from 'bun:sqlite';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const forbiddenStrings = [
  'correct-horse-battery',
  'sk_test_1234567890abcdef1234567890',
  'bearer-token-1234567890abcdef',
  'client-secret-value',
  '+1 (415) 555-1212',
  'raw payload secret text',
  'url-secret-token',
];

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-doctor-log-filter-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function expectNoForbiddenLeaks(value: unknown): void {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of forbiddenStrings) {
    expect(serialized).not.toContain(forbidden);
  }
}

function runBun(args: string[]): string {
  return execFileSync('bun', args, {
    cwd: process.cwd(),
    env: { ...process.env, CONSUELO_HOME: tempHome },
    encoding: 'utf8',
  });
}

function seedSensitiveExecution(): void {
  runBun(['-e', `
    const { recordExecutionFinished, recordExecutionStarted } = await import('./scripts/lib/runtime-state.ts');
    const traceId = 'trc_redaction_fixture';
    recordExecutionStarted({
      traceId,
      name: 'sensitive-skill',
      workspaceId: 'ws_123',
      userId: 'user_123',
      input: {
        sourceObjectRefs: ['person_123', 'call_456'],
        authorization: 'Bearer bearer-token-1234567890abcdef',
        apiKey: 'sk_test_1234567890abcdef1234567890',
        password: 'correct-horse-battery',
        phone: '+1 (415) 555-1212',
        url: 'https://example.test/path?token=url-secret-token&workspaceId=ws_123',
        rawPayload: { message: 'raw payload secret text' },
      },
    });
    recordExecutionFinished({
      traceId,
      status: 'failed',
      durationMs: 12,
      output: {
        ok: false,
        name: 'sensitive-skill',
        permission: 'read',
        traceId,
        durationMs: 12,
        result: {
          status: 'failed',
          sourceObjectRefs: ['person_123', 'call_456'],
          clientSecret: 'client-secret-value',
          phone: '+1 (415) 555-1212',
        },
        artifacts: [{ id: 'art_123', name: 'safe-report.md', traceId }],
        error: {
          code: 'SENSITIVE_FAILURE',
          message: 'failed for Bearer bearer-token-1234567890abcdef and phone +1 (415) 555-1212',
          details: { rawPayload: { message: 'raw payload secret text' } },
        },
      },
    });
  `]);
}

describe('Doctor execution log redaction', () => {
  it('redacts persisted execution rows and events while keeping useful fields', () => {
    seedSensitiveExecution();
    const db = new Database(join(tempHome, 'consuelo.db'), { readonly: true });
    try {
      const execution = db.query('SELECT * FROM skill_executions WHERE trace_id = ?').get('trc_redaction_fixture') as Record<string, unknown>;
      const events = db.query('SELECT * FROM execution_events WHERE trace_id = ? ORDER BY id ASC').all('trc_redaction_fixture') as Array<Record<string, unknown>>;

      expect(execution.trace_id).toBe('trc_redaction_fixture');
      expect(execution.name).toBe('sensitive-skill');
      expect(execution.workspace_id).toBe('ws_123');
      expect(execution.user_id).toBe('user_123');
      expect(execution.status).toBe('failed');
      expect(execution.duration_ms).toBe(12);
      expect(execution.error_code).toBe('SENSITIVE_FAILURE');
      expect(String(execution.output_json)).toContain('art_123');
      expect(String(execution.output_json)).toContain('person_123');
      expect(String(execution.input_json)).toContain('[REDACTED_SECRET]');
      expect(String(execution.output_json)).toContain('[REDACTED_PHONE:1212]');
      expect(String(execution.error_message)).toContain('[REDACTED_SECRET]');
      expectNoForbiddenLeaks(execution);
      expectNoForbiddenLeaks(events);
    } finally {
      db.close();
    }
  });

  it('keeps Doctor output useful without printing sensitive values', () => {
    seedSensitiveExecution();
    const watchOutput = runBun(['./scripts/doctor-watch.ts', '--once', '--json', '--limit', '10']);
    const errorsOutput = runBun(['./scripts/doctor-errors.ts', '--json', '--limit', '10']);
    const analyticsOutput = runBun(['./scripts/doctor-analytics.ts', '--json']);

    expect(watchOutput).toContain('trc_redaction_fixture');
    expect(watchOutput).toContain('sensitive-skill');
    expect(watchOutput).toContain('failed');
    expect(errorsOutput).toContain('SENSITIVE_FAILURE');
    expect(analyticsOutput).toContain('sensitive-skill');
    expectNoForbiddenLeaks(watchOutput);
    expectNoForbiddenLeaks(errorsOutput);
    expectNoForbiddenLeaks(analyticsOutput);
  });
});
