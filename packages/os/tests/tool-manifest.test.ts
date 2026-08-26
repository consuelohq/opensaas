import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildToolManifest, generateToolManifest } from '../scripts/generate-tool-manifest';
import { getInputSchema, outputTypeSignatures, schemaTypeSignatures } from '../scripts/lib/facade/schemas';
import { runToolSearch } from '../scripts/tools-search';

type JsonObject = Record<string, unknown>;

type SearchMatch = {
  name: string;
};

type SearchResult = {
  matches?: SearchMatch[];
  catalog?: {
    source?: string[];
    toolCount?: number;
  };
};

const packageRoot = join(import.meta.dirname, '..');
const baselineDefinitions = (JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/tool-package-baseline.json'), 'utf8')) as { definitions: JsonObject[] }).definitions;
const expectedCodeCallDescription = "Run focused Python, Bun, or Bash programs where runtime output is the evidence. Use taskSession for edits inside Consuelo-managed repositories and workSession for scoped edits in ordinary folders on the owning node. Work-session execution is write-contained to its persisted session path on supported nodes and rejects managed repos/worktrees; mac.call remains the emergency host escape hatch. Prefer compact packets with paths, line spans, and extracted snippets over raw file dumps.";

const expectedDescriptions = {
  'code.call': expectedCodeCallDescription,
  explore: 'a repo-aware decision search tool for coding agents. It answers where to spend attention and what files or paths are likely relevant to a given request.',
  'fs.trash': 'move files to trash inside an authorized task worktree or work-session directory',
  'session.start': 'Canonical session constructor. Use kind=task for managed repo work that needs a branch/worktree/PR, or kind=work for scoped ordinary filesystem work on the owning node.',
  'task.start': 'Compatibility alias for session.start({ kind: \"task\" }). Existing callers remain supported; new agents should prefer session.start for task creation.',
} as const;
const removedCoreToolNames = [
  'context',
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

const retainedCoreToolNames = [
  'batch',
  'code.call',
  'memory',
  'explore',
  'fs.apply_patch',
  'fs.trash',
  'github',
  'google',
  'session.start',
  'task.start',
  'review.run',
  'stream.context',
  'stream.sync',
  'tmp',
  'tools.search',
] as const;

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'consuelo-os-tool-manifest-'));
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function readJsonArray(relativePath: string): JsonObject[] {
  const parsed = JSON.parse(readFileSync(join(packageRoot, relativePath), 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${relativePath}: expected array`);
  return parsed as JsonObject[];
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function repoRelative(filePath: string): string {
  return relative(join(packageRoot, '..', '..'), filePath).split(/[/\\]/).join('/');
}

function osSkillEntry(name: string): JsonObject {
  return {
    name,
    title: name,
    description: `${name} description`,
    permission: 'read',
    requiresApproval: false,
    writesRecords: false,
    externalSideEffects: false,
    implementation: { script: `scripts/${name}.ts` },
  };
}

function facadeToolEntry(name: string): JsonObject {
  return {
    name,
    methodPath: [name],
    description: `${name} facade description`,
    category: 'test',
    underlying: name,
    capabilities: {
      readOnly: true,
      mutating: false,
      deterministic: true,
      safeToRetry: true,
    },
    defaultTimeout: 30000,
    inputSchema: 'EmptyInput',
    outputSchema: 'RawOutput',
    command: {
      script: name,
      branchMode: 'none',
      arguments: [],
    },
    exampleInput: {},
  };
}

function writeFixtureConfig(regularManifestPath: string, devToolManifestPath: string): string {
  const configPath = join(fixtureRoot, 'manifest.config.json');
  writeJson(configPath, {
    version: 1,
    sources: [
      { label: 'regular', kind: 'os-skill', path: regularManifestPath },
      { label: 'dev-tooling', kind: 'facade-tool', path: devToolManifestPath },
    ],
    outputs: {
      full: join(fixtureRoot, 'tool.manifest.json'),
      core: join(fixtureRoot, 'core.manifest.json'),
    },
    core: {
      includeNames: ['fixture-core'],
      includePrefixes: [],
      excludeNames: [],
      excludePrefixes: [],
      excludeCategories: [],
    },
  });
  return configPath;
}

function publicSurfaceText(): string {
  const publicFiles = [
    'manifests/generated/tool.manifest.json',
    'manifests/generated/core.manifest.json',
    'workflows/generated/workflow-bundles.json',
    'TOOLS.md',
    'src/generated/workspace.d.ts',
    'src/generated/tool-client.ts',
    'package.json',
  ];
  return publicFiles
    .map((relativePath) => readFileSync(join(packageRoot, relativePath), 'utf8'))
    .join('\n');
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

describe('tool manifest generator', () => {
  it('preserves every characterized active package definition in the generated full manifest', () => {
    const registry = buildToolManifest({ write: false });
    const generatedDefinitions = registry.full.tools.map((entry) => entry.definition);
    expect(generatedDefinitions).toEqual(baselineDefinitions);
    expect(registry.full.tools).toHaveLength(baselineDefinitions.length);
    expect(registry.report.oldRegularToolCount).toBe(0);
    expect(registry.report.oldDevToolCount).toBe(baselineDefinitions.length);
    expect(registry.report.duplicateNames).toEqual([]);
    expect(registry.full.tools.map((entry) => entry.name)).toEqual(expect.arrayContaining(['batch', 'code.run', 'google', 'media.svg.convert']));
    expect(registry.full.tools.every((entry) => entry.kind === 'facade-tool')).toBe(true);
    expect(registry.full.tools.every((entry) => entry.sourcePath.startsWith('packages/os/tools/'))).toBe(true);
  });

  it('derives core from config and excludes non-core provider families', () => {
    const registry = buildToolManifest({ write: false });
    const coreNames = registry.core.tools.map((entry) => entry.name).sort();

    expect(coreNames).toHaveLength(retainedCoreToolNames.length);
    for (const toolName of retainedCoreToolNames) {
      expect(coreNames).toContain(toolName);
    }
    for (const toolName of removedCoreToolNames) {
      expect(coreNames).not.toContain(toolName);
    }
    expect(coreNames).not.toContain('mac.call');
    expect(coreNames).not.toContain('mac.exec');
    expect(coreNames.filter((name) => name.startsWith('task.'))).toEqual(['task.start']);

    for (const toolName of oldContextToolNames) {
      expect(coreNames).not.toContain(toolName);
    }
    expect(coreNames).not.toContain('linear.issue');
    expect(coreNames).not.toContain('sentry.issues');
    expect(coreNames).not.toContain('deployment.logs');
    expect(coreNames).not.toContain('website.deploy');
    expect(coreNames).not.toContain('browser.open');
    expect(coreNames).not.toContain('design.publish');
    expect(coreNames).not.toContain('office.generateWebsite');  });



  it('should model read-only fs operations as session-optional when building manifests', () => {
    const registry = buildToolManifest({ write: false });
    const fsEntries = registry.full.tools.filter((entry) => entry.name.startsWith('fs.'));
    const readOnlyEntries = fsEntries.filter((entry) => entry.definition.capabilities.readOnly === true);
    const mutatingEntries = fsEntries.filter((entry) => entry.definition.capabilities.mutating === true);
    const byName = new Map(fsEntries.map((entry) => [entry.name, entry]));

    expect(readOnlyEntries.map((entry) => entry.name).sort()).toEqual(['fs.list', 'fs.read', 'fs.search']);
    expect(mutatingEntries.map((entry) => entry.name).sort()).toEqual(['fs.apply_patch', 'fs.trash', 'fs.write']);

    for (const entry of readOnlyEntries) {
      expect(entry.definition.capabilities).toMatchObject({ readOnly: true, mutating: false });
      expect(entry.definition.command).toMatchObject({ script: 'task:fs', branchMode: 'optional' });
      expect(entry.definition.sessionRequired).toBe(false);
    }

    expect(byName.get('fs.read')?.definition.command.arguments).toContainEqual({ source: 'full', flag: '--full', kind: 'boolean' });

    for (const entry of mutatingEntries) {
      expect(entry.definition.capabilities).toMatchObject({ readOnly: false, mutating: true });
      expect(entry.definition.command).toMatchObject({ script: 'task:fs', branchMode: 'required' });
      expect(entry.definition.sessionRequired).toBe(true);
    }
  });

  it('keeps public execution surface on code.call while task lifecycle stays full-manifest only', async () => {
    const registry = buildToolManifest({ write: false });
    const fullNames = registry.full.tools.map((entry) => entry.name);
    const coreNames = registry.core.tools.map((entry) => entry.name);
    const lifecycleTools = ['task.current', 'task.push', 'task.pr', 'task.finish'];
    const codeCallEntry = registry.core.tools.find((entry) => entry.name === 'code.call');
    const macCallEntry = registry.full.tools.find((entry) => entry.name === 'mac.call');

    expect(fullNames).toContain('code.call');
    expect(coreNames).toContain('code.call');
    expect(coreNames).toContain('task.start');
    expect(coreNames).not.toContain('task.intent');
    expect(coreNames).not.toContain('mac.call');
    expect(coreNames).not.toContain('mac.exec');
    for (const toolName of lifecycleTools) {
      expect(fullNames).toContain(toolName);
      expect(coreNames).not.toContain(toolName);
    }
    expect(coreNames.filter((name) => name.startsWith('task.'))).toEqual(['task.start']);
    expect(fullNames).not.toContain(`task.${'call'}`);
    expect(fullNames).not.toContain(`task.${'exec'}`);
    expect(coreNames).not.toContain(`task.${'call'}`);
    expect(coreNames).not.toContain(`task.${'exec'}`);

    const publicText = publicSurfaceText();
    expect(publicText).not.toContain(`task.${'call'}`);
    expect(publicText).not.toContain(`task.${'exec'}`);
    expect(publicText).not.toContain(`task:${'exec'}`);
    expect(publicText).toContain('code.call');
    expect(publicText).toContain('Do not use `mac.call` for repo-scoped tests');

    expect(codeCallEntry?.description).toBe(expectedCodeCallDescription);
    expect(codeCallEntry?.description).toContain('runtime output is the evidence');
    expect(codeCallEntry?.description).toContain('compact packets');
    const exampleInput = codeCallEntry?.definition.exampleInput as JsonObject | undefined;
    const codeFile = String(exampleInput?.codeFile ?? '');
    const source = readFileSync(join(packageRoot, '..', '..', codeFile), 'utf8');
    expect(codeFile).toBe('scripts/code-call-examples/structured-snippet-read.ts');
    expect(source).toContain('snippets');
    expect(source).toContain('lineSpans');
    expect(macCallEntry?.description).toContain('emergency host escape hatch');
    expect(macCallEntry?.description).toContain('Do not use `mac.call` for repo-scoped tests');

    const taskCallSearch = await runToolSearch({ query: `task.${'call'}`, limit: 10, includeDocs: false, includeEmbeddings: false }) as SearchResult;
    const taskExecSearch = await runToolSearch({ query: `task.${'exec'}`, limit: 10, includeDocs: false, includeEmbeddings: false }) as SearchResult;

    expect(taskCallSearch.matches?.map((match) => match.name)).not.toContain(`task.${'call'}`);
    expect(taskExecSearch.matches?.map((match) => match.name)).not.toContain(`task.${'exec'}`);
  });

  it('should keep task.pr facade input and command mapping aligned when the CLI exposes the workpad escape hatch', () => {
    // Arrange
    const schema = getInputSchema('TaskPrInput');
    const registry = buildToolManifest({ write: false });
    const taskPr = registry.full.tools.find((entry) => entry.name === 'task.pr');
    const generatedTypes = readFileSync(join(import.meta.dirname, '../src/generated/workspace.d.ts'), 'utf8');
    const taskPrSource = readFileSync(join(packageRoot, 'scripts/task-pr.js'), 'utf8');

    // Act
    const parsed = schema.safeParse({ ackWorkpadIncomplete: true, repo: 'example/private-repo' });
    const argumentsList = taskPr?.definition.command?.arguments;
    const cli = spawnSync(process.execPath, [join(packageRoot, 'scripts/task-pr.js'), '--ack-workpad-incomplete', '--help'], {
      cwd: packageRoot,
      encoding: 'utf8',
    });

    // Assert
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error('TaskPrInput should parse the workpad escape hatch');
    expect(parsed.data).toEqual(expect.objectContaining({ ackWorkpadIncomplete: true, repo: 'example/private-repo' }));
    expect(schemaTypeSignatures.TaskPrInput).toContain('ackWorkpadIncomplete?: boolean');
    expect(schemaTypeSignatures.TaskPrInput).toContain('repo?: string');
    expect(generatedTypes).toContain('ackWorkpadIncomplete?: boolean');
    expect(generatedTypes).toContain('repo?: string');
    expect(argumentsList).toContainEqual({
      source: 'ackWorkpadIncomplete',
      flag: '--ack-workpad-incomplete',
      kind: 'boolean',
    });
    expect(argumentsList).toContainEqual({
      source: 'repo',
      flag: '--repo',
      kind: 'value',
    });
    expect(cli.status).toBe(0);
    expect(cli.stdout).toContain('--ack-workpad-incomplete');
    expect(taskPrSource).toContain("const { assertWorkpadReady } = require('./lib/task-workpad');");
    expect(taskPrSource).toContain('ackIncomplete: args.ackWorkpadIncomplete');
  });

  it('keeps OS task start wired to the OS runtime surface', () => {
    const registry = buildToolManifest({ write: false });
    const startEntry = registry.full.tools.find((entry) => entry.name === 'task.start');

    expect(startEntry?.definition.underlying).toBe('os task.start');
    expect(registry.full.tools.map((entry) => entry.name)).not.toContain('task.intent');
  });

  it("uses Ko's core tool descriptions in full and core manifests", () => {
    const registry = buildToolManifest({ write: false });

    for (const [toolName, description] of Object.entries(expectedDescriptions)) {
      const fullTool = registry.full.tools.find((entry) => entry.name === toolName);
      const coreTool = registry.core.tools.find((entry) => entry.name === toolName);

      expect(fullTool?.description).toBe(description);
      expect(fullTool?.definition.description).toBe(description);
      expect(coreTool?.description).toBe(description);
      expect(coreTool?.definition.description).toBe(description);
    }
  });

  it('should expose fs.apply_patch only when building OS manifest surfaces', () => {
    const registry = buildToolManifest({ write: false });
    const fullNames = registry.full.tools.map((entry) => entry.name);
    const coreNames = registry.core.tools.map((entry) => entry.name);
    const fullEntry = registry.full.tools.find((entry) => entry.name === 'fs.apply_patch');
    const coreEntry = registry.core.tools.find((entry) => entry.name === 'fs.apply_patch');
    expect(fullNames).toContain('fs.apply_patch');
    expect(coreNames).toContain('fs.apply_patch');
    expect(fullNames).not.toContain('fs.patch');
    expect(coreNames).not.toContain('fs.patch');
    expect((fullEntry?.definition as JsonObject | undefined)?.inputSchema).toBe('FsApplyPatchInput');
    expect((coreEntry?.definition as JsonObject | undefined)?.inputSchema).toBe('FsApplyPatchInput');
  });

  it('should validate fs.apply_patch input when exactly one patch transport is provided', () => {
    const schema = getInputSchema('FsApplyPatchInput');

    expect(schema).not.toBeNull();
    expect(schema?.safeParse({ patchText: '*** Begin Patch\n*** End Patch' }).success).toBe(true);
    expect(schema?.safeParse({ patchFile: '/tmp/change.patch' }).success).toBe(true);
    expect(schema?.safeParse({ patchText: '*** Begin Patch\n*** End Patch', patchFile: '/tmp/change.patch' }).success).toBe(false);
    expect(schema?.safeParse({}).success).toBe(false);
    expect(schemaTypeSignatures.FsApplyPatchInput).toContain('patchText?: string');
    expect(schemaTypeSignatures.FsApplyPatchInput).toContain('patchFile?: string');
  });

  it('should expose fs.apply_patch when generating OS TypeScript surfaces', () => {
    const generatedWorkspace = readFileSync(join(packageRoot, 'src/generated/workspace.d.ts'), 'utf8');
    const generatedClient = readFileSync(join(packageRoot, 'src/generated/tool-client.ts'), 'utf8');

    expect(generatedWorkspace).toContain('apply_patch');
    expect(generatedWorkspace).toContain('patchText?: string');
    expect(generatedWorkspace).not.toContain('fs.patch');
    expect(generatedClient).toContain('createWorkspaceClient');
  });

  it('exposes subagent token usage in generated TypeScript surfaces', () => {
    const generatedWorkspace = readFileSync(join(packageRoot, 'src/generated/workspace.d.ts'), 'utf8');
    const expectedUsage = 'usage?: { inputTokens?: number; cachedInputTokens?: number; outputTokens?: number; reasoningOutputTokens?: number }';

    expect(outputTypeSignatures.SubagentOutput).toContain(expectedUsage);
    expect(generatedWorkspace).toContain(expectedUsage);
  });

  it('publishes one non-core provider-neutral deployment surface and generated client types', () => {
    const registry = buildToolManifest({ write: false });
    const fullNames = registry.full.tools.map((entry) => entry.name);
    const coreNames = registry.core.tools.map((entry) => entry.name);
    const deploymentNames = fullNames.filter((name) => name.startsWith('deployment.')).sort();
    const generatedWorkspace = readFileSync(join(packageRoot, 'src/generated/workspace.d.ts'), 'utf8');

    expect(deploymentNames).toEqual([
      'deployment.context',
      'deployment.deploy',
      'deployment.detect',
      'deployment.environment',
      'deployment.list',
      'deployment.logs',
      'deployment.raw',
      'deployment.status',
    ]);
    expect(coreNames.filter((name) => name.startsWith('deployment.'))).toEqual([]);
    expect(fullNames.filter((name) => /^(railway|vercel|cloudflare)\./.test(name))).toEqual([]);
    expect(registry.full.tools
      .filter((entry) => entry.name.startsWith('deployment.'))
      .every((entry) => entry.definition.command.internal === 'deployment')).toBe(true);
    expect(generatedWorkspace).toContain('deployment: {');
    expect(generatedWorkspace).toContain('provider: "railway" | "vercel" | "cloudflare"');
  });

  it('should expose runtime fs result envelopes when generating OS TypeScript surfaces', () => {
    const generatedWorkspace = readFileSync(join(packageRoot, 'src/generated/workspace.d.ts'), 'utf8');

    expect(generatedWorkspace).toContain('type: \"text-page\"');
    expect(generatedWorkspace).toContain('content: string');
    expect(generatedWorkspace).toContain('mime: string');
    expect(generatedWorkspace).toContain('type: \"binary\"');
    expect(generatedWorkspace).toContain('type: \"media\"');
    expect(generatedWorkspace).toContain('results: Array<{ path: string; ok: true; page:');
    expect(generatedWorkspace).toContain('type: \"search-results\"');
    expect(generatedWorkspace).toContain('matches: Array<{ type: \"match\"; path: string; line: number; text: string');
    expect(generatedWorkspace).not.toContain('Array<{ path: string; from: number; to: number; total: number; lines: string[] }>');
    expect(generatedWorkspace).not.toContain('Array<{ file: string; line: number; text: string }>');
  });

  it('keeps code.call examples strong and aligned', () => {
    const registry = buildToolManifest({ write: false });
    const codeCall = registry.core.tools.find((entry) => entry.name === 'code.call');
    assertStrongCodeCallExamples(codeCall as JsonObject | undefined);
  });

  it('writes full and core manifests to override output paths', () => {
    const fullOutputPath = join(fixtureRoot, 'tool.manifest.json');
    const coreOutputPath = join(fixtureRoot, 'core.manifest.json');
    const workflowsOutputPath = join(fixtureRoot, 'workflow-bundles.json');
    const expectedSourceManifest = repoRelative(fullOutputPath);

    const built = buildToolManifest({ fullOutputPath, coreOutputPath });
    expect(built.workflows.sourceManifest).toBe(expectedSourceManifest);

    generateToolManifest({ fullOutputPath, coreOutputPath, workflowsOutputPath });

    const full = JSON.parse(readFileSync(fullOutputPath, 'utf8')) as { tools: JsonObject[] };
    const core = JSON.parse(readFileSync(coreOutputPath, 'utf8')) as { tools: JsonObject[] };
    const workflows = JSON.parse(readFileSync(workflowsOutputPath, 'utf8')) as { sourceManifest: string };

    expect(full.tools.length).toBeGreaterThan(0);
    expect(full.tools.map((tool) => tool.name)).toContain('code.call');
    expect(core.tools.length).toBeGreaterThan(0);
    expect(core.tools.length).toBeLessThan(full.tools.length);
    expect(workflows.sourceManifest).toBe(expectedSourceManifest);
  });

  it('fails when source manifests contain duplicate names', () => {
    const regularManifestPath = join(fixtureRoot, 'regular.json');
    const devToolManifestPath = join(fixtureRoot, 'dev.json');
    writeJson(regularManifestPath, [osSkillEntry('duplicate')]);
    writeJson(devToolManifestPath, [facadeToolEntry('duplicate')]);
    const configPath = writeFixtureConfig(regularManifestPath, devToolManifestPath);

    expect(() => buildToolManifest({ configPath, write: false })).toThrow('duplicate tool name duplicate');
  });

  it('keeps the generated catalog limited to canonical facade packages', () => {
    const registry = buildToolManifest({ write: false });
    expect(registry.full.tools).toHaveLength(baselineDefinitions.length);
    expect(registry.full.tools.every((entry) => entry.kind === 'facade-tool')).toBe(true);
    expect(registry.full.tools.every((entry) => entry.sourcePath.startsWith('packages/os/tools/'))).toBe(true);
  });
});
