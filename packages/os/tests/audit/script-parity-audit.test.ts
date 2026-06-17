import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const packageRoot = join(import.meta.dirname, '..', '..');
const repoRoot = join(packageRoot, '..', '..');
const workspaceScriptsRoot = join(repoRoot, 'packages', 'workspace', 'scripts');
const osScriptsRoot = join(packageRoot, 'scripts');
const classificationPath = join(packageRoot, 'tooling', 'script-parity-classifications.json');

const allowedScriptStatuses = [
  'same',
  'changed-needs-review',
  'workspace-only-needs-port',
  'os-only-intentional',
  'os-only-needs-review',
  'renamed-equivalent',
  'generated-equivalent',
  'deprecated-intentional',
] as const;

type ScriptStatus = (typeof allowedScriptStatuses)[number];

type ScriptClassification = {
  status: ScriptStatus;
  reason: string;
  risk?: string;
};

type TermClassification = {
  preferredReplacement: string;
  reason: string;
};

type ManifestDriftClassification = {
  tool: string;
  reason: string;
};

type ContextBackendContract = {
  standaloneDefault: string;
  sqliteStandaloneDefault: boolean;
  supabaseOptionalRemoteSync: boolean;
  missingSupabaseEnvBreaksStandalone: boolean;
  reason: string;
};

type ClassificationBaseline = {
  schemaVersion: number;
  scripts: Record<string, ScriptClassification>;
  highRiskScripts: string[];
  hardcodedPortability: Record<string, TermClassification>;
  contextBackendContract: ContextBackendContract;
  manifestDrift: ManifestDriftClassification[];
};

type ScriptInventory = {
  allScripts: string[];
  workspaceOnlyScripts: string[];
  osOnlyScripts: string[];
  changedSamePathScripts: string[];
  samePathUnchangedScripts: string[];
};

const highRiskScripts = [
  'scripts/office.ts',
  'scripts/context.js',
  'scripts/browser.js',
  'scripts/explore.js',
  'scripts/generate-docs.ts',
  'scripts/lib/pr-ref.js',
  'scripts/lib/stream-workpads.js',
  'scripts/diff_cockpit.ts',
  'scripts/os-release-install.ts',
];

const hardcodedPortabilityTerms = [
  'Ko',
  'Kokayi',
  'kokayi',
  '@kokayi',
  '/Users/kokayi',
  'consuelohq/opensaas',
  'opensaas',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'stream/workspace',
  'stream/workspace-agents',
];

const knownManifestDrift = [
  'task.start',
  'task.push',
  'task.pr',
  'task.prs',
  'task.finish',
  'task.init',
  'task.merge',
  'task.exec',
  'tools.search',
];

function listScriptFiles(root: string): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory).sort()) {
      const absolutePath = join(directory, entry);
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      files.push(['scripts', relative(root, absolutePath)].join(sep).split(sep).join('/'));
    }
  }

  visit(root);

  return files.sort();
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function buildInventory(): ScriptInventory {
  const workspaceScripts = listScriptFiles(workspaceScriptsRoot);
  const osScripts = listScriptFiles(osScriptsRoot);
  const workspaceScriptSet = new Set(workspaceScripts);
  const osScriptSet = new Set(osScripts);
  const samePathScripts = workspaceScripts.filter((scriptPath) => osScriptSet.has(scriptPath));

  const workspaceOnlyScripts = workspaceScripts.filter((scriptPath) => !osScriptSet.has(scriptPath));
  const osOnlyScripts = osScripts.filter((scriptPath) => !workspaceScriptSet.has(scriptPath));
  const changedSamePathScripts = samePathScripts.filter((scriptPath) => {
    const workspaceHash = hashFile(join(repoRoot, 'packages', 'workspace', scriptPath));
    const osHash = hashFile(join(packageRoot, scriptPath));

    return workspaceHash !== osHash;
  });
  const changedSamePathSet = new Set(changedSamePathScripts);
  const samePathUnchangedScripts = samePathScripts.filter((scriptPath) => !changedSamePathSet.has(scriptPath));

  return {
    allScripts: [...new Set([...workspaceScripts, ...osScripts])].sort(),
    workspaceOnlyScripts,
    osOnlyScripts,
    changedSamePathScripts,
    samePathUnchangedScripts,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUsefulReason(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const trimmedValue = value.trim();
  if (trimmedValue.length < 24) return false;

  return !['todo', 'tbd', 'needs review', 'n/a', 'na'].includes(trimmedValue.toLowerCase());
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  expect(Array.isArray(value), `${fieldName} must be an array`).toBe(true);

  return (value as unknown[]).map((entry, index) => {
    expect(typeof entry, `${fieldName}[${index}] must be a string`).toBe('string');

    return entry as string;
  });
}

function assertBaseline(value: unknown): ClassificationBaseline {
  expect(isRecord(value), 'classification baseline must be a JSON object').toBe(true);
  const baseline = value as Record<string, unknown>;

  expect(baseline.schemaVersion, 'schemaVersion must be 1').toBe(1);
  expect(isRecord(baseline.scripts), 'scripts must be an object keyed by script path').toBe(true);
  expect(isRecord(baseline.hardcodedPortability), 'hardcodedPortability must be an object keyed by hardcoded term').toBe(true);
  expect(isRecord(baseline.contextBackendContract), 'contextBackendContract must be an object').toBe(true);
  expect(Array.isArray(baseline.manifestDrift), 'manifestDrift must be an array').toBe(true);

  return baseline as ClassificationBaseline;
}

function readBaseline(): ClassificationBaseline {
  expect(
    existsSync(classificationPath),
    `Missing script parity classification baseline at ${relative(repoRoot, classificationPath)}`,
  ).toBe(true);

  return assertBaseline(JSON.parse(readFileSync(classificationPath, 'utf8')) as unknown);
}

function assertClassificationsMatchInventory(baseline: ClassificationBaseline, inventory: ScriptInventory): void {
  const expectedScriptSet = new Set(inventory.allScripts);
  const actualScriptPaths = Object.keys(baseline.scripts).sort();

  expect(actualScriptPaths).toEqual(inventory.allScripts);

  for (const scriptPath of actualScriptPaths) {
    expect(expectedScriptSet.has(scriptPath), `${scriptPath} is stale; it is no longer in either script inventory`).toBe(true);
  }
}

function assertClassificationEntry(scriptPath: string, entry: ScriptClassification): void {
  expect(
    allowedScriptStatuses.includes(entry.status),
    `${scriptPath} uses unsupported script parity status "${entry.status}"`,
  ).toBe(true);
  expect(isUsefulReason(entry.reason), `${scriptPath} needs a specific, useful reason`).toBe(true);
}

function assertStatusCompatibility(baseline: ClassificationBaseline, inventory: ScriptInventory): void {
  const workspaceOnlyStatuses = new Set<ScriptStatus>([
    'workspace-only-needs-port',
    'renamed-equivalent',
    'generated-equivalent',
    'deprecated-intentional',
  ]);
  const osOnlyStatuses = new Set<ScriptStatus>([
    'os-only-intentional',
    'os-only-needs-review',
    'renamed-equivalent',
    'generated-equivalent',
    'deprecated-intentional',
  ]);
  const changedStatuses = new Set<ScriptStatus>([
    'changed-needs-review',
    'renamed-equivalent',
    'generated-equivalent',
    'deprecated-intentional',
  ]);

  for (const scriptPath of inventory.workspaceOnlyScripts) {
    const entry = baseline.scripts[scriptPath];
    assertClassificationEntry(scriptPath, entry);
    expect(
      workspaceOnlyStatuses.has(entry.status),
      `${scriptPath} is workspace-only and must use a workspace-only compatible status`,
    ).toBe(true);
  }

  for (const scriptPath of inventory.osOnlyScripts) {
    const entry = baseline.scripts[scriptPath];
    assertClassificationEntry(scriptPath, entry);
    expect(osOnlyStatuses.has(entry.status), `${scriptPath} is OS-only and must use an OS-only compatible status`).toBe(true);
  }

  for (const scriptPath of inventory.changedSamePathScripts) {
    const entry = baseline.scripts[scriptPath];
    assertClassificationEntry(scriptPath, entry);
    expect(
      changedStatuses.has(entry.status),
      `${scriptPath} exists in both script trees with changed content and must use a changed compatible status`,
    ).toBe(true);
  }

  for (const scriptPath of inventory.samePathUnchangedScripts) {
    const entry = baseline.scripts[scriptPath];
    assertClassificationEntry(scriptPath, entry);
    expect(entry.status, `${scriptPath} has identical content and must stay classified as same`).toBe('same');
  }
}

function assertHighRiskScripts(baseline: ClassificationBaseline): void {
  expect(assertStringArray(baseline.highRiskScripts, 'highRiskScripts').sort()).toEqual([...highRiskScripts].sort());

  for (const scriptPath of highRiskScripts) {
    const entry = baseline.scripts[scriptPath];
    expect(entry, `high-risk script ${scriptPath} must have a script classification`).toBeDefined();
    expect(isUsefulReason(entry.reason), `high-risk script ${scriptPath} needs a specific reason`).toBe(true);
  }
}

function assertHardcodedPortability(baseline: ClassificationBaseline): void {
  expect(Object.keys(baseline.hardcodedPortability).sort()).toEqual([...hardcodedPortabilityTerms].sort());

  for (const term of hardcodedPortabilityTerms) {
    const entry = baseline.hardcodedPortability[term];
    expect(entry, `${term} needs a hardcoded portability classification`).toBeDefined();
    expect(isUsefulReason(entry.reason), `${term} needs a specific portability reason`).toBe(true);
    expect(isUsefulReason(entry.preferredReplacement), `${term} needs a useful preferred replacement`).toBe(true);
  }

  expect(baseline.hardcodedPortability.Ko.preferredReplacement.toLowerCase()).toContain('user');
}

function assertContextBackendContract(baseline: ClassificationBaseline): void {
  expect(baseline.contextBackendContract).toMatchObject({
    standaloneDefault: 'sqlite',
    sqliteStandaloneDefault: true,
    supabaseOptionalRemoteSync: true,
    missingSupabaseEnvBreaksStandalone: false,
  });
  expect(isUsefulReason(baseline.contextBackendContract.reason), 'context backend contract needs a useful reason').toBe(true);
}

function assertManifestDrift(baseline: ClassificationBaseline): void {
  const driftTools = baseline.manifestDrift.map((entry) => entry.tool).sort();
  expect(driftTools).toEqual([...knownManifestDrift].sort());

  for (const entry of baseline.manifestDrift) {
    expect(knownManifestDrift.includes(entry.tool), `${entry.tool} is not part of the known manifest drift list`).toBe(true);
    expect(isUsefulReason(entry.reason), `${entry.tool} manifest drift entry needs a useful reason`).toBe(true);
  }
}

describe('OS script parity audit classifications', () => {
  it('classifies the complete workspace and OS script inventory', () => {
    const inventory = buildInventory();
    const baseline = readBaseline();

    assertClassificationsMatchInventory(baseline, inventory);
    assertStatusCompatibility(baseline, inventory);
    assertHighRiskScripts(baseline);
    assertHardcodedPortability(baseline);
    assertContextBackendContract(baseline);
    assertManifestDrift(baseline);
  });
});
