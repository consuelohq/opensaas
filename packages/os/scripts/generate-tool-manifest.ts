#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const DEFAULT_CONFIG_PATH = path.join(packageRoot, 'manifests', 'manifest.config.json');

export type ManifestSourceKind = 'os-skill' | 'facade-tool';
export type JsonObject = Record<string, unknown>;

export type ManifestSourceConfig = {
  label: string;
  kind: ManifestSourceKind;
  path: string;
};

export type CoreManifestConfig = {
  includeNames: string[];
  includePrefixes: string[];
  includeCategories?: string[];
  excludeNames: string[];
  excludePrefixes: string[];
  excludeCategories: string[];
};

export type ToolManifestConfig = {
  version: 1;
  sources: ManifestSourceConfig[];
  outputs?: {
    full?: string;
    core?: string;
    workflows?: string;
  };
  workflows?: {
    path: string;
  };
  core: CoreManifestConfig;
};

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
  generatedFrom: Array<{
    label: string;
    kind: ManifestSourceKind;
    path: string;
    entryCount: number;
  }>;
  tools: GeneratedToolManifestEntry[];
};

export type GeneratedCoreManifest = {
  version: 1;
  kind: 'consuelo-os-core-manifest';
  sourceManifest: string;
  config: string;
  tools: GeneratedToolManifestEntry[];
};

export type WorkflowBundleConfig = {
  id: string;
  aliases?: string[];
  roles?: string[];
  categories?: string[];
  subscriptions?: JsonObject[];
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

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonObject(filePath: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isObject(parsed)) {
    throw new Error(`${relativeToRepo(filePath)}: expected JSON object`);
  }

  return parsed;
}

function readJsonArray(filePath: string): JsonObject[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => !isObject(item))) {
    throw new Error(`${relativeToRepo(filePath)}: expected JSON object array`);
  }

  return parsed as JsonObject[];
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function relativeToRepo(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function resolvePath(filePath: string, configDir: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  if (filePath.startsWith('packages/')) return path.join(repoRoot, filePath);
  return path.resolve(configDir, filePath);
}

function readConfig(configPath: string): ToolManifestConfig {
  const config = readJsonObject(configPath);
  if (config.version !== 1) {
    throw new Error(`${relativeToRepo(configPath)}: version must be 1`);
  }
  if (!Array.isArray(config.sources)) {
    throw new Error(`${relativeToRepo(configPath)}: sources must be an array`);
  }
  if (!isObject(config.core)) {
    throw new Error(`${relativeToRepo(configPath)}: core must be an object`);
  }

  return config as ToolManifestConfig;
}

function valueToStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeCoreConfig(core: CoreManifestConfig): CoreManifestConfig {
  return {
    includeNames: valueToStringArray(core.includeNames),
    includePrefixes: valueToStringArray(core.includePrefixes),
    includeCategories: valueToStringArray(core.includeCategories),
    excludeNames: valueToStringArray(core.excludeNames),
    excludePrefixes: valueToStringArray(core.excludePrefixes),
    excludeCategories: valueToStringArray(core.excludeCategories),
  };
}

function categoryFor(kind: ManifestSourceKind, definition: JsonObject): string {
  const category = typeof definition.category === 'string' ? definition.category : undefined;
  if (category) return category;
  return kind === 'os-skill' ? 'consuelo os skill' : 'tooling';
}

function normalizeEntry(source: ManifestSourceConfig, sourcePath: string, definition: JsonObject): GeneratedToolManifestEntry {
  const name = assertString(definition.name, `${relativeToRepo(sourcePath)} entry.name`);
  const title = typeof definition.title === 'string' ? definition.title : undefined;
  const description = typeof definition.description === 'string'
    ? definition.description
    : title ?? name;

  return {
    name,
    kind: source.kind,
    source: source.label,
    sourcePath: relativeToRepo(sourcePath),
    category: categoryFor(source.kind, definition),
    description,
    ...(title ? { title } : {}),
    core: false,
    definition,
  };
}

function coreMatches(entry: GeneratedToolManifestEntry, coreConfig: CoreManifestConfig): boolean {
  const category = entry.category.toLowerCase();
  if (coreConfig.excludeNames.includes(entry.name)) return false;
  if (coreConfig.includeNames.includes(entry.name)) return true;

  const included = coreConfig.includePrefixes.some((prefix) => entry.name.startsWith(prefix))
    || (coreConfig.includeCategories ?? []).some((coreCategory) => category === coreCategory.toLowerCase());
  const excluded = coreConfig.excludePrefixes.some((prefix) => entry.name.startsWith(prefix))
    || coreConfig.excludeCategories.some((coreCategory) => category === coreCategory.toLowerCase());

  return included && !excluded;
}

function buildEntries(config: ToolManifestConfig, configDir: string): {
  entries: GeneratedToolManifestEntry[];
  generatedFrom: GeneratedToolManifest['generatedFrom'];
  regularToolNames: string[];
  devToolNames: string[];
} {
  const entries: GeneratedToolManifestEntry[] = [];
  const generatedFrom: GeneratedToolManifest['generatedFrom'] = [];
  const regularToolNames: string[] = [];
  const devToolNames: string[] = [];

  for (const source of config.sources) {
    const sourcePath = resolvePath(source.path, configDir);
    const sourceEntries = readJsonArray(sourcePath);
    generatedFrom.push({
      label: source.label,
      kind: source.kind,
      path: relativeToRepo(sourcePath),
      entryCount: sourceEntries.length,
    });

    for (const definition of sourceEntries) {
      const entry = normalizeEntry(source, sourcePath, definition);
      entries.push(entry);
      if (source.kind === 'os-skill') regularToolNames.push(entry.name);
      if (source.kind === 'facade-tool') devToolNames.push(entry.name);
    }
  }

  return { entries, generatedFrom, regularToolNames, devToolNames };
}

function assertUnique(entries: GeneratedToolManifestEntry[]): void {
  const seen = new Map<string, GeneratedToolManifestEntry>();
  const duplicates: string[] = [];

  for (const entry of entries) {
    const previous = seen.get(entry.name);
    if (previous) {
      duplicates.push(entry.name);
      continue;
    }
    seen.set(entry.name, entry);
  }

  if (duplicates.length > 0) {
    throw new Error(`duplicate tool name ${duplicates.sort()[0]}`);
  }
}

function sortEntries(entries: GeneratedToolManifestEntry[]): GeneratedToolManifestEntry[] {
  return [...entries].sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeWorkflowConfig(configPath: string, value: JsonObject): WorkflowBundleConfig[] {
  const workflows = value.workflows;
  if (!Array.isArray(workflows) || workflows.some((item) => !isObject(item))) {
    throw new Error(`${relativeToRepo(configPath)}: workflows must be an array of objects`);
  }

  return workflows.map((workflow) => ({
    id: assertString(workflow.id, `${relativeToRepo(configPath)} workflow.id`),
    aliases: valueToStringArray(workflow.aliases),
    roles: valueToStringArray(workflow.roles),
    categories: valueToStringArray(workflow.categories),
    subscriptions: Array.isArray(workflow.subscriptions)
      ? workflow.subscriptions.filter(isObject)
      : [],
  }));
}

function readWorkflowConfig(config: ToolManifestConfig, configDir: string): {
  sourcePath: string;
  workflows: WorkflowBundleConfig[];
} {
  const configuredPath = config.workflows?.path;
  if (!configuredPath) {
    return { sourcePath: '', workflows: [] };
  }

  const sourcePath = resolvePath(configuredPath, configDir);
  return {
    sourcePath,
    workflows: normalizeWorkflowConfig(sourcePath, readJsonObject(sourcePath)),
  };
}

function workflowMatches(entry: GeneratedToolManifestEntry, workflow: WorkflowBundleConfig): boolean {
  const role = typeof entry.definition.workflowRole === 'string' ? entry.definition.workflowRole : undefined;
  const category = entry.category.toLowerCase();

  return Boolean(role && valueToStringArray(workflow.roles).includes(role))
    || valueToStringArray(workflow.categories).some((workflowCategory) => category === workflowCategory.toLowerCase());
}

function buildWorkflowBundles(
  config: ToolManifestConfig,
  configDir: string,
  configPath: string,
  fullOutputPath: string,
  fullTools: GeneratedToolManifestEntry[],
): GeneratedWorkflowBundles {
  const workflowConfig = readWorkflowConfig(config, configDir);
  const workflows = workflowConfig.workflows.map((workflow) => ({
    id: workflow.id,
    aliases: valueToStringArray(workflow.aliases),
    roles: valueToStringArray(workflow.roles),
    categories: valueToStringArray(workflow.categories),
    subscriptions: Array.isArray(workflow.subscriptions) ? workflow.subscriptions : [],
    tools: fullTools.filter((entry) => workflowMatches(entry, workflow)),
  }));

  return {
    version: 1,
    kind: 'consuelo-os-workflow-bundles',
    sourceManifest: relativeToRepo(fullOutputPath),
    config: relativeToRepo(configPath),
    source: workflowConfig.sourcePath ? relativeToRepo(workflowConfig.sourcePath) : '',
    workflows,
  };
}


function outputPathFromConfig(config: ToolManifestConfig, configDir: string, key: 'full' | 'core' | 'workflows', fallback: string): string {
  const configured = config.outputs?.[key];
  return configured ? resolvePath(configured, configDir) : fallback;
}

export function buildToolManifest(options: BuildToolManifestOptions = {}): BuildToolManifestResult {
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const configDir = path.dirname(configPath);
  const config = readConfig(configPath);
  const coreConfig = normalizeCoreConfig(config.core);
  const { entries, generatedFrom, regularToolNames, devToolNames } = buildEntries(config, configDir);

  assertUnique(entries);

  const defaultFullOutputPath = outputPathFromConfig(config, configDir, 'full', path.join(packageRoot, 'manifests', 'tool.manifest.json'));
  const fullOutputPath = options.fullOutputPath
    ? path.resolve(options.fullOutputPath)
    : defaultFullOutputPath;
  const coreOutputPath = options.coreOutputPath
    ? path.resolve(options.coreOutputPath)
    : outputPathFromConfig(config, configDir, 'core', path.join(packageRoot, 'manifests', 'core.manifest.json'));
  const workflowsOutputPath = options.workflowsOutputPath
    ? path.resolve(options.workflowsOutputPath)
    : outputPathFromConfig(config, configDir, 'workflows', path.join(packageRoot, 'manifests', 'workflow-bundles.json'));

  const withCore = entries.map((entry) => ({ ...entry, core: coreMatches(entry, coreConfig) }));
  const fullTools = sortEntries(withCore);
  const coreTools = fullTools.filter((entry) => entry.core);
  const fullToolNames = fullTools.map((entry) => entry.name);
  const coreToolNames = coreTools.map((entry) => entry.name);

  const full: GeneratedToolManifest = {
    version: 1,
    kind: 'consuelo-os-tool-manifest',
    generatedFrom,
    tools: fullTools,
  };
  const core: GeneratedCoreManifest = {
    version: 1,
    kind: 'consuelo-os-core-manifest',
    sourceManifest: relativeToRepo(fullOutputPath),
    config: relativeToRepo(configPath),
    tools: coreTools,
  };
  const workflowSourceManifestPath = fullOutputPath;
  const workflows = buildWorkflowBundles(config, configDir, configPath, workflowSourceManifestPath, fullTools);

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
      regularToolNames: regularToolNames.sort(),
      devToolNames: devToolNames.sort(),
      fullToolNames,
      coreToolNames,
    },
  };
}

export function generateToolManifest(options: BuildToolManifestOptions = {}): BuildToolManifestResult {
  const result = buildToolManifest(options);
  fs.mkdirSync(path.dirname(result.fullOutputPath), { recursive: true });
  fs.mkdirSync(path.dirname(result.coreOutputPath), { recursive: true });
  fs.mkdirSync(path.dirname(result.workflowsOutputPath), { recursive: true });
  fs.writeFileSync(result.fullOutputPath, `${JSON.stringify(result.full, null, 2)}\n`);
  fs.writeFileSync(result.coreOutputPath, `${JSON.stringify(result.core, null, 2)}\n`);
  fs.writeFileSync(result.workflowsOutputPath, `${JSON.stringify(result.workflows, null, 2)}\n`);
  return result;
}

if (import.meta.main) {
  try {
    const result = generateToolManifest();
    process.stdout.write(`wrote ${relativeToRepo(result.fullOutputPath)} (${result.report.fullToolCount} tools)\n`);
    process.stdout.write(`wrote ${relativeToRepo(result.coreOutputPath)} (${result.report.coreToolCount} tools)\n`);
    process.stdout.write(`wrote ${relativeToRepo(result.workflowsOutputPath)} (${result.workflows.workflows.length} workflows)\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
