import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildWorkspaceToolManifest, generateWorkspaceToolManifest } from '../scripts/generate-tool-manifest';
import { getInputSchema, schemaTypeSignatures } from '../scripts/lib/facade/schemas';

type JsonObject = Record<string, unknown>;

const packageRoot = join(import.meta.dirname, '..');
const osCoreManifestPath = join(packageRoot, '..', 'os', 'manifests', 'generated', 'core.manifest.json');
const expectedCodeCallDescription = "Run focused repo-scoped Python, Bun, or Bash programs where runtime output is the evidence: tests, package scripts, typechecks, syntax checks, exact CLI reproduction, small diagnostics, and bounded data shaping inside the active task worktree. Prefer compact packets with paths, line spans, and extracted snippets over raw file dumps.";

const expectedDescriptions = {
  'code.call': expectedCodeCallDescription,
  explore: 'a repo-aware decision search tool for coding agents. It answers where to spend attention and what files or paths are likely relevant to a given request.',
  'fs.trash': 'An agent safe file deletion path. Prefered over rm rf',
  'task.start': "Call this directly at the beginning of every scoped repo task, before tools.search or any search for task-start tooling. It creates the task branch, worktree, task PR, and real taskSession, then returns the selected workflow bundle and post-start lifecycle guidance.",
} as const;
const removedCoreToolNames = [
  'fs.list',
  'fs.write',
  'gh',
  'decideNext',
  'exploit',
  'confidenceScore',
  'confirm',
  'code.run',
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

const workspaceOnlyCoreToolNames = ['context'] as const;

const retainedCoreToolNames = [
  'batch',
  'code.call',
  'context',
  'explore',
  'fs.apply_patch',
  'fs.trash',
  'github',
  'task.start',
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
  const repoRoot = join(packageRoot, '..', '..');
  const exampleSource = inputs
    .map((input) => String(input.codeFile ?? ''))
    .filter(Boolean)
    .map((codeFile) => readFileSync(join(repoRoot, codeFile), 'utf8'))
    .join('\n');

  expect(labels).toEqual([
    'multi-package focused test packet',
    'repository impact analysis packet',
    'exact manifest description verification',
    'structured repo read and compare packet',
    'task-scoped structured file rewrite',
    'Python AST/string-heavy test insertion',
    'Python test assertion audit packet',
  ]);
  expect(inputs.map((input) => input.language)).toEqual(expect.arrayContaining(['bun', 'python']));
  expect(inputs.map((input) => input.mode)).toEqual(expect.arrayContaining(['read', 'edit', 'verify']));
  for (const input of inputs) {
    expect(input.code).toBeUndefined();
    expect(String(input.codeFile)).toMatch(/^scripts\/code-call-examples\/.+\.(ts|py)$/);
    if (input.language === 'bash') {
      expect(String(input.codeFile)).not.toMatch(/\bbun\b|\bpython\b|\bnode\b/);
    }
  }
  expect(inputText).not.toContain('manifest docs and types generation packet');
  expect(exampleSource).toContain('tests/workflow-intent.test.ts');
  expect(exampleSource).toContain('tests/facade/facade.test.ts');
  expect(exampleSource).toContain('repositoryImpact');
  expect(exampleSource).toContain('lineSpans');
  expect(exampleSource).toContain('snippets');
  expect(exampleSource).toContain('Bun.spawnSync');
  expect(exampleSource).toContain('packages/os/tests/code-call-service-architecture.test.ts');
  expect(exampleSource).toContain('await Bun.write');
  expect(exampleSource).toContain('from pathlib import Path');
  expect(exampleSource).toContain('signatureAlgorithm');
  expect(exampleSource).toContain('assertionGroups');
  expect(exampleSource).not.toContain('generate-tool-manifest');
  expect(exampleSource).not.toContain('generate-types');
  expect(exampleSource).not.toContain('generate-docs');
  expect(exampleSource).not.toContain('print("hello")');
}

describe('workspace tool manifest generator', () => {
  it('preserves every workspace tool in the generated full manifest', () => {
    const sourceEntries = readJsonArray('tooling/tool-manifest.json');
    const registry = buildWorkspaceToolManifest({ write: false });

    expect(registry.full.kind).toBe('consuelo-workspace-tool-manifest');
    expect(names(registry.full.tools)).toEqual(sourceEntries.map((entry) => String(entry.name)).sort());
    expect(registry.full.tools).toHaveLength(sourceEntries.length);
    expect(names(registry.full.tools)).toContain('batch');
    expect(names(registry.full.tools)).toContain('code.run');
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
    const expectedCoreNames = [
      ...osCore.tools
        .map((tool) => tool.name)
        .filter((name) => workspaceNames.has(name)),
      ...workspaceOnlyCoreToolNames,
    ].sort();

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
    expect(coreNames.filter((name) => name.startsWith('task.'))).toEqual(['task.start']);
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
    const exampleInput = codeCall?.definition.exampleInput as JsonObject | undefined;
    const codeFile = String(exampleInput?.codeFile ?? '');
    const source = readFileSync(join(packageRoot, '..', '..', codeFile), 'utf8');

    expect(codeFile).toBe('scripts/code-call-examples/structured-snippet-read.ts');
    expect(source).toContain('snippets');
    expect(source).toContain('lineSpans');
  });

  it('keeps code.call examples strong and aligned', () => {
    const registry = buildWorkspaceToolManifest({ write: false });
    const codeCall = registry.core.tools.find((entry) => entry.name === 'code.call');
    assertStrongCodeCallExamples(codeCall as JsonObject | undefined);
  });

  it('keeps every read-only fs tool task-session optional and every fs mutator task-scoped', () => {
    const registry = buildWorkspaceToolManifest({ write: false });
    const fsEntries = registry.full.tools.filter((entry) => entry.name.startsWith('fs.'));
    const readOnlyEntries = fsEntries.filter((entry) => entry.definition.capabilities.readOnly === true);
    const mutatingEntries = fsEntries.filter((entry) => entry.definition.capabilities.mutating === true);

    expect(readOnlyEntries.map((entry) => entry.name).sort()).toEqual(['fs.list', 'fs.read', 'fs.search']);
    expect(mutatingEntries.map((entry) => entry.name).sort()).toEqual(['fs.apply_patch', 'fs.trash', 'fs.write']);

    for (const entry of readOnlyEntries) {
      expect(entry.definition.sessionRequired).toBe(false);
      expect(entry.definition.command.branchMode).toBe('optional');
    }

    for (const entry of mutatingEntries) {
      expect(entry.definition.sessionRequired).toBe(true);
      expect(entry.definition.command.branchMode).toBe('required');
    }
  });

  it('should keep task.pr command metadata aligned when the CLI exposes the workpad escape hatch', () => {
    // Arrange
    const schema = getInputSchema('TaskPrInput');
    const registry = buildWorkspaceToolManifest({ write: false });
    const taskPr = registry.full.tools.find((entry) => entry.name === 'task.pr');
    const generatedTypes = readFileSync(join(packageRoot, 'src/generated/workspace.d.ts'), 'utf8');

    // Act
    const parsed = schema?.safeParse({ ackWorkpadIncomplete: true });
    const command = taskPr?.definition.command;

    // Assert
    expect(parsed?.success).toBe(true);
    if (!parsed?.success) throw new Error('TaskPrInput should parse the workpad escape hatch');
    expect(parsed.data).toEqual(expect.objectContaining({ ackWorkpadIncomplete: true }));
    expect(schemaTypeSignatures.TaskPrInput).toContain('ackWorkpadIncomplete?: boolean');
    expect(generatedTypes).toContain('ackWorkpadIncomplete?: boolean');
    expect(command).toMatchObject({ script: 'task:pr' });
    expect(command?.arguments).toContainEqual({
      source: 'ackWorkpadIncomplete',
      flag: '--ack-workpad-incomplete',
      kind: 'boolean',
    });
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
