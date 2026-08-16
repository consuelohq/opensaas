import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');
const readRepoFile = (path: string) =>
  readFileSync(resolve(repoRoot, path), 'utf8');

describe('dialer validation runbook contract', () => {
  const runbook = readRepoFile('areas/dialer/AGENTS.md');
  const codeReview = readRepoFile('scripts/code-review.sh');

  it('documents the standalone dialer-server local runtime and migration contract', () => {
    expect(runbook).toContain('brew install postgresql@17 redis pgvector');
    expect(runbook).toContain('brew services start postgresql@17');
    expect(runbook).toContain('brew services start redis');
    expect(runbook).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(runbook).toContain('DIALER_SERVER_PUBLIC_URL');
    expect(runbook).toContain('bun run --cwd packages/dialer-server db:migrate');
    expect(runbook).toContain('bun run --cwd packages/dialer-server build');
    expect(runbook).toContain('bun run --cwd packages/dialer-server start');
    expect(runbook).not.toContain('packages/twenty-server');
    expect(runbook).not.toContain('packages/twenty-front');
    expect(runbook).not.toContain('packages/twenty-docker');
  });

  it('documents the current Keychain services and secret-safe shell exports', () => {
    for (const service of [
      'consuelo_twilio_live_account_sid',
      'consuelo_twilio_live_auth_token',
      'consuelo_twilio_test_account_sid',
      'consuelo_twilio_test_auth_token',
      'consuelo_scenario_safe_to_numbers',
      'consuelo_scenario_safe_from_numbers',
    ]) {
      expect(runbook).toContain(service);
    }

    expect(runbook).toContain('>/dev/null');
    expect(runbook).toContain('export TWILIO_ACCOUNT_SID=');
    expect(runbook).toContain('export TWILIO_TEST_ACCOUNT_SID=');
    expect(runbook).toContain('export CONSUELO_SCENARIO_SAFE_TO_NUMBERS=');
    expect(runbook).toContain('starts `@consuelo/dialer-server`');
  });

  it('documents the standalone callback and deployment boundaries', () => {
    expect(runbook).toContain('dialer-dev.consuelohq.com');
    expect(runbook).toContain('service: http://localhost:3000');
    expect(runbook).toContain('no-script Worker route exclusion');
    expect(runbook).toContain('WORKSPACE_HOSTNAME_NOT_FOUND');
    expect(runbook).toContain('trycloudflare.com');
    expect(runbook).toContain('--config /dev/null');
    expect(runbook).toContain('cloudflared --config');
    expect(runbook).toContain('tunnel run');
    expect(runbook).toContain('/webhooks/twilio/status');
    expect(runbook).toContain('/webhooks/twilio/customer-twiml');
    expect(runbook).toContain('/webhooks/twilio/media');
    expect(runbook).toContain('x-twilio-signature');
    expect(runbook).toContain('HTTP 401');
    expect(runbook).toContain('HTTP 200');
    expect(runbook).toContain('packages/dialer-server/Dockerfile');
    expect(runbook).toContain('packages/dialer-server/railway.json');
    expect(runbook).not.toContain('/api/v1/calls/parallel');
  });

  it('does not put complete E.164 numbers in durable dialer notes', () => {
    expect(runbook.match(/\+\d{7,15}/g) ?? []).toEqual([]);
  });

  it('routes dialer-critical changes through current focused product suites', () => {
    expect(codeReview).toContain('DIALER_TESTS');
    expect(codeReview).toContain('git ls-files --others --exclude-standard');
    expect(codeReview).toContain('packages/workspace/tests/dialer-.*');
    expect(codeReview).toContain('dialer-validation-runbook.test.ts');
    expect(codeReview).toContain('dialer-scenario-workspace-selection.test.ts');
    expect(codeReview).toContain('caller-id.spec.ts');
    expect(codeReview).toContain('parallel-dialer.spec.ts');
    expect(codeReview).toContain('bun test packages/dialer-server/src');
    expect(codeReview).toContain('bun test packages/lead-connector/src');
    expect(codeReview).not.toContain('packages/twenty-server');
    expect(codeReview).not.toContain('packages/twenty-front');
    expect(codeReview).toContain('TOTAL_CHECKS=17');
  });
});
