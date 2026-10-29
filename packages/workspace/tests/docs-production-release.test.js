import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const workflowPath = join(repoRoot, '.github/workflows/consuelo-production-release.yaml');

describe('documentation production release wiring', () => {
  test('deploys docs for main pushes and supports docs-only manual releases', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('- docs');
    expect(workflow).toContain('deploy-docs:');
    expect(workflow).toContain('name: Consuelo / docs deploy');
    expect(workflow).toContain("if: needs.public-changes.outputs.docs == 'true'");
    expect(workflow).toContain('bun packages/dialer-website/scripts/release-public-sites.mjs --surface docs --deploy');
    expect(workflow).toContain("CONSUELO_PUBLIC_SITE_PHASE: ${{ vars.CONSUELO_PUBLIC_SITE_PHASE || 'legacy' }}");
    const release = readFileSync(join(repoRoot, 'packages/dialer-website/scripts/release-public-sites.mjs'), 'utf8');
    expect(release).toContain("['bun', 'install', '--frozen-lockfile']");
    expect(release).toContain("if (!['legacy', 'os-mounted', 'dialer'].includes(phase))");
    expect(workflow).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_DOCS_API_TOKEN || secrets.CLOUDFLARE_OS_RELEASE_API_TOKEN }}');
    expect(workflow).toContain('needs: [public-changes, deploy-docs, deploy-website]');
    expect(workflow).toContain("needs.public-changes.outputs.os == 'true'");
    expect(workflow).toContain("needs.deploy-docs.result == 'success'");
    expect(workflow).toContain("needs.deploy-docs.result == 'skipped'");
  });
});
