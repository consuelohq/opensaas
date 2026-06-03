import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import {
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ConsueloCoreRegistrySchema,
  type ConsueloCoreRegistry,
  type RegistryAuditCliOutput,
  type RegistryAuditIssue,
  type RegistryDriftReport,
  type ScriptRegistryEntry,
} from './types';

export type RegistryLoadOptions = {
  packageRoot?: string;
  repoRoot?: string;
};

export type ScriptTargetAuditOptions = {
  repoRoot: string;
  packageJsonPaths?: string[];
};

export type LocalImportAuditOptions = {
  repoRoot: string;
  scriptRoots?: string[];
};

export type OwnershipGuardrailOptions = {
  repoRoot: string;
  registry: ConsueloCoreRegistry;
};

export type RegistryAuditOptions = RegistryLoadOptions & {
  driftOnly?: boolean;
};

const DEFAULT_PACKAGE_JSON_PATHS = [
  'package.json',
  'packages/workspace/package.json',
  'packages/os/package.json',
  'packages/diff-cockpit/package.json',
];

const DEFAULT_SCRIPT_ROOTS = [
  'packages/workspace/scripts',
  'packages/os/scripts',
];

const COMMAND_RUNNERS = new Set(['bun', 'node', 'tsx', 'ts-node', 'bash', 'sh']);
const SOURCE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx']);
const DRIFT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.json', '.sh']);
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.sh'];

type SafeJsonReadResult =
  | { ok: true; value: unknown }
  | { ok: false; error: Error };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function defaultPackageRoot(): string {
  return fileURLToPath(new URL('../..', import.meta.url));
}

function defaultRepoRoot(packageRoot: string): string {
  return resolve(packageRoot, '../..');
}

function toPosixPath(value: string): string {
  return value.split(sep).join('/');
}

function normalizeRelativePath(value: string): string {
  const normalized = toPosixPath(normalize(value));

  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

function repoRelative(repoRoot: string, absolutePath: string): string {
  return normalizeRelativePath(relative(repoRoot, absolutePath));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function safeReadJsonFile(filePath: string): SafeJsonReadResult {
  try {
    return { ok: true, value: readJsonFile(filePath) };
  } catch (error) {
    return { ok: false, error: new Error(errorMessage(error)) };
  }
}

function readRegistryArray<TEntry>(filePath: string, key: string): TEntry[] {
  const parsed = readJsonFile(filePath);

  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed[key])) {
    throw new Error(`Invalid registry file ${filePath}`);
  }

  return parsed[key] as TEntry[];
}

export function validateConsueloCoreRegistry(input: unknown): ConsueloCoreRegistry {
  return ConsueloCoreRegistrySchema.parse(input);
}

export function loadConsueloCoreRegistry(options: RegistryLoadOptions = {}): ConsueloCoreRegistry {
  const packageRoot = resolve(options.packageRoot ?? defaultPackageRoot());
  const registryRoot = join(packageRoot, 'registry');
  const registry = {
    version: 1,
    packages: readRegistryArray(join(registryRoot, 'packages.json'), 'packages'),
    scripts: readRegistryArray(join(registryRoot, 'scripts.json'), 'scripts'),
    tools: readRegistryArray(join(registryRoot, 'tools.json'), 'tools'),
    skills: readRegistryArray(join(registryRoot, 'skills.json'), 'skills'),
  };

  return validateConsueloCoreRegistry(registry);
}

function readPackageScripts(repoRoot: string, packageJsonPath: string): Record<string, string> | RegistryAuditIssue {
  const absolutePackageJsonPath = join(repoRoot, packageJsonPath);

  if (!existsSync(absolutePackageJsonPath)) {
    return {
      code: 'PACKAGE_JSON_MISSING',
      message: `package.json does not exist: ${packageJsonPath}`,
      path: packageJsonPath,
      packageJsonPath,
    };
  }

  const parsedResult = safeReadJsonFile(absolutePackageJsonPath);

  if (!parsedResult.ok) {
    return {
      code: 'PACKAGE_SCRIPTS_INVALID',
      message: `package.json could not be parsed: ${packageJsonPath}: ${parsedResult.error.message}`,
      path: packageJsonPath,
      packageJsonPath,
    };
  }

  const parsed = parsedResult.value;

  if (!isRecord(parsed)) {
    return {
      code: 'PACKAGE_SCRIPTS_INVALID',
      message: `package.json is not an object: ${packageJsonPath}`,
      path: packageJsonPath,
      packageJsonPath,
    };
  }

  const scripts = parsed.scripts;

  if (scripts === undefined) {
    return {};
  }

  if (!isRecord(scripts)) {
    return {
      code: 'PACKAGE_SCRIPTS_INVALID',
      message: `package.json scripts must be an object: ${packageJsonPath}`,
      path: packageJsonPath,
      packageJsonPath,
    };
  }

  const scriptEntries = Object.entries(scripts).filter((entry): entry is [string, string] => {
    return typeof entry[1] === 'string';
  });

  return Object.fromEntries(scriptEntries);
}

function isRegistryAuditIssue(
  value: Record<string, string> | RegistryAuditIssue,
): value is RegistryAuditIssue {
  return 'code' in value && 'message' in value && 'path' in value;
}
function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: 'single' | 'double' | null = null;

  for (const character of command) {
    if (quote === 'single') {
      if (character === "'") {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (quote === 'double') {
      if (character === '"') {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (character === "'") {
      quote = 'single';
      continue;
    }

    if (character === '"') {
      quote = 'double';
      continue;
    }

    if (/\s/.test(character)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += character;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function isEnvironmentAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(token);
}

function isCommandBoundary(token: string): boolean {
  return token === '&&' || token === '||' || token === ';' || token === '|';
}

function isLikelyRepoFileTarget(token: string): boolean {
  if (token.startsWith('-') || token.startsWith('{') || token.startsWith('http://') || token.startsWith('https://')) {
    return false;
  }

  return (
    token.startsWith('./') ||
    token.startsWith('../') ||
    token.startsWith('packages/') ||
    token.startsWith('scripts/') ||
    token.startsWith('src/') ||
    /\.(?:js|cjs|mjs|ts|tsx|sh|json|py)$/.test(token)
  );
}

function resolveCommandTarget(packageJsonPath: string, token: string): string {
  const packageDirectory = dirname(packageJsonPath);
  const relativeTarget = token.startsWith('./') || token.startsWith('../') ? join(packageDirectory, token) : token;

  return normalizeRelativePath(relativeTarget);
}

export function resolveScriptCommandTargets(packageJsonPath: string, command: string): string[] {
  const tokens = tokenizeCommand(command);
  const targets = new Set<string>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (!COMMAND_RUNNERS.has(token)) {
      continue;
    }

    let cursor = index + 1;

    if (token === 'bun' && tokens[cursor] === 'run') {
      cursor += 1;
    }

    while (cursor < tokens.length) {
      const candidate = tokens[cursor];

      if (isCommandBoundary(candidate)) {
        break;
      }

      if (candidate === '--cwd' || candidate === '-C') {
        cursor += 2;
        continue;
      }

      if (candidate.startsWith('--cwd=')) {
        cursor += 1;
        continue;
      }

      if (isEnvironmentAssignment(candidate) || candidate.startsWith('-')) {
        cursor += 1;
        continue;
      }

      if (isLikelyRepoFileTarget(candidate)) {
        targets.add(resolveCommandTarget(packageJsonPath, candidate));
      }

      break;
    }
  }

  return [...targets].sort();
}

function sortIssues(issues: RegistryAuditIssue[]): RegistryAuditIssue[] {
  return issues.sort((left, right) => {
    if (left.path !== right.path) {
      return left.path.localeCompare(right.path);
    }

    return left.code.localeCompare(right.code);
  });
}

export function auditScriptTargets(options: ScriptTargetAuditOptions): RegistryAuditIssue[] {
  const packageJsonPaths = options.packageJsonPaths ?? DEFAULT_PACKAGE_JSON_PATHS;
  const issues: RegistryAuditIssue[] = [];

  for (const packageJsonPath of packageJsonPaths) {
    const scripts = readPackageScripts(options.repoRoot, packageJsonPath);
    if (isRegistryAuditIssue(scripts)) {
      issues.push(scripts);
      continue;
    }

    for (const [scriptName, command] of Object.entries(scripts)) {
      const targetPaths = resolveScriptCommandTargets(packageJsonPath, command);

      for (const targetPath of targetPaths) {
        if (!existsSync(join(options.repoRoot, targetPath))) {
          issues.push({
            code: 'SCRIPT_TARGET_MISSING',
            message: `Script ${scriptName} references missing target ${targetPath}`,
            path: targetPath,
            packageJsonPath,
            scriptName,
            command,
          });
        }
      }
    }
  }

  return sortIssues(issues);
}

function listFiles(rootPath: string, includeFile: (filePath: string) => boolean): string[] {
  if (!existsSync(rootPath)) {
    return [];
  }

  const files: string[] = [];

  for (const directoryEntry of readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = join(rootPath, directoryEntry.name);

    if (directoryEntry.isDirectory()) {
      files.push(...listFiles(entryPath, includeFile));
      continue;
    }

    if (directoryEntry.isFile() && includeFile(entryPath)) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function extractLocalImportSpecifiers(sourceText: string): string[] {
  const specifiers = new Set<string>();
  const patterns = [
    /^\s*(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
    /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      const specifier = match[1];

      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        specifiers.add(specifier.split('?')[0]);
      }
    }
  }

  return [...specifiers].sort();
}
function existingImportCandidate(candidatePath: string): boolean {
  return existsSync(candidatePath) && statSync(candidatePath).isFile();
}

function localImportExists(importerPath: string, specifier: string): boolean {
  const basePath = resolve(dirname(importerPath), specifier);
  const extension = extname(basePath);
  const candidates: string[] = [];

  if (extension.length > 0) {
    candidates.push(basePath);

    if (extension === '.js' || extension === '.mjs' || extension === '.cjs') {
      const withoutExtension = basePath.slice(0, -extension.length);
      candidates.push(`${withoutExtension}.ts`, `${withoutExtension}.tsx`);
    }
  } else {
    candidates.push(basePath);

    for (const resolveExtension of RESOLVE_EXTENSIONS) {
      candidates.push(`${basePath}${resolveExtension}`);
    }

    for (const resolveExtension of RESOLVE_EXTENSIONS) {
      candidates.push(join(basePath, `index${resolveExtension}`));
    }
  }

  return candidates.some(existingImportCandidate);
}

export function auditLocalScriptImports(options: LocalImportAuditOptions): RegistryAuditIssue[] {
  const scriptRoots = options.scriptRoots ?? DEFAULT_SCRIPT_ROOTS;
  const issues: RegistryAuditIssue[] = [];

  for (const scriptRoot of scriptRoots) {
    const absoluteScriptRoot = join(options.repoRoot, scriptRoot);
    const sourceFiles = listFiles(absoluteScriptRoot, (filePath) => SOURCE_EXTENSIONS.has(extname(filePath)));

    for (const sourceFile of sourceFiles) {
      const sourceText = readFileSync(sourceFile, 'utf8');
      const importerPath = repoRelative(options.repoRoot, sourceFile);

      for (const specifier of extractLocalImportSpecifiers(sourceText)) {
        if (!localImportExists(sourceFile, specifier)) {
          issues.push({
            code: 'LOCAL_IMPORT_MISSING',
            message: `${importerPath} imports missing local module ${specifier}`,
            path: normalizeRelativePath(join(dirname(importerPath), specifier)),
            importerPath,
            importSpecifier: specifier,
          });
        }
      }
    }
  }

  return sortIssues(issues);
}

function workspaceTargetToOsTarget(targetPath: string): string | null {
  if (!targetPath.startsWith('packages/workspace/')) {
    return null;
  }

  return `packages/os/${targetPath.slice('packages/workspace/'.length)}`;
}

function isWorkspaceOwned(scriptEntry: ScriptRegistryEntry): boolean {
  return scriptEntry.ownerPackage === 'workspace' || scriptEntry.migrationStatus === 'workspace-owned';
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function registryEntryByPackageScript(
  registry: ConsueloCoreRegistry,
  packageJsonPath: string,
  scriptName: string,
): ScriptRegistryEntry | undefined {
  return registry.scripts.find((scriptEntry) => {
    return scriptEntry.packageJsonPath === packageJsonPath && scriptEntry.scriptName === scriptName;
  });
}

function packageScriptTargetDriftIssues(options: OwnershipGuardrailOptions): RegistryAuditIssue[] {
  const issues: RegistryAuditIssue[] = [];

  for (const packageJsonPath of DEFAULT_PACKAGE_JSON_PATHS) {
    const scripts = readPackageScripts(options.repoRoot, packageJsonPath);

    if (isRegistryAuditIssue(scripts)) {
      continue;
    }

    for (const [scriptName, command] of Object.entries(scripts)) {
      const registryEntry = registryEntryByPackageScript(options.registry, packageJsonPath, scriptName);

      if (registryEntry === undefined) {
        continue;
      }

      const commandTargets = resolveScriptCommandTargets(packageJsonPath, command).sort();
      const registryTargets = [...registryEntry.resolvedTargets].sort();

      if (commandTargets.length === 0 || arraysEqual(commandTargets, registryTargets)) {
        continue;
      }

      issues.push({
        code: 'SCRIPT_TARGET_REGISTRY_DRIFT',
        message: `Script ${scriptName} resolves to ${commandTargets.join(', ')} but registry expects ${registryTargets.join(', ')}`,
        path: packageJsonPath,
        packageJsonPath,
        scriptName,
        command,
        registryEntryId: registryEntry.id,
        ownerPackage: registryEntry.ownerPackage,
      });
    }
  }

  return issues;
}

export function auditOwnershipGuardrails(options: OwnershipGuardrailOptions): RegistryAuditIssue[] {
  const issues: RegistryAuditIssue[] = [];

  for (const scriptEntry of options.registry.scripts) {
    if (!isWorkspaceOwned(scriptEntry)) {
      continue;
    }

    for (const targetPath of scriptEntry.resolvedTargets) {
      if (existsSync(join(options.repoRoot, targetPath))) {
        continue;
      }

      const osCopyPath = workspaceTargetToOsTarget(targetPath);
      const osCopyExists = osCopyPath !== null && existsSync(join(options.repoRoot, osCopyPath));

      issues.push({
        code: osCopyExists ? 'WORKSPACE_SOURCE_MISSING_WITH_OS_COPY' : 'WORKSPACE_OWNED_TARGET_MISSING',
        message: osCopyExists
          ? `Workspace-owned ${targetPath} is missing while ${osCopyPath} exists`
          : `Workspace-owned ${targetPath} is missing`,
        path: targetPath,
        registryEntryId: scriptEntry.id,
        ownerPackage: scriptEntry.ownerPackage,
      });
    }
  }

  issues.push(...packageScriptTargetDriftIssues(options));

  return sortIssues(issues);
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function listDriftFiles(repoRoot: string, scriptRoot: string): Map<string, string> {
  const absoluteScriptRoot = join(repoRoot, scriptRoot);
  const files = listFiles(absoluteScriptRoot, (filePath) => DRIFT_EXTENSIONS.has(extname(filePath)));
  const fileMap = new Map<string, string>();

  for (const filePath of files) {
    fileMap.set(repoRelative(absoluteScriptRoot, filePath), repoRelative(repoRoot, filePath));
  }

  return fileMap;
}

function registryEntryIdsForPath(registry: ConsueloCoreRegistry, targetPath: string): string[] {
  return registry.scripts
    .filter((scriptEntry) => scriptEntry.resolvedTargets.includes(targetPath))
    .map((scriptEntry) => scriptEntry.id)
    .sort();
}

export function buildDriftReport(options: OwnershipGuardrailOptions): RegistryDriftReport {
  const workspaceFiles = listDriftFiles(options.repoRoot, 'packages/workspace/scripts');
  const osFiles = listDriftFiles(options.repoRoot, 'packages/os/scripts');
  const duplicates = [...workspaceFiles.entries()]
    .filter(([relativePath]) => osFiles.has(relativePath))
    .map(([relativePath, workspacePath]) => {
      const osPath = osFiles.get(relativePath) ?? '';
      const workspaceHash = hashFile(join(options.repoRoot, workspacePath));
      const osHash = hashFile(join(options.repoRoot, osPath));

      return {
        relativePath,
        workspacePath,
        osPath,
        workspaceHash,
        osHash,
        sameHash: workspaceHash === osHash,
        workspaceOwner: 'workspace',
        osOwner: 'os',
        workspaceRegistryEntryIds: registryEntryIdsForPath(options.registry, workspacePath),
        osRegistryEntryIds: registryEntryIdsForPath(options.registry, osPath),
      };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return { duplicates };
}

export function runRegistryAudit(options: RegistryAuditOptions = {}): RegistryAuditCliOutput {
  const packageRoot = resolve(options.packageRoot ?? defaultPackageRoot());
  const repoRoot = resolve(options.repoRoot ?? defaultRepoRoot(packageRoot));
  const registry = loadConsueloCoreRegistry({ packageRoot, repoRoot });
  const issues = options.driftOnly
    ? []
    : [
        ...auditScriptTargets({ repoRoot }),
        ...auditLocalScriptImports({ repoRoot }),
        ...auditOwnershipGuardrails({ repoRoot, registry }),
      ];
  const drift = buildDriftReport({ repoRoot, registry });

  return {
    ok: issues.length === 0,
    issues: sortIssues(issues),
    drift,
    registry: {
      version: registry.version,
      packages: registry.packages.length,
      scripts: registry.scripts.length,
      tools: registry.tools.length,
      skills: registry.skills.length,
    },
  };
}
