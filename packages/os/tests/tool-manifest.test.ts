import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildToolManifest, generateToolManifest } from '../scripts/generate-tool-manifest';
import { getInputSchema, schemaTypeSignatures } from '../scripts/lib/facade/schemas';
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
const expectedDescriptions = {
  'code.call': 'Run focused repo-scoped Python, Bun, or Bash programs where runtime output is the evidence: tests, package scripts, typechecks, syntax checks, exact CLI reproduction, small diagnostics, and bounded data shaping inside the active task worktree. Prefer compact packets with paths, line spans, and extracted snippets over raw file dumps.',
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
    'manifests/tool.manifest.json',
    'manifests/core.manifest.json',
    'manifests/workflow-bundles.json',
    'TOOLS.md',
    'src/generated/workspace.d.ts',
    'src/generated/tool-client.ts',
    'package.json',
  ];
  return publicFiles
    .map((relativePath) => readFileSync(join(packageRoot, relativePath), 'utf8'))
    .join('\n');
}

describe('tool manifest generator', () => {
  it('preserves every regular and dev manifest entry in the generated full manifest', () => {
    const regularEntries = readJsonArray('tooling/tool-manifest.json');
    const devEntries = readJsonArray('tooling/dev-tool-manifest.json');

    const registry = buildToolManifest({ write: false });
    const generatedNames = registry.full.tools.map((entry) => entry.name).sort();
    const expectedNames = Array.from(new Set([
      ...regularEntries.map((entry) => String(entry.name)),
      ...devEntries.map((entry) => String(entry.name)),
    ])).sort();

    expect(generatedNames).toEqual(expectedNames);
    expect(generatedNames).toContain('batch');
    expect(registry.full.tools).toHaveLength(expectedNames.length);
    expect(registry.report.oldRegularToolCount).toBe(regularEntries.length);
    expect(registry.report.oldDevToolCount).toBe(devEntries.length);
    expect(registry.report.duplicateNames).toEqual([]);

    for (const original of regularEntries) {
      const generated = registry.full.tools.find((entry) => entry.name === original.name);
      expect(generated?.kind).toBe('os-skill');
      expect(generated?.definition).toEqual(original);
    }

    for (const original of devEntries) {
      const generated = registry.full.tools.find((entry) => entry.name === original.name);
      expect(generated?.kind).toBe('facade-tool');
      expect(generated?.definition).toEqual(original);
    }
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
    expect(coreNames.some((name) => name.startsWith('task.'))).toBe(false);

    for (const toolName of oldContextToolNames) {
      expect(coreNames).not.toContain(toolName);
    }
    expect(coreNames).not.toContain('linear.issue');
    expect(coreNames).not.toContain('sentry.issues');
    expect(coreNames).not.toContain('railway.logs');
    expect(coreNames).not.toContain('website.deploy');
    expect(coreNames).not.toContain('browser.open');
    expect(coreNames).not.toContain('design.publish');
    expect(coreNames).not.toContain('office.generateWebsite');
    expect(coreNames).not.toContain('daily-revenue-brief');
    expect(coreNames).not.toContain('get_raw_steering');
  });



  it('models read-only fs read and search as session-optional', () => {
    const registry = buildToolManifest({ write: false });
    const byName = new Map(registry.full.tools.map((entry) => [entry.name, entry]));

    for (const toolName of ['fs.read', 'fs.search']) {
      const entry = byName.get(toolName);
      expect(entry?.definition.capabilities).toMatchObject({ readOnly: true, mutating: false });
      expect(entry?.definition.command).toMatchObject({ script: 'task:fs', branchMode: 'optional' });
      expect(entry?.definition.sessionRequired).toBe(false);
    }

    expect(byName.get('fs.write')?.definition.sessionRequired).toBe(true);
    expect(byName.get('fs.apply_patch')?.definition.sessionRequired).toBe(true);
  });

  it('keeps public execution surface on code.call while task lifecycle stays full-manifest only', async () => {
    const registry = buildToolManifest({ write: false });
    const fullNames = registry.full.tools.map((entry) => entry.name);
    const coreNames = registry.core.tools.map((entry) => entry.name);
    const lifecycleTools = ['task.start', 'task.current', 'task.push', 'task.pr', 'task.finish'];
    const codeCallEntry = registry.core.tools.find((entry) => entry.name === 'code.call');
    const macCallEntry = registry.full.tools.find((entry) => entry.name === 'mac.call');

    expect(fullNames).toContain('code.call');
    expect(coreNames).toContain('code.call');
    expect(coreNames).not.toContain('mac.call');
    expect(coreNames).not.toContain('mac.exec');
    for (const toolName of lifecycleTools) {
      expect(fullNames).toContain(toolName);
      expect(coreNames).not.toContain(toolName);
    }
    expect(coreNames.some((name) => name.startsWith('task.'))).toBe(false);
    expect(fullNames).not.toContain('task.call');
    expect(fullNames).not.toContain('task.exec');
    expect(coreNames).not.toContain('task.call');
    expect(coreNames).not.toContain('task.exec');

    const publicText = publicSurfaceText();
    expect(publicText).not.toContain('task.call');
    expect(publicText).not.toContain('task.exec');
    expect(publicText).not.toContain('task:exec');
    expect(publicText).toContain('code.call');
    expect(publicText).toContain('Do not use `mac.call` for repo-scoped tests');

    expect(codeCallEntry?.description).toContain('runtime output is the evidence');
    expect(codeCallEntry?.description).toContain('tests');
    expect(codeCallEntry?.description).toContain('package scripts');
    expect(codeCallEntry?.description).toContain('compact packets');
    expect(JSON.stringify(codeCallEntry?.definition)).toContain('bun --cwd packages/os test tests/tool-manifest.test.ts');
    expect(macCallEntry?.description).toContain('emergency host escape hatch');
    expect(macCallEntry?.description).toContain('Do not use `mac.call` for repo-scoped tests');

    const taskCallSearch = await runToolSearch({ query: 'task.call', limit: 10, includeDocs: false, includeEmbeddings: false }) as SearchResult;
    const taskExecSearch = await runToolSearch({ query: 'task.exec', limit: 10, includeDocs: false, includeEmbeddings: false }) as SearchResult;

    expect(taskCallSearch.matches?.map((match) => match.name)).not.toContain('task.call');
    expect(taskExecSearch.matches?.map((match) => match.name)).not.toContain('task.exec');
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
    const devEntries = readJsonArray('tooling/dev-tool-manifest.json');
    const devNames = devEntries.map((entry) => String(entry.name));
    const fullEntry = registry.full.tools.find((entry) => entry.name === 'fs.apply_patch');
    const coreEntry = registry.core.tools.find((entry) => entry.name === 'fs.apply_patch');
    const devEntry = devEntries.find((entry) => entry.name === 'fs.apply_patch');

    expect(fullNames).toContain('fs.apply_patch');
    expect(coreNames).toContain('fs.apply_patch');
    expect(devNames).toContain('fs.apply_patch');
    expect(fullNames).not.toContain('fs.patch');
    expect(coreNames).not.toContain('fs.patch');
    expect(devNames).not.toContain('fs.patch');
    expect((fullEntry?.definition as JsonObject | undefined)?.inputSchema).toBe('FsApplyPatchInput');
    expect((coreEntry?.definition as JsonObject | undefined)?.inputSchema).toBe('FsApplyPatchInput');
    expect(devEntry?.inputSchema).toBe('FsApplyPatchInput');
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

  it('lets tool search discover a regular non-core OS skill from the full manifest', async () => {
    const result = await runToolSearch({
      query: 'daily revenue brief',
      limit: 5,
      includeDocs: false,
      includeEmbeddings: false,
    }) as SearchResult;

    expect(result.catalog?.source).toContain('tool.manifest.json');
    expect(result.catalog?.toolCount).toBeGreaterThan(120);
    expect(result.matches?.map((match) => match.name)).toContain('daily-revenue-brief');
  });

  it('keeps get_raw_steering discoverable through the full manifest without adding it to core', async () => {
    const registry = buildToolManifest({ write: false });
    const fullNames = registry.full.tools.map((entry) => entry.name);
    const coreNames = registry.core.tools.map((entry) => entry.name);

    expect(fullNames).toContain('get_raw_steering');
    expect(coreNames).not.toContain('get_raw_steering');

    const result = await runToolSearch({
      query: 'raw steering',
      limit: 5,
      includeDocs: false,
      includeEmbeddings: false,
    }) as SearchResult;

    expect(result.matches?.map((match) => match.name)).toContain('get_raw_steering');
  });
});
