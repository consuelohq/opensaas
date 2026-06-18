import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildWorkspaceToolManifest, generateWorkspaceToolManifest } from '../scripts/generate-tool-manifest';

type JsonObject = Record<string, unknown>;

const packageRoot = join(import.meta.dirname, '..');
const osCoreManifestPath = join(packageRoot, '..', 'os', 'manifests', 'core.manifest.json');
const expectedCodeCallDescription = "Run focused repo-scoped Python, Bun, or Bash programs where runtime output is the evidence: tests, package scripts, typechecks, syntax checks, exact CLI reproduction, small diagnostics, and bounded data shaping inside the active task worktree. Prefer compact packets with paths, line spans, and extracted snippets over raw file dumps.";

const expectedDescriptions = {
  'code.call': expectedCodeCallDescription,
  explore: 'a repo-aware decision search tool for coding agents. It answers where to spend attention and what files or paths are likely relevant to a given request.',
  'fs.trash': 'An agent safe file deletion path. Prefered over rm rf',
  intent: 'Start a task workflow for scoped write access. It dispatches progressively disclosed tools, workflow hooks, validation steps, and rules that preserve user safety and alignment.',
} as const;
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
  'git.diff',
  'git.status',
  'stream.list',
  'checkFiles',
  'verify',
] as const;

const oldContextToolNames = [
  'context.categories',
  'context.find',
  'context.get',
  'context.list',
  'context.save',
  'context.search',
  'context.trace',
] as const;

const retainedCoreToolNames = [
  'batch',
  'code.call',
  'code.run',
  'context',
  'explore',
  'fs.apply_patch',
  'fs.trash',
  'github',
  'intent',
  'review.run',
  'stream.context',
  'stream.sync',
  'tmp',
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


function assertStrongCodeCallExamples(codeCall: JsonObject | undefined): void {
  const definition = codeCall?.definition as JsonObject | undefined;
  const exampleInput = definition?.exampleInput as JsonObject | undefined;
  const examples = definition?.examples;
  const exampleArray = Array.isArray(examples) ? examples as JsonObject[] : [];
  const labels = exampleArray.map((example) => String(example.label));
  const inputs = [exampleInput, ...exampleArray.map((example) => example.input as JsonObject | undefined)].filter(Boolean) as JsonObject[];
  const inputText = JSON.stringify(inputs);

  expect(labels).toEqual([
    'multi-package focused test packet',
    'manifest docs and types generation packet',
    'exact manifest description verification',
    'structured repo read and compare packet',
    'task-scoped structured file rewrite',
    'targeted Python file transformation',
  ]);
  expect(inputs.map((input) => input.language)).toEqual(expect.arrayContaining(['bun', 'python']));
  expect(inputs.map((input) => input.mode)).toEqual(expect.arrayContaining(['read', 'edit', 'verify']));
  expect(inputText).toContain('results');
  expect(inputText).toContain('Bun.spawnSync');
  expect(inputText).toContain('lineSpans');
  expect(inputText).toContain('snippets');
  expect(inputText).toContain('generate-tool-manifest');
  expect(inputText).toContain('await Bun.write');
  expect(inputText).toContain('from pathlib import Path');
  expect(inputText).not.toContain('print(\"hello\")');
  for (const input of inputs) {
    if (input.language === 'bash') {
      expect(String(input.code)).not.toMatch(/\bbun\b|\bpython\b|\bnode\b/);
    }
  }
}

describe('workspace tool manifest generator', () => {
  it('preserves every workspace tool in the generated full manifest', () => {
    const sourceEntries = readJsonArray('tooling/tool-manifest.json');
    const registry = buildWorkspaceToolManifest({ write: false });

    expect(registry.full.kind).toBe('consuelo-workspace-tool-manifest');
    expect(names(registry.full.tools)).toEqual(sourceEntries.map((entry) => String(entry.name)).sort());
    expect(registry.full.tools).toHaveLength(sourceEntries.length);
    expect(names(registry.full.tools)).toContain('batch');
    expect(names(registry.full.tools)).toContain('context');
    for (const toolName of oldContextToolNames) {
      expect(names(registry.full.tools)).not.toContain(toolName);
    }
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
    for (const toolName of oldContextToolNames) {
      expect(coreNames).not.toContain(toolName);
    }
    expect(coreNames).not.toContain('linear.issue');
    expect(coreNames).not.toContain('sentry.issues');
  });

  it("uses Ko's core tool descriptions in full and core manifests", () => {
    const registry = buildWorkspaceToolManifest({ write: false });

    for (const [toolName, description] of Object.entries(expectedDescriptions)) {
      const fullTool = registry.full.tools.find((entry) => entry.name === toolName);
      const coreTool = registry.core.tools.find((entry) => entry.name === toolName);

      expect(fullTool?.description).toBe(description);
      expect(fullTool?.definition.description).toBe(description);
      expect(coreTool?.description).toBe(description);
      expect(coreTool?.definition.description).toBe(description);
    }
  });

  it('keeps code.call compact packet example in generated source surfaces', () => {
    const registry = buildWorkspaceToolManifest({ write: false });
    const codeCall = registry.core.tools.find((entry) => entry.name === 'code.call');

    expect(JSON.stringify(codeCall?.definition.exampleInput)).toContain('snippets');
    expect(JSON.stringify(codeCall?.definition.exampleInput)).toContain('lineSpans');
  });

  it('keeps code.call examples strong and aligned', () => {
    const registry = buildWorkspaceToolManifest({ write: false });
    const codeCall = registry.core.tools.find((entry) => entry.name === 'code.call');
    assertStrongCodeCallExamples(codeCall as JsonObject | undefined);
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
