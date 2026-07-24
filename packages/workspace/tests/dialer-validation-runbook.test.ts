import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');
const readRepoFile = (path: string) =>
  readFileSync(resolve(repoRoot, path), 'utf8');

describe('dialer validation runbook contract', () => {
  const runbook = readRepoFile('areas/dialer/AGENTS.md');
  const codeReview = readRepoFile('scripts/code-review.sh');

  it('documents the complete local infrastructure and reset contract', () => {
    expect(runbook).toContain('brew install postgresql@17 redis pgvector');
    expect(runbook).toContain('brew services start postgresql@17');
    expect(runbook).toContain('brew services start redis');
    expect(runbook).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(runbook).toContain('IS_CI=false');
    expect(runbook).toContain('NODE_OPTIONS=--max-old-space-size=8192');
    expect(runbook).toContain('npx nx database:reset twenty-server');
    expect(runbook).toContain('APP_SECRET');
    expect(runbook).toContain('worktree list --porcelain');
    expect(runbook).toContain('SERVER_ENV_TARGET');
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
    expect(runbook).toContain('starts twenty-server');
  });

  it('documents named-tunnel callback preflight and mode proof boundaries', () => {
    expect(runbook).toContain('dialer-dev.consuelohq.com');
    expect(runbook).toContain('service: http://localhost:3000');
    expect(runbook).toContain('no-script Worker route exclusion');
    expect(runbook).toContain('WORKSPACE_HOSTNAME_NOT_FOUND');
    expect(runbook).toContain('trycloudflare.com');
    expect(runbook).toContain('--config /dev/null');
    expect(runbook).toContain('cloudflared --config');
    expect(runbook).toContain('tunnel run');
    expect(runbook).toContain('/api/v1/calls/parallel/status-callback');
    expect(runbook).toContain('/api/v1/calls/parallel/customer-twiml');
    expect(runbook).toContain('x-twilio-signature');
    expect(runbook).toContain('HTTP 401');
    expect(runbook).toContain('HTTP 200');
    expect(runbook).toContain('mock');
    expect(runbook).toContain('twilio-test');
    expect(runbook).toContain('live');
    expect(runbook).toContain('does not prove real TwiML');
    expect(runbook).toContain('only live proves');
    expect(runbook).toContain('no root `railway.json` or `railway.toml`');
    expect(runbook).toContain('legacy `packages/api` image');
    expect(runbook).toContain('packages/twenty-docker/twenty/Dockerfile');
    expect(runbook).toContain('currently copies `packages/os`');
  });

  it('does not put complete E.164 numbers in durable dialer notes', () => {
    expect(runbook.match(/\+\d{7,15}/g) ?? []).toEqual([]);
  });

  it('routes dialer-critical changes through focused review tests', () => {
    expect(codeReview).toContain('DIALER_TESTS');
    expect(codeReview).toContain('git ls-files --others --exclude-standard');
    expect(codeReview).toContain('packages/workspace/tests/dialer-.*');
    expect(codeReview).toContain('dialer-validation-runbook.test.ts');
    expect(codeReview).toContain('dialer-scenario-workspace-selection.test.ts');
    expect(codeReview).toContain('dialer-call-start.service.spec.ts');
    expect(codeReview).toContain('parallel.service.spec.ts');
    expect(codeReview).toContain('caller-id.spec.ts');
    expect(codeReview).toContain('parallel-dialer.spec.ts');
    expect(codeReview).toContain('packages/lead-connector/');
    expect(codeReview).toContain('bun test packages/lead-connector/src');
    expect(codeReview).toContain('TOTAL_CHECKS=17');
  });
});
