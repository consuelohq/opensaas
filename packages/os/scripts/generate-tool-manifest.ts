#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { manifestConfig } from '../manifests/manifest.config';
import { toolPackages } from '../tools/registry';
import { workflows as workflowConfigs } from '../workflows/workflows';
import type { JsonObject, ToolDefinition } from '../tools/package';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

export type ManifestSourceKind = 'os-skill' | 'facade-tool';
export type GeneratedToolManifestEntry = {
  name: string;
  kind: ManifestSourceKind;
  source: string;
  sourcePath: string;
  category: string;
  description: string;
  title?: string;
  core: boolean;
  definition: JsonObject;
};
export type GeneratedToolManifest = {
  version: 1;
  kind: 'consuelo-os-tool-manifest';
  generatedFrom: Array<{ label: string; kind: ManifestSourceKind; path: string; entryCount: number }>;
  tools: GeneratedToolManifestEntry[];
};
export type GeneratedCoreManifest = {
  version: 1;
  kind: 'consuelo-os-core-manifest';
  sourceManifest: string;
  config: string;
  tools: GeneratedToolManifestEntry[];
};
export type GeneratedWorkflowBundleEntry = {
  id: string;
  aliases: string[];
  roles: string[];
  categories: string[];
  subscriptions: JsonObject[];
  tools: GeneratedToolManifestEntry[];
};
export type GeneratedWorkflowBundles = {
  version: 1;
  kind: 'consuelo-os-workflow-bundles';
  sourceManifest: string;
  config: string;
  source: string;
  workflows: GeneratedWorkflowBundleEntry[];
};
export type ToolManifestReport = {
  oldRegularToolCount: number;
  oldDevToolCount: number;
  fullToolCount: number;
  coreToolCount: number;
  duplicateNames: string[];
  regularToolNames: string[];
  devToolNames: string[];
  fullToolNames: string[];
  coreToolNames: string[];
};
export type BuildToolManifestOptions = {
  configPath?: string;
  fullOutputPath?: string;
  coreOutputPath?: string;
  workflowsOutputPath?: string;
  write?: boolean;
};
export type BuildToolManifestResult = {
  full: GeneratedToolManifest;
  core: GeneratedCoreManifest;
  workflows: GeneratedWorkflowBundles;
  report: ToolManifestReport;
  fullOutputPath: string;
  coreOutputPath: string;
  workflowsOutputPath: string;
};

type CoreConfig = {
  includeNames: readonly string[];
  includePrefixes: readonly string[];
  includeCategories?: readonly string[];
  excludeNames: readonly string[];
  excludePrefixes: readonly string[];
  excludeCategories: readonly string[];
};
type SourceRecord = { label: string; kind: ManifestSourceKind; path: string; definitions: JsonObject[] };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readJsonObject(filePath: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isObject(parsed)) throw new Error(relativeToRepo(filePath) + ': expected JSON object');
  return parsed;
}
function readJsonArray(filePath: string): JsonObject[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => !isObject(item))) {
    throw new Error(relativeToRepo(filePath) + ': expected JSON object array');
  }
  return parsed as JsonObject[];
}
function relativeToRepo(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}
function resolveRepoPath(filePath: string, baseDir = repoRoot): string {
  if (path.isAbsolute(filePath)) return filePath;
  if (filePath.startsWith('packages/')) return path.join(repoRoot, filePath);
  return path.resolve(baseDir, filePath);
}
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
function assertDefinition(value: JsonObject, sourcePath: string, kind: ManifestSourceKind): JsonObject & { name: string } {
  if (typeof value.name !== 'string' || value.name.length === 0) throw new Error(sourcePath + ': tool name is required');
  if (kind === 'facade-tool' && (!isObject(value.command) || typeof value.command.script !== 'string')) {
    throw new Error(sourcePath + ': command is required for ' + value.name);
  }
  return value as JsonObject & { name: string };
}
function defaultSources(): SourceRecord[] {
  return toolPackages.map((toolPackage) => ({
    label: toolPackage.domain,
    kind: 'facade-tool' as const,
    path: toolPackage.sourcePath,
    definitions: toolPackage.definitions as JsonObject[],
  }));
}
function fixtureSources(configPath: string): { sources: SourceRecord[]; core: CoreConfig; outputs: Record<string, string> } {
  const config = readJsonObject(configPath);
  if (config.version !== 1 || !Array.isArray(config.sources) || !isObject(config.core)) {
    throw new Error(relativeToRepo(configPath) + ': invalid fixture manifest config');
  }
  const configDir = path.dirname(configPath);
  const sources = (config.sources as JsonObject[]).map((source) => {
    const label = String(source.label ?? 'fixture');
    const kind = source.kind === 'os-skill' ? 'os-skill' : 'facade-tool';
    const configuredPath = String(source.path ?? '');
    const sourcePath = resolveRepoPath(configuredPath, configDir);
    return { label, kind, path: relativeToRepo(sourcePath), definitions: readJsonArray(sourcePath) };
  });
  return {
    sources,
    core: normalizeCore(config.core as JsonObject),
    outputs: isObject(config.outputs) ? Object.fromEntries(Object.entries(config.outputs).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {},
  };
}
function normalizeCore(value: JsonObject | CoreConfig): CoreConfig {
  return {
    includeNames: stringArray(value.includeNames),
    includePrefixes: stringArray(value.includePrefixes),
    includeCategories: stringArray(value.includeCategories),
    excludeNames: stringArray(value.excludeNames),
    excludePrefixes: stringArray(value.excludePrefixes),
    excludeCategories: stringArray(value.excludeCategories),
  };
}
function coreMatches(entry: GeneratedToolManifestEntry, config: CoreConfig): boolean {
  const category = entry.category.toLowerCase();
  if (config.excludeNames.includes(entry.name)) return false;
  if (config.includeNames.includes(entry.name)) return true;
  const included = config.includePrefixes.some((prefix) => entry.name.startsWith(prefix))
    || (config.includeCategories ?? []).some((value) => category === value.toLowerCase());
  const excluded = config.excludePrefixes.some((prefix) => entry.name.startsWith(prefix))
    || config.excludeCategories.some((value) => category === value.toLowerCase());
  return included && !excluded;
}
function normalizeEntry(source: SourceRecord, definitionValue: JsonObject): GeneratedToolManifestEntry {
  const definition = assertDefinition(definitionValue, source.path, source.kind);
  const title = typeof definition.title === 'string' ? definition.title : undefined;
  const description = typeof definition.description === 'string' ? definition.description : title ?? definition.name;
  return {
    name: definition.name,
    kind: source.kind,
    source: source.label,
    sourcePath: source.path,
    category: typeof definition.category === 'string' ? definition.category : source.kind === 'os-skill' ? 'consuelo os skill' : 'tool',
    description,
    ...(title ? { title } : {}),
    core: false,
    definition,
  };
}
function assertUnique(entries: GeneratedToolManifestEntry[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.name)) throw new Error('duplicate tool name ' + entry.name);
    seen.add(entry.name);
  }
}
function workflowMatches(entry: GeneratedToolManifestEntry, workflow: typeof workflowConfigs[number]): boolean {
  const role = typeof entry.definition.workflowRole === 'string' ? entry.definition.workflowRole : undefined;
  const roles = stringArray(workflow.roles);
  const categories = stringArray(workflow.categories);
  return Boolean(role && roles.includes(role)) || categories.some((value) => entry.category.toLowerCase() === value.toLowerCase());
}
function outputPath(configured: string, override?: string): string {
  return override ? path.resolve(override) : resolveRepoPath(configured);
}
function serialized(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export function buildToolManifest(options: BuildToolManifestOptions = {}): BuildToolManifestResult {
  const fixture = options.configPath ? fixtureSources(path.resolve(options.configPath)) : null;
  const sources = fixture?.sources ?? defaultSources();
  const coreConfig = fixture?.core ?? normalizeCore(manifestConfig.core as unknown as JsonObject);
  const configuredOutputs = fixture?.outputs ?? manifestConfig.outputs;
  const fullOutputPath = outputPath(configuredOutputs.full ?? manifestConfig.outputs.full, options.fullOutputPath);
  const coreOutputPath = outputPath(configuredOutputs.core ?? manifestConfig.outputs.core, options.coreOutputPath);
  const workflowsOutputPath = outputPath(configuredOutputs.workflows ?? manifestConfig.outputs.workflows, options.workflowsOutputPath);
  const entries = sources.flatMap((source) => source.definitions.map((definition) => normalizeEntry(source, definition)));
  assertUnique(entries);
  const fullTools = entries
    .map((entry) => ({ ...entry, core: coreMatches(entry, coreConfig) }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const coreTools = fullTools.filter((entry) => entry.core);
  const generatedFrom = sources.map((source) => ({ label: source.label, kind: source.kind, path: source.path, entryCount: source.definitions.length }));
  const full: GeneratedToolManifest = { version: 1, kind: 'consuelo-os-tool-manifest', generatedFrom, tools: fullTools };
  const core: GeneratedCoreManifest = {
    version: 1,
    kind: 'consuelo-os-core-manifest',
    sourceManifest: relativeToRepo(fullOutputPath),
    config: options.configPath ? relativeToRepo(path.resolve(options.configPath)) : 'packages/os/manifests/manifest.config.ts',
    tools: coreTools,
  };
  const workflows: GeneratedWorkflowBundles = {
    version: 1,
    kind: 'consuelo-os-workflow-bundles',
    sourceManifest: relativeToRepo(fullOutputPath),
    config: options.configPath ? relativeToRepo(path.resolve(options.configPath)) : 'packages/os/manifests/manifest.config.ts',
    source: options.configPath ? '' : 'packages/os/workflows/workflows.ts',
    workflows: options.configPath ? [] : workflowConfigs.map((workflow) => ({
      id: workflow.id,
      aliases: stringArray(workflow.aliases),
      roles: stringArray(workflow.roles),
      categories: stringArray(workflow.categories),
      subscriptions: Array.isArray(workflow.subscriptions) ? workflow.subscriptions.map((value) => ({ ...value })) as JsonObject[] : [],
      tools: fullTools.filter((entry) => workflowMatches(entry, workflow)),
    })),
  };
  const regularToolNames = fullTools.filter((entry) => entry.kind === 'os-skill').map((entry) => entry.name).sort();
  const devToolNames = fullTools.filter((entry) => entry.kind === 'facade-tool').map((entry) => entry.name).sort();
  return {
    full,
    core,
    workflows,
    fullOutputPath,
    coreOutputPath,
    workflowsOutputPath,
    report: {
      oldRegularToolCount: regularToolNames.length,
      oldDevToolCount: devToolNames.length,
      fullToolCount: fullTools.length,
      coreToolCount: coreTools.length,
      duplicateNames: [],
      regularToolNames,
      devToolNames,
      fullToolNames: fullTools.map((entry) => entry.name),
      coreToolNames: coreTools.map((entry) => entry.name),
    },
  };
}

export function generateToolManifest(options: BuildToolManifestOptions = {}): BuildToolManifestResult {
  const result = buildToolManifest(options);
  for (const output of [result.fullOutputPath, result.coreOutputPath, result.workflowsOutputPath]) fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(result.fullOutputPath, serialized(result.full));
  fs.writeFileSync(result.coreOutputPath, serialized(result.core));
  fs.writeFileSync(result.workflowsOutputPath, serialized(result.workflows));
  return result;
}

export function checkToolManifestDrift(): string[] {
  const result = buildToolManifest({ write: false });
  const expected = new Map<string, string>([
    [result.fullOutputPath, serialized(result.full)],
    [result.coreOutputPath, serialized(result.core)],
    [result.workflowsOutputPath, serialized(result.workflows)],
  ]);
  const drift: string[] = [];
  for (const [filePath, content] of expected) {
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== content) drift.push(relativeToRepo(filePath));
  }
  return drift;
}

if (import.meta.main) {
  try {
    if (process.argv.includes('--check')) {
      const drift = checkToolManifestDrift();
      if (drift.length > 0) {
        process.stderr.write('generated manifest drift: ' + drift.join(', ') + '\n');
        process.exit(1);
      }
      process.stdout.write('generated manifests are current\n');
    } else {
      const result = generateToolManifest();
      process.stdout.write('wrote ' + relativeToRepo(result.fullOutputPath) + ' (' + result.report.fullToolCount + ' tools)\n');
      process.stdout.write('wrote ' + relativeToRepo(result.coreOutputPath) + ' (' + result.report.coreToolCount + ' tools)\n');
      process.stdout.write('wrote ' + relativeToRepo(result.workflowsOutputPath) + ' (' + result.workflows.workflows.length + ' workflows)\n');
    }
  } catch (error: unknown) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
    process.exit(1);
  }
}
