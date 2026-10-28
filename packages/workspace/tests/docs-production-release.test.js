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
    expect(workflow).toContain("github.event_name == 'push' || inputs.target == 'all' || inputs.target == 'docs'");
    expect(workflow).toContain('working-directory: packages/documentation');
    expect(workflow).toContain('bun install --frozen-lockfile');
    expect(workflow).toContain('bun run docs:deploy -- --json');
    expect(workflow).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_DOCS_API_TOKEN || secrets.CLOUDFLARE_OS_RELEASE_API_TOKEN }}');
    expect(workflow).toContain('needs: [deploy-docs, deploy-website]');
    expect(workflow).toContain("needs.deploy-docs.result == 'success'");
    expect(workflow).toContain("needs.deploy-docs.result == 'skipped'");
  });
});
