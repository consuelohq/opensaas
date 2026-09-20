import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dir, '..', '..', '..', '..');
const read = (...parts: string[]) =>
  readFileSync(join(repoRoot, ...parts), 'utf8');

describe('dialer GitHub release workflow contract', () => {
  it('classifies the complete deployed dialer surface and validates all three packages', () => {
    const ci = read('.github', 'workflows', 'consuelo-ci.yaml');
    const planner = read('packages', 'os', 'scripts', 'ci-plan.ts');
    expect(planner).toContain("file.startsWith('packages/dialer-server/')");
    expect(planner).toContain("file.startsWith('packages/lead-connector/')");
    expect(planner).toContain("file.startsWith('packages/logger/')");
    expect(ci).toContain('bun test packages/dialer/src');
    expect(ci).toContain('bun test packages/dialer-server/src');
    expect(ci).toContain('bun test packages/lead-connector/src');
    expect(ci).toContain('bun run --cwd packages/dialer typecheck');
    expect(ci).toContain('bun run --cwd packages/dialer-server typecheck');
    expect(ci).toContain('bun run --cwd packages/lead-connector typecheck');
    expect(ci).toContain('bun run --cwd packages/dialer-server build');
    expect(ci).toContain('bun run --cwd packages/lead-connector build');
    expect(ci).toContain('docker build');
    expect(ci).toContain('--file packages/dialer-server/Dockerfile');
    expect(ci).toContain('bun run --cwd packages/logger build');
    expect(ci.indexOf('bun run --cwd packages/logger build')).toBeLessThan(
      ci.indexOf('bun run --cwd packages/dialer typecheck'),
    );
  });

  it('builds clean Railway workspace dependencies in package order', () => {
    const dockerfile = read('packages', 'dialer-server', 'Dockerfile');
    const railway = read('packages', 'dialer-server', 'railway.json');
    expect(dockerfile).toContain('FROM node:24-bookworm-slim AS dependencies');
    expect(dockerfile).not.toContain(
      'FROM node:22-bookworm-slim AS dependencies',
    );
    const builds = [
      'bun run --cwd packages/logger build',
      'bun run --cwd packages/dialer build',
      'bun run --cwd packages/lead-connector build',
      'bun run --cwd packages/dialer-server build',
    ];
    let cursor = -1;
    for (const command of builds) {
      const next = dockerfile.indexOf(command);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(railway).toContain('packages/logger/**');
  });

  it('releases dialer changes from main in fail-closed provider order with deployment-only secrets', () => {
    const release = read(
      '.github',
      'workflows',
      'consuelo-production-release.yaml',
    );
    expect(release).toContain('- dialer');
    expect(release).toContain('environment: consuelo dialer / production');
    expect(release).toContain(
      'packages/(dialer|dialer-server|lead-connector|logger)/',
    );
    expect(release).toContain('bun run --cwd packages/logger build');
    expect(release.indexOf('bun run --cwd packages/logger build')).toBeLessThan(
      release.indexOf('bun run --cwd packages/dialer typecheck'),
    );
    const steps = [
      'Verify approved Marketplace bootstrap source',
      'Deploy dialer server to Railway',
      'Run safe dialer production smoke',
      'Deploy LeadConnector worker',
      'Verify LeadConnector worker',
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
      'consuelo-lead-connector-click-to-call.marketplace-loader.html',
    );
    expect(release).toContain('verify-marketplace-bootstrap.ts');
    expect(release).toContain('LEADCONNECTOR_MARKETPLACE_BOOTSTRAP_SHA256');
    expect(release).toContain('--launcher-bootstrap');
    expect(release).not.toContain('Reconcile GoHighLevel Custom Menu');
    expect(release).not.toContain('configure-production-menu.ts');
    expect(release).not.toContain(
      'LEADCONNECTOR_PRODUCTION_PRIVATE_INTEGRATION_TOKEN',
    );
    expect(release).not.toContain('LEADCONNECTOR_PRODUCTION_CUSTOM_MENU_ID');
    expect(release).not.toContain('LEADCONNECTOR_PRODUCTION_LOCATION_ID');
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
