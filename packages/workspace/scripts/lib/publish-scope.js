const TASK_DIRECTORY = '.task';
const TASKS_DIRECTORY = 'tasks';

const SHARED_EXACT_PATHS = new Set([
  'AGENTS.md',
  'CODING-STANDARDS.md',
  'package.json',
  'bun.lockb',
  'bun.lock',
  'yarn.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'nx.json',
  'tsconfig.json',
  'tsconfig.base.json',
  'vitest.config.ts',
  'vitest.config.js',
]);

const SHARED_PREFIXES = [
  '.github/',
  'areas/',
];

const AREA_SHARED_PREFIXES = {
  os: [
    'packages/workspace/scripts/',
    'packages/workspace/tests/',
    'packages/workspace/SCRIPTS.md',
    'packages/workspace/TOOLS.md',
    'packages/workspace/STEERING.md',
    'packages/workspace/src/generated/',
    'packages/workspace/tooling/',
  ],
};

function normalizeRepoPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
}

function normalizeArea(area) {
  return String(area || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function getTaskSlug(taskBranch) {
  const parts = String(taskBranch || '').split('/');
  if (parts[0] !== 'task' || parts.length < 3) return '';
  return parts.slice(2).join('/');
}

function pathMatchesPrefix(filePath, prefix) {
  const normalizedPrefix = normalizeRepoPath(prefix);
  return filePath === normalizedPrefix.replace(/\/$/, '') || filePath.startsWith(normalizedPrefix);
}

function matchesAnyPrefix(filePath, prefixes) {
  return prefixes.some((prefix) => pathMatchesPrefix(filePath, prefix));
}

function classifyTaskMetadata(filePath, area, taskSlug, mode) {
  if (!filePath.startsWith(`${TASK_DIRECTORY}/`)) return null;

  const scopedTaskPrefix = `${TASK_DIRECTORY}/${area}/`;
  const taskHistoryPrefix = `${TASK_DIRECTORY}/${TASKS_DIRECTORY}/${area}/`;

  if (mode === 'stream') {
    if (filePath.startsWith(scopedTaskPrefix) || filePath.startsWith(taskHistoryPrefix)) {
      return { kind: 'metadata', reason: 'stream-area-task-metadata' };
    }
    return { kind: 'out-of-area', reason: 'other-area-task-metadata' };
  }

  if (taskSlug) {
    if (filePath.startsWith(`${scopedTaskPrefix}${taskSlug}/`)) {
      return { kind: 'metadata', reason: 'current-task-metadata' };
    }
    if (filePath === `${taskHistoryPrefix}${taskSlug}.json`) {
      return { kind: 'metadata', reason: 'current-task-history' };
    }
    return { kind: 'out-of-area', reason: 'other-task-metadata' };
  }

  if (filePath.startsWith(scopedTaskPrefix) || filePath.startsWith(taskHistoryPrefix)) {
    return { kind: 'metadata', reason: 'area-task-metadata' };
  }

  return { kind: 'out-of-area', reason: 'other-area-task-metadata' };
}

function getAreaPrefixes(area) {
  return [
    `${area}/`,
    `areas/${area}/`,
    `packages/${area}/`,
  ];
}

function getSharedPrefixes(area) {
  return [...SHARED_PREFIXES, ...(AREA_SHARED_PREFIXES[area] || [])];
}

function classifyPublishPath(rawPath, options = {}) {
  const filePath = normalizeRepoPath(rawPath);
  const area = normalizeArea(options.area);
  const mode = options.mode || 'task';
  const taskSlug = getTaskSlug(options.taskBranch);

  if (!area) {
    return { path: filePath, kind: 'shared', reason: 'missing-area-no-prune' };
  }

  const metadataClassification = classifyTaskMetadata(filePath, area, taskSlug, mode);
  if (metadataClassification) return { path: filePath, ...metadataClassification };

  if (matchesAnyPrefix(filePath, getAreaPrefixes(area))) {
    return { path: filePath, kind: 'area', reason: 'area-path' };
  }

  if (SHARED_EXACT_PATHS.has(filePath) || matchesAnyPrefix(filePath, getSharedPrefixes(area))) {
    return { path: filePath, kind: 'shared', reason: 'configured-shared-path' };
  }

  return { path: filePath, kind: 'out-of-area', reason: 'not-in-area-scope' };
}

function isPublishableClassification(classification) {
  return classification.kind === 'area' || classification.kind === 'metadata' || classification.kind === 'shared';
}

function createPublishPlan(files, options = {}) {
  const kept = [];
  const pruned = [];

  for (const file of files) {
    const classification = classifyPublishPath(file.path, options);
    const enriched = { ...file, classification };
    if (isPublishableClassification(classification)) {
      kept.push(enriched);
    } else {
      pruned.push(enriched);
    }
  }

  return {
    files: kept,
    pruned,
    keptCount: kept.length,
    prunedCount: pruned.length,
  };
}

function classifyStreamConflicts(conflictFiles, options = {}) {
  const prunablePaths = [];
  const manualPaths = [];
  const classifications = [];

  for (const filePath of conflictFiles) {
    const classification = classifyPublishPath(filePath, { ...options, mode: 'stream' });
    classifications.push(classification);
    if (classification.kind === 'out-of-area') {
      prunablePaths.push(classification.path);
    } else {
      manualPaths.push(classification.path);
    }
  }

  return {
    canAutoResolve: prunablePaths.length > 0 && manualPaths.length === 0,
    prunablePaths,
    manualPaths,
    classifications,
  };
}

module.exports = {
  classifyPublishPath,
  classifyStreamConflicts,
  createPublishPlan,
  getTaskSlug,
  normalizeArea,
  normalizeRepoPath,
};
