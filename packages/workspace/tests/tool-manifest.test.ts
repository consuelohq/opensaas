import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildWorkspaceToolManifest, generateWorkspaceToolManifest } from '../scripts/generate-tool-manifest';

type JsonObject = Record<string, unknown>;

const packageRoot = join(import.meta.dirname, '..');
const osCoreManifestPath = join(packageRoot, '..', 'os', 'manifests', 'core.manifest.json');
const intentDescription = 'Start a task workflow for scoped write access. It included progressively disclosed tools, workflow hooks, validation steps, and rules that preserve user safety and alignment.';
const removedCoreToolNames = [
  'fs.list',
  'fs.write',
  'gh',
  'decideNext',
  'exploit',
  'confidenceScore',
  'confirm',
  'context.list',
  'context.categories',
  'audit',
  'doctor',
  'status',
  'mac.read',
  'mac.write',
  'mac.search',
  'mac.list',
  'mac.port',
  'mac.process',
  'fs.read',
  'fs.search',
  'tmp',
  'git.diff',
  'git.status',
  'stream.list',
  'checkFiles',
  'verify',
] as const;

const retainedCoreToolNames = [
  'batch',
  'code.call',
  'code.run',
  'context.find',
  'context.get',
  'context.save',
  'context.search',
  'context.trace',
  'explore',
  'fs.apply_patch',
  'fs.trash',
  'github',
  'intent',
  'review.run',
  'stream.context',
  'stream.sync',
  'tools.search',
] as const;

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

function repoRelative(filePath: string): string {
  return relative(join(packageRoot, '..', '..'), filePath).split(/[/\\]/).join('/');
}

describe('workspace tool manifest generator', () => {
  it('preserves every workspace tool in the generated full manifest', () => {
    const sourceEntries = readJsonArray('tooling/tool-manifest.json');
    const registry = buildWorkspaceToolManifest({ write: false });

    expect(registry.full.kind).toBe('consuelo-workspace-tool-manifest');
    expect(names(registry.full.tools)).toEqual(sourceEntries.map((entry) => String(entry.name)).sort());
    expect(registry.full.tools).toHaveLength(sourceEntries.length);
    expect(names(registry.full.tools)).toContain('batch');
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
    expect(coreNames).toHaveLength(retainedCoreToolNames.length);
    for (const toolName of retainedCoreToolNames) {
      expect(coreNames).toContain(toolName);
    }
    for (const toolName of removedCoreToolNames) {
      expect(coreNames).not.toContain(toolName);
    }
    expect(coreNames.some((name) => name.startsWith('task.'))).toBe(false);
    expect(coreNames).not.toContain('linear.issue');
    expect(coreNames).not.toContain('sentry.issues');
  });

  it('uses the scoped workflow description for the intent tool', () => {
    const registry = buildWorkspaceToolManifest({ write: false });
    const fullIntent = registry.full.tools.find((entry) => entry.name === 'intent');
    const coreIntent = registry.core.tools.find((entry) => entry.name === 'intent');

    expect(fullIntent?.description).toBe(intentDescription);
    expect(fullIntent?.definition.description).toBe(intentDescription);
    expect(coreIntent?.description).toBe(intentDescription);
    expect(coreIntent?.definition.description).toBe(intentDescription);
  });

  it('writes full and core manifests to override output paths', () => {
    const fullOutputPath = join(fixtureRoot, 'tool-manifest.json');
    const coreOutputPath = join(fixtureRoot, 'core-manifest.json');
    const workflowsOutputPath = join(fixtureRoot, 'workflow-bundles.json');
    const expectedSourceManifest = repoRelative(fullOutputPath);

    const built = buildWorkspaceToolManifest({ fullOutputPath, coreOutputPath });
    expect(built.workflows.sourceManifest).toBe(expectedSourceManifest);

    generateWorkspaceToolManifest({ fullOutputPath, coreOutputPath, workflowsOutputPath });

    const full = JSON.parse(readFileSync(fullOutputPath, 'utf8')) as { tools: JsonObject[] };
    const core = JSON.parse(readFileSync(coreOutputPath, 'utf8')) as { tools: JsonObject[] };
    const workflows = JSON.parse(readFileSync(workflowsOutputPath, 'utf8')) as { sourceManifest: string };

    expect(full.tools.length).toBeGreaterThan(0);
    expect(full.tools.map((tool) => tool.name)).toContain('code.call');
    expect(core.tools.length).toBeGreaterThan(0);
    expect(core.tools.length).toBeLessThan(full.tools.length);
    expect(core.tools.map((tool) => tool.name)).toContain('tools.search');
    expect(workflows.sourceManifest).toBe(expectedSourceManifest);
  });
});
