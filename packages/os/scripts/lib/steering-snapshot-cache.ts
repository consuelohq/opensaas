import fs from 'node:fs';
import path from 'node:path';

import { readEffectiveCoreManifest } from './manifest';
import { manifestOverlayPath } from './manifest-overlay';
import { readSteeringSkillCatalog } from './steering-skills';

const PRIMARY_STEERING_FILES = ['system_prompt.md'] as const;
const EXCLUDED_STEERING_FILES = new Set([
  'steering.md',
  'decision.md',
  'example-system.md',
]);
const MAX_CACHE_ENTRIES = 64;

type SteeringSnapshotInput = {
  home: string;
  packageRoot: string;
  visibleSteeringDir: string;
  forceRefresh?: boolean;
};

type SteeringSnapshotCacheEntry = {
  content: string;
  sourceFingerprints: Map<string, string>;
};

const snapshotCache = new Map<string, SteeringSnapshotCacheEntry>();

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR'),
  );
}

function sourceFingerprint(filePath: string): string {
  const resolved = path.resolve(filePath);
  try {
    const stat = fs.statSync(resolved, { bigint: true });
    return [
      stat.dev,
      stat.ino,
      stat.mode,
      stat.size,
      stat.mtimeNs,
      stat.ctimeNs,
    ].join(':');
  } catch (error: unknown) {
    if (isMissingPathError(error)) return 'missing';
    throw error;
  }
}

function cacheKey(input: SteeringSnapshotInput): string {
  return [
    path.resolve(input.home),
    path.resolve(input.packageRoot),
    path.resolve(input.visibleSteeringDir),
  ].join('\u0000');
}

function dependenciesAreCurrent(sourceFingerprints: ReadonlyMap<string, string>): boolean {
  for (const [filePath, fingerprint] of sourceFingerprints) {
    if (sourceFingerprint(filePath) !== fingerprint) return false;
  }
  return true;
}

function rememberSnapshot(key: string, entry: SteeringSnapshotCacheEntry): void {
  snapshotCache.delete(key);
  snapshotCache.set(key, entry);
  while (snapshotCache.size > MAX_CACHE_ENTRIES) {
    const oldest = snapshotCache.keys().next().value as string | undefined;
    if (!oldest) break;
    snapshotCache.delete(oldest);
  }
}

function touchSnapshot(key: string, entry: SteeringSnapshotCacheEntry): void {
  snapshotCache.delete(key);
  snapshotCache.set(key, entry);
}

function isSupportedSteeringMarkdown(fileName: string): boolean {
  return fileName.endsWith('.md') && !EXCLUDED_STEERING_FILES.has(fileName.toLowerCase());
}

function createDependencyTracker(): {
  sourceFingerprints: Map<string, string>;
  track: (filePath: string) => void;
} {
  const sourceFingerprints = new Map<string, string>();
  return {
    sourceFingerprints,
    track(filePath: string): void {
      const resolved = path.resolve(filePath);
      if (!sourceFingerprints.has(resolved)) {
        sourceFingerprints.set(resolved, sourceFingerprint(resolved));
      }
    },
  };
}

function readIfExists(filePath: string, track: (filePath: string) => void): string {
  track(filePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readSteeringMarkdownFiles(
  steeringDir: string,
  track: (filePath: string) => void,
): Array<{ name: string; content: string }> {
  const sections: Array<{ name: string; content: string }> = [];
  const seen = new Set<string>();
  track(steeringDir);

  for (const fileName of PRIMARY_STEERING_FILES) {
    const content = readIfExists(path.join(steeringDir, fileName), track);
    seen.add(fileName);
    if (content) sections.push({ name: fileName, content });
  }

  if (!fs.existsSync(steeringDir)) return sections;

  const additionalFiles = fs.readdirSync(steeringDir)
    .filter((fileName) => !seen.has(fileName) && isSupportedSteeringMarkdown(fileName))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of additionalFiles) {
    const filePath = path.join(steeringDir, fileName);
    track(filePath);
    if (!fs.statSync(filePath).isFile()) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    if (content) sections.push({ name: fileName, content });
  }

  return sections;
}

function buildSteeringSnapshot(input: SteeringSnapshotInput): SteeringSnapshotCacheEntry {
  const dependencies = createDependencyTracker();
  const sections: string[] = [];

  for (const file of readSteeringMarkdownFiles(
    path.join(input.packageRoot, 'steering'),
    dependencies.track,
  )) {
    sections.push('', `# bundled ${file.name}`, '', file.content);
  }

  for (const file of readSteeringMarkdownFiles(input.visibleSteeringDir, dependencies.track)) {
    sections.push('', `# ${file.name}`, '', file.content);
  }

  dependencies.track(manifestOverlayPath(input.home));
  sections.push(
    '',
    '## Installed skills',
    '',
    'These compact entries describe the active skill catalog. When a request matches a skill trigger, load its entrypoint before proceeding. Skill bodies are not inlined here.',
    '',
    '```json',
    safeJson(readSteeringSkillCatalog({
      home: input.home,
      packageRoot: input.packageRoot,
      onDependency: dependencies.track,
    })),
    '```',
  );

  dependencies.track(path.join(input.packageRoot, 'manifests', 'generated', 'core.manifest.json'));
  sections.push(
    '',
    '# tool discovery routing',
    '',
    'Use core tools directly when present. Use tools.search when a tool, provider, deployment surface, product area, or workflow is mentioned but is not in core steering.',
    '',
    '# raw core tool manifest',
    '',
    '```json',
    safeJson(readEffectiveCoreManifest(input.home)),
    '```',
  );

  return {
    content: sections.join('\n'),
    sourceFingerprints: dependencies.sourceFingerprints,
  };
}

export function readSteeringSnapshot(input: SteeringSnapshotInput): string {
  const key = cacheKey(input);
  const cached = snapshotCache.get(key);
  if (!input.forceRefresh && cached && dependenciesAreCurrent(cached.sourceFingerprints)) {
    touchSnapshot(key, cached);
    return cached.content;
  }

  const built = buildSteeringSnapshot(input);
  if (dependenciesAreCurrent(built.sourceFingerprints)) {
    rememberSnapshot(key, built);
  } else {
    snapshotCache.delete(key);
  }
  return built.content;
}
