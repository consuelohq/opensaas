import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildWorkspaceToolManifest, generateWorkspaceToolManifest } from '../scripts/generate-tool-manifest';

type JsonObject = Record<string, unknown>;

const packageRoot = join(import.meta.dirname, '..');
const osCoreManifestPath = join(packageRoot, '..', 'os', 'manifests', 'core.manifest.json');

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'consuelo-workspace-tool-manifest-'));
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function readJsonArray(relativePath: string): JsonObject[] {
  const parsed = JSON.parse(readFileSync(join(packageRoot, relativePath), 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${relativePath}: expected array`);
  return parsed as JsonObject[];
}

function names(entries: Array<{ name: string }>): string[] {
  return entries.map((entry) => entry.name).sort();
}

describe('workspace tool manifest generator', () => {
  it('preserves every workspace tool in the generated full manifest', () => {
    const sourceEntries = readJsonArray('tooling/tool-manifest.json');
    const registry = buildWorkspaceToolManifest({ write: false });

    expect(registry.full.kind).toBe('consuelo-workspace-tool-manifest');
    expect(names(registry.full.tools)).toEqual(sourceEntries.map((entry) => String(entry.name)).sort());
    expect(registry.full.tools).toHaveLength(sourceEntries.length);
    expect(registry.report.fullToolCount).toBe(sourceEntries.length);
    expect(registry.report.duplicateNames).toEqual([]);
  });

  it('derives core from the OS core-equivalent config while omitting unavailable tools', () => {
    const osCore = JSON.parse(readFileSync(osCoreManifestPath, 'utf8')) as { tools: Array<{ name: string }> };
    const workspaceSource = readJsonArray('tooling/tool-manifest.json');
    const workspaceNames = new Set(workspaceSource.map((entry) => String(entry.name)));
    const expectedCoreNames = osCore.tools
      .map((tool) => tool.name)
      .filter((name) => workspaceNames.has(name))
      .sort();

    const registry = buildWorkspaceToolManifest({ write: false });
    const coreNames = names(registry.core.tools);

    expect(registry.core.kind).toBe('consuelo-workspace-core-manifest');
    expect(registry.coreOutputPath.endsWith('packages/workspace/manifests/core-manifest.json')).toBe(true);
    expect(coreNames).toEqual(expectedCoreNames);
    expect(coreNames).toContain('fs.read');
    expect(coreNames).toContain('task.start');
    expect(coreNames).toContain('stream.context');
    expect(coreNames).toContain('tools.search');
    expect(coreNames).toContain('code.call');
    expect(coreNames).toContain('intent');
    expect(coreNames).not.toContain('linear.issue');
    expect(coreNames).not.toContain('sentry.issues');
  });

  it('writes full and core manifests to override output paths', () => {
    const fullOutputPath = join(fixtureRoot, 'tool-manifest.json');
    const coreOutputPath = join(fixtureRoot, 'core-manifest.json');

    generateWorkspaceToolManifest({ fullOutputPath, coreOutputPath });

    const full = JSON.parse(readFileSync(fullOutputPath, 'utf8')) as { tools: JsonObject[] };
    const core = JSON.parse(readFileSync(coreOutputPath, 'utf8')) as { tools: JsonObject[] };

    expect(full.tools.length).toBeGreaterThan(0);
    expect(full.tools.map((tool) => tool.name)).toContain('code.call');
    expect(core.tools.length).toBeGreaterThan(0);
    expect(core.tools.length).toBeLessThan(full.tools.length);
    expect(core.tools.map((tool) => tool.name)).toContain('tools.search');
  });
});
