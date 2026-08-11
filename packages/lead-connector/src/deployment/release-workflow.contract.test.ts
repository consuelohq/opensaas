import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dir, '..', '..', '..', '..');
const read = (...parts: string[]) =>
  readFileSync(join(repoRoot, ...parts), 'utf8');

describe('dialer GitHub release workflow contract', () => {
  it('classifies the complete deployed dialer surface and validates all three packages', () => {
    const ci = read('.github', 'workflows', 'consuelo-ci.yaml');
    expect(ci).toContain('^packages/dialer-server/');
    expect(ci).toContain('^packages/lead-connector/');
    expect(ci).toContain('bun test packages/dialer/src');
    expect(ci).toContain('bun test packages/dialer-server/src');
    expect(ci).toContain('bun test packages/lead-connector/src');
    expect(ci).toContain('bun run --cwd packages/dialer typecheck');
    expect(ci).toContain('bun run --cwd packages/dialer-server typecheck');
    expect(ci).toContain('bun run --cwd packages/lead-connector typecheck');
    expect(ci).toContain('bun run --cwd packages/dialer-server build');
    expect(ci).toContain('bun run --cwd packages/lead-connector build:embed');
  });

  it('releases dialer changes from main in fail-closed provider order with deployment-only secrets', () => {
    const release = read(
      '.github',
      'workflows',
      'consuelo-production-release.yaml',
    );
    expect(release).toContain('- dialer');
    expect(release).toContain('environment: consuelo dialer / production');
    const steps = [
      'Deploy dialer server to Railway',
      'Run safe dialer production smoke',
      'Deploy LeadConnector worker',
      'Verify LeadConnector worker',
      'Reconcile GoHighLevel Custom Menu',
      'Write dialer release manifest',
    ];
    let cursor = -1;
    for (const step of steps) {
      const next = release.indexOf(step);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(release).toContain('RAILWAY_DIALER_PROJECT_TOKEN');
    expect(release).toContain('CLOUDFLARE_DIALER_WORKER_API_TOKEN');
    expect(release).toContain(
      'LEADCONNECTOR_PRODUCTION_PRIVATE_INTEGRATION_TOKEN',
    );
    expect(release).not.toMatch(
      /STRIPE_SECRET_KEY|TWILIO_AUTH_TOKEN|GROQ_API_KEY|DATABASE_URL|REDIS_URL/,
    );
  });

  it('provides explicit-id manual rollback and never guesses a previous release', () => {
    const rollback = read(
      '.github',
      'workflows',
      'consuelo-dialer-rollback.yaml',
    );
    expect(rollback).toContain('workflow_dispatch:');
    expect(rollback).toContain('railway_deployment_id:');
    expect(rollback).toContain('cloudflare_version_id:');
    expect(rollback).toContain('environment: consuelo dialer / production');
    expect(rollback).not.toContain('pull_request:');
    expect(rollback).not.toMatch(/previous|latest successful/i);
  });
});
