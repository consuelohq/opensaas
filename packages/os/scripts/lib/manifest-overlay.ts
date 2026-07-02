import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ManifestOverlay = {
  version: 1;
  disabledSkills: string[];
  disabledTools: string[];
  disabledWorkflows: string[];
  updatedAt: string | null;
};

export type ManifestOverlayPatch = {
  kind: 'tool' | 'skill' | 'workflow';
  name: string;
  enabled: boolean;
};

export type ManifestOverlayValidationIssue = {
  code: string;
  message: string;
};

type CanonicalManifestEntry = {
  name: string;
  kind: 'os-skill' | 'facade-tool';
};

type CanonicalToolManifest = {
  version: 1;
  tools: CanonicalManifestEntry[];
};

type WorkflowBundlesFile = {
  workflows?: Array<{ id?: string }>;
};

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const overlayFileName = 'manifest.overlay.json';

function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function resolveOverlayHome(home?: string): string {
  const candidate = home ?? process.env.CONSUELO_OS_HOME ?? process.env.CONSUELO_HOME ?? '~/.consuelo/os';
  return path.resolve(expandHome(candidate));
}

export function manifestOverlayPath(home?: string): string {
  return path.join(resolveOverlayHome(home), 'security', 'overrides', overlayFileName);
}

export function emptyManifestOverlay(): ManifestOverlay {
  return {
    version: 1,
    disabledSkills: [],
    disabledTools: [],
    disabledWorkflows: [],
    updatedAt: null,
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function readJsonFile<TData>(filePath: string): TData | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TData;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp`);
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function readPackageToolManifest(): CanonicalToolManifest {
  const manifestPath = path.join(packageRoot, 'manifests', 'tool.manifest.json');
  const parsed = readJsonFile<CanonicalToolManifest>(manifestPath);
  if (!parsed || !Array.isArray(parsed.tools)) {
    throw new Error(`${manifestPath}: expected generated OS tool manifest with tools array`);
  }
  return parsed;
}

function readWorkflowIds(): string[] {
  const bundlesPath = path.join(packageRoot, 'manifests', 'workflow-bundles.json');
  const bundles = readJsonFile<WorkflowBundlesFile>(bundlesPath);
  return (bundles?.workflows ?? [])
    .map((workflow) => workflow.id)
    .filter((id): id is string => typeof id === 'string');
}

export function readManifestOverlay(home?: string): ManifestOverlay {
  const overlayPath = manifestOverlayPath(home);
  if (!fs.existsSync(overlayPath)) return emptyManifestOverlay();

  const parsed = readJsonFile<Partial<ManifestOverlay>>(overlayPath);
  if (!parsed || parsed.version !== 1) return emptyManifestOverlay();

  return {
    version: 1,
    disabledSkills: uniqueSorted(Array.isArray(parsed.disabledSkills) ? parsed.disabledSkills.filter((value): value is string => typeof value === 'string') : []),
    disabledTools: uniqueSorted(Array.isArray(parsed.disabledTools) ? parsed.disabledTools.filter((value): value is string => typeof value === 'string') : []),
    disabledWorkflows: uniqueSorted(Array.isArray(parsed.disabledWorkflows) ? parsed.disabledWorkflows.filter((value): value is string => typeof value === 'string') : []),
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
  };
}

export function validateManifestOverlayPatch(patch: ManifestOverlayPatch): ManifestOverlayValidationIssue | null {
  const name = patch.name.trim();
  if (!name) return { code: 'INVALID_OVERLAY_NAME', message: 'Overlay patch requires a non-empty name.' };

  const manifest = readPackageToolManifest();
  const workflowIds = new Set(readWorkflowIds());

  if (patch.kind === 'tool') {
    const exists = manifest.tools.some((entry) => entry.kind === 'facade-tool' && entry.name === name);
    return exists ? null : { code: 'UNKNOWN_TOOL', message: `Tool is not present in the generated manifest: ${name}` };
  }

  if (patch.kind === 'skill') {
    const exists = manifest.tools.some((entry) => entry.kind === 'os-skill' && entry.name === name);
    return exists ? null : { code: 'UNKNOWN_SKILL', message: `Skill is not present in the generated manifest: ${name}` };
  }

  return workflowIds.has(name)
    ? null
    : { code: 'UNKNOWN_WORKFLOW', message: `Workflow is not present in workflow bundles: ${name}` };
}

export function applyManifestOverlay<TManifest extends { tools: CanonicalManifestEntry[] }>(
  manifest: TManifest,
  overlay: ManifestOverlay,
): TManifest {
  const disabledSkills = new Set(overlay.disabledSkills);
  const disabledTools = new Set(overlay.disabledTools);

  return {
    ...manifest,
    tools: manifest.tools.filter((entry) => {
      if (entry.kind === 'os-skill') return !disabledSkills.has(entry.name);
      return !disabledTools.has(entry.name);
    }),
  };
}

export function patchManifestOverlay(home: string, patch: ManifestOverlayPatch): ManifestOverlay {
  const validationIssue = validateManifestOverlayPatch(patch);
  if (validationIssue) throw new Error(validationIssue.message);

  const overlay = readManifestOverlay(home);
  const name = patch.name.trim();
  const listKey = patch.kind === 'skill'
    ? 'disabledSkills'
    : patch.kind === 'tool'
      ? 'disabledTools'
      : 'disabledWorkflows';
  const current = new Set(overlay[listKey]);

  if (patch.enabled) current.delete(name);
  else current.add(name);

  const nextOverlay: ManifestOverlay = {
    version: 1,
    disabledSkills: listKey === 'disabledSkills' ? uniqueSorted([...current]) : overlay.disabledSkills,
    disabledTools: listKey === 'disabledTools' ? uniqueSorted([...current]) : overlay.disabledTools,
    disabledWorkflows: listKey === 'disabledWorkflows' ? uniqueSorted([...current]) : overlay.disabledWorkflows,
    updatedAt: new Date().toISOString(),
  };

  writeJsonAtomic(manifestOverlayPath(home), nextOverlay);
  return nextOverlay;
}

export function writeManifestOverlay(home: string, overlay: ManifestOverlay): ManifestOverlay {
  const nextOverlay: ManifestOverlay = {
    version: 1,
    disabledSkills: uniqueSorted(overlay.disabledSkills),
    disabledTools: uniqueSorted(overlay.disabledTools),
    disabledWorkflows: uniqueSorted(overlay.disabledWorkflows),
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(manifestOverlayPath(home), nextOverlay);
  return nextOverlay;
}

export function isManifestItemEnabled(
  overlay: ManifestOverlay,
  kind: 'tool' | 'skill' | 'workflow',
  name: string,
): boolean {
  if (kind === 'skill') return !overlay.disabledSkills.includes(name);
  if (kind === 'tool') return !overlay.disabledTools.includes(name);
  return !overlay.disabledWorkflows.includes(name);
}