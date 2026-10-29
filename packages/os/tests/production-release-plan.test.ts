import { describe, expect, it } from 'vitest';
import { createConsueloReleasePlan } from '../scripts/production-release-plan';

const none = { docs: false, website: false, os: false };
const push = (files: string[]) => createConsueloReleasePlan({ eventName: 'push', files });
describe('production surface release isolation', () => {
  it('activates Dialer delivery only in its explicit public cutover phase', () => {
    for (const phase of ['legacy', 'os-mounted']) {
      expect(createConsueloReleasePlan({ eventName: 'push', phase, files: ['packages/dialer-website/src/pages/index.astro'] })).toEqual(none);
    }
    expect(createConsueloReleasePlan({ eventName: 'push', phase: 'dialer', files: ['packages/dialer-website/src/pages/index.astro'] })).toEqual({ ...none, website: true });
    expect(createConsueloReleasePlan({ eventName: 'push', phase: 'dialer', files: ['packages/dialer-documentation/src/content/docs/index.mdx'] })).toEqual({ ...none, docs: true });
    expect(() => createConsueloReleasePlan({ eventName: 'push', phase: 'unknown', files: [] })).toThrow();
  });
  it('releases both public surfaces for the shared orchestrator in every phase', () => {
    for (const phase of ['legacy', 'os-mounted', 'dialer']) {
      expect(createConsueloReleasePlan({ eventName: 'push', phase, files: ['packages/dialer-website/scripts/release-public-sites.mjs'] })).toEqual({ docs: true, website: true, os: false });
    }
  });
  it('keeps preview-only packages out of production delivery jobs', () => {
    expect(push(['packages/dialer-website/src/pages/index.astro'])).toEqual(none);
    expect(push(['packages/dialer-documentation/src/content/docs/index.mdx'])).toEqual(none);
    expect(push(['packages/documentation/src/content/docs/index.mdx'])).toEqual({ ...none, docs: true });
    expect(push(['packages/consuelo-website/src/pages/index.astro'])).toEqual({ ...none, website: true });
  });
  it('keeps runtime surfaces independent and combines simultaneous changes', () => {
    expect(push(['packages/os/cloudflare/os-device-authority/src/worker.ts'])).toEqual({ ...none, os: true });
    expect(push(['packages/workspace/scripts/tool-runtime.js'])).toEqual({ ...none, os: true });
    expect(push(['packages/dialer-server/src/index.ts'])).toEqual(none);
    expect(push(['packages/documentation/astro.config.mjs', 'packages/cli/src/auth.ts'])).toEqual({ ...none, docs: true, os: true });
  });
  it('does not deploy for tests, task metadata or orchestration-only edits', () => {
    expect(push(['.task/tasks/website/example.json', 'packages/os/tests/example.test.ts',
      'packages/os/scripts/production-release-plan.ts', 'packages/workspace/test-selection.rules.json', '.github/workflows/consuelo-production-release.yaml'])).toEqual(none);
  });
  it('preserves root dependency and explicit rollback triggers', () => {
    for (const file of ['package.json', 'bun.lock', 'bunfig.toml', '.bun-version', 'nx.json', 'tsconfig.base.json']) {
      expect(push([file])).toEqual({ docs: true, website: true, os: true });
    }
    expect(push(['.github/workflows/consuelo-dialer-rollback.yaml'])).toEqual(none);
  });
  it('supports each explicit manual target without deploying unrelated surfaces', () => {
    for (const target of ['docs', 'website', 'os'] as const) {
      expect(createConsueloReleasePlan({ eventName: 'workflow_dispatch', target, files: [] })).toEqual({ ...none, [target]: true });
    }
    expect(createConsueloReleasePlan({ eventName: 'workflow_dispatch', target: 'dialer', files: [] })).toEqual(none);
    expect(createConsueloReleasePlan({ eventName: 'workflow_dispatch', target: 'os-device-auth', files: [] })).toEqual({ ...none, os: true });
    expect(createConsueloReleasePlan({ eventName: 'workflow_dispatch', target: 'all', files: [] })).toEqual({ docs: true, website: true, os: true });
  });
  it('fails closed for unknown events and manual targets', () => {
    expect(() => createConsueloReleasePlan({ eventName: 'workflow_dispatch', target: 'websit', files: [] })).toThrow();
    expect(() => createConsueloReleasePlan({ eventName: 'pull_request', files: ['package.json'] })).toThrow();
  });
});
