import fs from 'node:fs';
import path from 'node:path';

import { readEffectiveCoreManifest } from './manifest';
import { manifestOverlayPath } from './manifest-overlay';
import { readSteeringSkillCatalog } from './steering-skills';

const PRIMARY_STEERING_FILES = ['system.md'] as const;
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

  for (const file of readSteeringMarkdownFiles(input.visibleSteeringDir, dependencies.track)) {
    sections.push('', `# ${file.name}`, '', file.content);
  }

  dependencies.track(manifestOverlayPath(input.home));
  const catalog = readSteeringSkillCatalog({
    home: input.home,
    packageRoot: input.packageRoot,
    onDependency: dependencies.track,
  });
  sections.push(
    '',
    '## Installed skills',
    '',
    'When a description matches the request, load that skill from the installed Skills directory before using it. Skill bodies are not inlined.',
    '',
    ...catalog.skills.map((skill) =>
      `- **${skill.title ?? skill.name}**${skill.description ? ` — ${skill.description}` : ''}`
    ),
    ...(catalog.truncated ? [`- ${catalog.truncated} more installed skills omitted`] : []),
  );

  dependencies.track(path.join(input.packageRoot, 'manifests', 'generated', 'core.manifest.json'));
  const coreNames = readEffectiveCoreManifest(input.home).tools.map((tool) => tool.name);
  const enabled = new Set(coreNames);
  // Keep the first-call shape near steering, not the entire generated manifest.
  // Each example is an os.call transport contract (not a shell command). All
  // detailed, evolving schemas and additional examples live in tools.search.
  // Filtering against the effective manifest prevents advertising disabled tools.
  const quickCalls: Array<{ tool: string; text: string }> = [
    {
      tool: 'tools.search',
      text: `Discover exact typed contract: \`os.call({tool:"tools.search",input:{query:"${enabled.has('code.call') ? 'code.call' : (coreNames.find((name) => name !== 'tools.search') ?? 'tools.search')}",detail:"full"}})\`. Use returned inputSignature and exampleInput; search non-core tools by domain.`,
    },
    {
      tool: 'session.start',
      text: 'Start isolated repo work: `os.call({tool:"session.start",input:{kind:"task",area:"os",title:"Fix bug",startFrom:"main"}})`. For local files use kind:"work" instead. Carry returned session ID.',
    },
    {
      tool: 'code.call',
      text: 'Read/verify/edit with bounded code: `os.call({tool:"code.call",input:{language:"bun",mode:"read",code:"process.stdout.write(String(1))",maxResultChars:2000},taskSession:"tsk_..."})`. Use mode:"verify" for tests; codeFile:"path/to/script.ts" for larger programs.',
    },
    {
      tool: 'fs.apply_patch',
      text: 'Modify scoped source: `os.call({tool:"fs.apply_patch",input:{patchText:"*** Begin Patch\\n..."},taskSession:"tsk_..."})`. Prefer typed file or stdin transport to shell-escaped payloads.',
    },
    {
      tool: 'batch',
      text: 'Group bounded calls: `os.call({tool:"batch",input:{steps:[{tool:"tools.search",input:{query:"google"}},{tool:"tools.search",input:{query:"linear"}}]}})`. Parallelize independent reads; serialize dependent writes.',
    },
    {
      tool: 'github',
      text: 'Read normalized review findings: `os.call({tool:"github",input:{operation:"pr.reviews",pr:123}})`. Do not substitute raw CLI for typed operations without a reason.',
    },
    {
      tool: 'review.run',
      text: 'Review a managed task: `os.call({tool:"review.run",input:{strict:true},taskSession:"tsk_..."})`. Discover verify and task.push when publishing; preserve CI checks.',
    },
  ];
  sections.push(
    '',
    '## Core tools',
    '',
    'Available core tool names (disabled tools excluded):',
    '',
    coreNames.join(', '),
    '',
    '### Reliable tool transport',
    '',
    'Use `os.call({tool:"NAME",input:{...},taskSession:"tsk_..."})` or the equivalent host wrapper. Tool name, taskSession/workSession and optional nodeId are top-level call fields, never nested inside input. Scope repo edits to task sessions; use work sessions for ordinary local files. Unknown target nodes fail closed.',
    '',
    ...quickCalls
      .filter((call) => enabled.has(call.tool)
        && (call.tool !== 'batch' || enabled.has('tools.search')))
      .map((call) => `- ${call.text}`),
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
