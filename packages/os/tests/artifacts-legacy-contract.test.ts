import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(osRoot, '..', '..');

function source(relativePath: string): string {
  return readFileSync(resolve(osRoot, relativePath), 'utf8');
}

function repoSource(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('Artifacts strict legacy cutover', () => {
  it('removes superseded Office, SQLite, and cloud artifact implementations', () => {
    for (const relativePath of [
      'scripts/office.ts',
      'scripts/design/office.ts',
      'scripts/design/office-landing-page.ts',
      'scripts/lib/cloud-artifacts.ts',
      'scripts/lib/office-pages.ts',
      'skills/office',
      'skills/office-landing-page',
    ]) {
      expect(existsSync(resolve(osRoot, relativePath)), relativePath).toBe(false);
    }

    expect(source('scripts/lib/artifacts.ts')).not.toContain('bun:sqlite');
    expect(source('scripts/lib/sites.ts')).not.toContain('bun:sqlite');
    expect(source('scripts/lib/artifacts.ts')).not.toContain('OfficeSiteData');
    expect(source('scripts/lib/sites.ts')).not.toContain('OfficeSiteData');
  });

  it('keeps canonical artifact runtime independent of workspace fallbacks', () => {
    for (const relativePath of [
      'scripts/artifacts.ts',
      'scripts/artifacts-design.ts',
      'scripts/lib/artifacts.ts',
      'scripts/design/artifacts.ts',
      'scripts/server/routes/artifacts.ts',
      'scripts/server/services/artifacts-gateway.ts',
    ]) {
      const runtimeSource = source(relativePath);
      expect(runtimeSource, relativePath).not.toContain('packages/workspace');
      expect(runtimeSource, relativePath).not.toContain('office.');
      expect(runtimeSource, relativePath).not.toContain('design.publish');
      expect(runtimeSource, relativePath).not.toContain('sites/office');
    }
  });

  it('publishes only canonical Artifacts tools, skills, workflows, and generated types', () => {
    for (const relativePath of [
      'skills/skills.json',
      'tooling/workflows.json',
      'tooling/dev-tool-manifest.json',
      'manifests/tool.manifest.json',
      'manifests/workflow-bundles.json',
      'src/generated/workspace.d.ts',
    ]) {
      const generated = source(relativePath);
      expect(generated, relativePath).not.toMatch(/\boffice\b/i);
      expect(generated, relativePath).not.toContain('design.publish');
    }

    expect(source('tooling/workflows.json')).toContain('"id": "artifacts"');
    expect(source('tooling/dev-tool-manifest.json')).toContain('"name": "artifacts.publish"');
    expect(source('skills/skills.json')).toContain('"name": "artifacts"');
  });

  it('limits legacy URL compatibility to explicit edge-only redirects', () => {
    const routeSeed = source('scripts/lib/workspace-edge-route-seed.ts');
    expect(routeSeed.match(/pathPrefix: '\/office'/g)).toHaveLength(1);
    expect(routeSeed.match(/pathPrefix: '\/design-wiki'/g)).toHaveLength(1);
    expect(routeSeed).toContain("target: { kind: 'redirect', location: '/artifacts', statusCode: 308 }");
    expect(routeSeed).not.toContain("siteId: 'office'");
    expect(routeSeed).not.toContain("gatewayRouteFamily: '/gateway/office/*'");
  });

  it('removes workspace and root artifact publishing fallbacks', () => {
    expect(existsSync(resolve(repoRoot, 'packages/workspace/scripts/office.ts'))).toBe(false);
    expect(existsSync(resolve(repoRoot, 'packages/workspace/tests/office-theme.test.js'))).toBe(false);
    expect(existsSync(resolve(repoRoot, 'packages/consuelo-design/scripts/consuelo-design.ts'))).toBe(false);

    for (const relativePath of [
      'packages/workspace/tooling/tool-manifest.json',
      'packages/workspace/tooling/workflows.json',
      'packages/workspace/manifests/tool-manifest.json',
      'packages/workspace/manifests/workflow-bundles.json',
      'packages/workspace/src/generated/workspace.d.ts',
    ]) {
      const generated = repoSource(relativePath);
      expect(generated, relativePath).not.toMatch(/\boffice\b/i);
      expect(generated, relativePath).not.toContain('design.publish');
      expect(generated, relativePath).not.toContain('design.refresh');
    }

    const workspacePackage = JSON.parse(repoSource('packages/workspace/package.json')) as {
      scripts: Record<string, string>;
    };
    expect(workspacePackage.scripts.office).toBeUndefined();
    expect(workspacePackage.scripts['consuelo-design']).toBeUndefined();

    const rootPackage = JSON.parse(repoSource('package.json')) as {
      scripts: Record<string, string>;
    };
    expect(rootPackage.scripts['consuelo-design']).toBeUndefined();
    expect(rootPackage.scripts['wiki:render']).toBeUndefined();
    expect(rootPackage.scripts['wiki:validate']).toBeUndefined();

    const designPackage = JSON.parse(repoSource('packages/consuelo-design/package.json')) as {
      bin?: unknown;
      scripts: Record<string, string>;
    };
    expect(designPackage.bin).toBeUndefined();
    expect(designPackage.scripts).toEqual({
      'artifact:render': 'bun ./scripts/render-consuelo-reader.ts',
      'artifact:validate': 'bun ./scripts/validate-consuelo-reader.ts',
      'test:reader': 'bun test ./scripts/render-consuelo-reader.test.ts',
    });
  });
});
