import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { ToolManifestEntry } from './facade/types';
import { resolveOverlayHome } from './manifest-overlay';
import { discoverSwampRuntimeTools } from './runtime-tool-providers/swamp';
import { resolveActiveWorkspaceProjectCwd } from './workspace-project-cwd';

type JsonObject = Record<string, unknown>;

export type RuntimeCanonicalManifestEntry = {
  name: string;
  kind: 'facade-tool';
  source: 'runtime-provider';
  sourcePath: string;
  category: string;
  description: string;
  core: false;
  definition: ToolManifestEntry;
};

type RuntimeToolCache = {
  version: 1;
  provider: 'swamp';
  cliPath: string;
  repoDir: string;
  discoveredAt: string;
  tools: RuntimeCanonicalManifestEntry[];
};

export type RuntimeToolRegistryOptions = {
  home?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  forceRefresh?: boolean;
};

const CACHE_TTL_MS = 15 * 60 * 1000;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findSwampRepo(start: string | undefined): string | undefined {
  if (!start) return undefined;
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, '.swamp.yaml'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function resolveSwampRepoDir(options: RuntimeToolRegistryOptions, env: NodeJS.ProcessEnv): string | undefined {
  const explicit = env.SWAMP_REPO_DIR?.trim();
  if (explicit) return findSwampRepo(explicit);

  const candidates = [
    options.cwd,
    env.CONSUELO_TOOL_CALLER_CWD,
    resolveActiveWorkspaceProjectCwd(),
  ];
  for (const candidate of candidates) {
    const repo = findSwampRepo(candidate);
    if (repo) return repo;
  }
  return undefined;
}

function cachePath(home: string, cliPath: string, repoDir: string): string {
  const key = createHash('sha256')
    .update(cliPath)
    .update('\0')
    .update(repoDir)
    .digest('hex')
    .slice(0, 24);
  return path.join(home, 'tool-providers', 'swamp', key + '.json');
}

function readCache(filePath: string, cliPath: string, repoDir: string): RuntimeToolCache | null {
  try {
    const stat = fs.statSync(filePath);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!isObject(parsed)
      || parsed.version !== 1
      || parsed.provider !== 'swamp'
      || parsed.cliPath !== cliPath
      || parsed.repoDir !== repoDir
      || typeof parsed.discoveredAt !== 'string'
      || !Array.isArray(parsed.tools)) {
      return null;
    }
    const tools = parsed.tools.filter((entry): entry is RuntimeCanonicalManifestEntry => {
      if (!isObject(entry) || entry.kind !== 'facade-tool' || entry.source !== 'runtime-provider') return false;
      if (!isObject(entry.definition) || !isObject(entry.definition.runtimeProvider)) return false;
      return entry.definition.runtimeProvider.provider === 'swamp';
    });
    return {
      version: 1,
      provider: 'swamp',
      cliPath,
      repoDir,
      discoveredAt: parsed.discoveredAt,
      tools,
    };
  } catch {
    return null;
  }
}

function writeCache(filePath: string, cache: RuntimeToolCache): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, '.' + path.basename(filePath) + '.' + process.pid + '.' + randomUUID() + '.tmp');
  try {
    fs.writeFileSync(tempPath, JSON.stringify(cache, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tempPath, filePath);
    fs.chmodSync(filePath, 0o600);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

function canonicalize(tool: ToolManifestEntry): RuntimeCanonicalManifestEntry {
  return {
    name: tool.name,
    kind: 'facade-tool',
    source: 'runtime-provider',
    sourcePath: 'runtime:swamp',
    category: tool.category,
    description: tool.description,
    core: false,
    definition: tool,
  };
}

export function readRuntimeToolManifestEntries(
  options: RuntimeToolRegistryOptions = {},
): RuntimeCanonicalManifestEntry[] {
  const env = options.env ?? process.env;
  const repoDir = resolveSwampRepoDir(options, env);
  if (!repoDir) return [];

  const cliPath = env.CONSUELO_SWAMP_BIN?.trim() || 'swamp';
  const home = resolveOverlayHome(options.home);
  const filePath = cachePath(home, cliPath, repoDir);

  if (!options.forceRefresh) {
    const cached = readCache(filePath, cliPath, repoDir);
    if (cached) return cached.tools;
  }

  const discoveredAt = new Date().toISOString();
  const discovered = discoverSwampRuntimeTools({
    cliPath,
    repoDir,
    env,
    discoveredAt,
  });
  if (!discovered) return [];

  const tools = discovered.map(canonicalize);
  writeCache(filePath, {
    version: 1,
    provider: 'swamp',
    cliPath,
    repoDir,
    discoveredAt,
    tools,
  });
  return tools;
}

function scalarSchemaType(schema: JsonObject): string {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  }
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      const itemType = isObject(schema.items) ? scalarSchemaType(schema.items) : 'unknown';
      return 'Array<' + itemType + '>';
    }
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

export function runtimeProviderInputSignature(entry: {
  runtimeProvider?: { inputSchema: Record<string, unknown> };
}): string | undefined {
  const schema = entry.runtimeProvider?.inputSchema;
  if (!schema || !isObject(schema)) return undefined;
  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((value): value is string => typeof value === 'string')
      : [],
  );
  const fields = Object.entries(properties).map(([key, value]) => {
    const type = isObject(value) ? scalarSchemaType(value) : 'unknown';
    return key + (required.has(key) ? '' : '?') + ': ' + type;
  });
  return '{ ' + fields.join('; ') + ' }';
}
