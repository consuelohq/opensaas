const { appendFileSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const FRONT_SOURCE_ROOTS = [
  'packages/twenty-front/',
  'packages/twenty-ui/',
  'packages/twenty-shared/',
  'packages/twenty-sdk/',
];

const TEST_SELECTION_REGISTRY_PATH =
  'packages/workspace/test-selection.registry.json';

function globToRegExp(glob) {
  let out = '';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    const next = glob[index + 1];
    if (character === '*' && next === '*') {
      out += '.*';
      index += 1;
    } else if (character === '*') {
      out += '[^/]*';
    } else if ('\\.+?^${}()|[]'.includes(character)) {
      out += `\\${character}`;
    } else {
      out += character;
    }
  }
  return new RegExp(`^${out}$`);
}

function matchesPattern(file, pattern) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return file === prefix || file.startsWith(`${prefix}/`);
  }
  return globToRegExp(pattern).test(file);
}

function isExclusivelyOwnedFrontendPath(file, registry) {
  return (registry?.rules ?? []).some((rule) =>
    rule.exclusive
    && (rule.source ?? []).some((pattern) => matchesPattern(file, pattern))
    && !(rule.exclude ?? []).some((pattern) => matchesPattern(file, pattern))
  );
}

function isFrontendSourcePath(file) {
  if (!FRONT_SOURCE_ROOTS.some((root) => file.startsWith(root))) return false;
  if (/\/eslint\.config\.[cm]?[jt]s$/.test(file)) return false;
  if (file === 'packages/twenty-sdk/package.json') return false;
  return true;
}

function withoutWorkspacePackages(packageJson) {
  const clone = structuredClone(packageJson);
  if (clone.workspaces && typeof clone.workspaces === 'object') {
    delete clone.workspaces.packages;
    if (Object.keys(clone.workspaces).length === 0) delete clone.workspaces;
  }
  return clone;
}

function workspacePackageChanges(basePackage, headPackage) {
  const before = new Set(basePackage.workspaces?.packages ?? []);
  const after = new Set(headPackage.workspaces?.packages ?? []);
  return [...new Set([
    ...[...before].filter((entry) => !after.has(entry)),
    ...[...after].filter((entry) => !before.has(entry)),
  ])].sort();
}

function isLintPackageWorkspaceMigration(basePackage, headPackage) {
  const beforeWithoutWorkspaces = withoutWorkspacePackages(basePackage);
  const afterWithoutWorkspaces = withoutWorkspacePackages(headPackage);
  if (JSON.stringify(beforeWithoutWorkspaces) !== JSON.stringify(afterWithoutWorkspaces)) {
    return false;
  }

  const changes = workspacePackageChanges(basePackage, headPackage);
  return changes.length > 0 && changes.every((entry) =>
    entry === 'packages/eslint-rules' || entry === 'packages/twenty-eslint-rules'
  );
}

function isIsolatedOsWorkspaceMigration(basePackage, headPackage) {
  const beforeWithoutWorkspaces = withoutWorkspacePackages(basePackage);
  const afterWithoutWorkspaces = withoutWorkspacePackages(headPackage);
  if (JSON.stringify(beforeWithoutWorkspaces) !== JSON.stringify(afterWithoutWorkspaces)) {
    return false;
  }

  const changes = workspacePackageChanges(basePackage, headPackage);
  return changes.length > 0 && changes.every((entry) => entry === 'packages/os');
}

function classifyFrontSourceChange({
  changedFiles,
  basePackage,
  headPackage,
  registry = { rules: [] },
}) {
  const frontendSourceFiles = changedFiles.filter(isFrontendSourcePath);
  const broadFrontendSourceFiles = frontendSourceFiles.filter(
    (file) => !isExclusivelyOwnedFrontendPath(file, registry),
  );
  if (broadFrontendSourceFiles.length > 0) {
    return { sourceChanged: true, reason: 'frontend-source' };
  }

  const packageChanged = changedFiles.includes('package.json');
  const packageDataAvailable = Boolean(basePackage && headPackage);
  const lintWorkspaceMigration = packageChanged && packageDataAvailable
    ? isLintPackageWorkspaceMigration(basePackage, headPackage)
    : false;
  const isolatedOsWorkspaceMigration = packageChanged && packageDataAvailable
    ? isIsolatedOsWorkspaceMigration(basePackage, headPackage)
    : false;

  if (changedFiles.includes('yarn.lock')) {
    if (lintWorkspaceMigration) {
      return { sourceChanged: false, reason: 'eslint-workspace-migration' };
    }
    if (isolatedOsWorkspaceMigration) {
      return { sourceChanged: false, reason: 'isolated-workspace-migration' };
    }
    return { sourceChanged: true, reason: 'yarn-lock' };
  }

  if (packageChanged) {
    if (!basePackage || !headPackage) {
      return { sourceChanged: true, reason: 'package-json-unavailable' };
    }
    if (lintWorkspaceMigration) {
      return { sourceChanged: false, reason: 'eslint-workspace-migration' };
    }
    if (isolatedOsWorkspaceMigration) {
      return { sourceChanged: false, reason: 'isolated-workspace-migration' };
    }
    return { sourceChanged: true, reason: 'package-json' };
  }

  if (frontendSourceFiles.length > 0) {
    return { sourceChanged: false, reason: 'exclusive-frontend-contract' };
  }
  return { sourceChanged: false, reason: 'configuration-only' };
}

function gitText(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function eventRevisions() {
  const event = process.env.GITHUB_EVENT_PATH
    ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
    : {};
  return {
    base: event.pull_request?.base?.sha ?? event.merge_group?.base_sha,
    head: event.pull_request?.head?.sha ?? event.merge_group?.head_sha ?? process.env.GITHUB_SHA,
  };
}

function main() {
  const { base, head } = eventRevisions();
  if (!base || !head) throw new Error('Could not resolve base/head revisions from the GitHub event');

  const changedFiles = gitText(['diff', '--name-only', `${base}...${head}`])
    .split(/\r?\n/)
    .filter(Boolean);
  const packageChanged = changedFiles.includes('package.json');
  const basePackage = packageChanged
    ? JSON.parse(gitText(['show', `${base}:package.json`]))
    : undefined;
  const headPackage = packageChanged
    ? JSON.parse(gitText(['show', `${head}:package.json`]))
    : undefined;
  const registry = JSON.parse(readFileSync(TEST_SELECTION_REGISTRY_PATH, 'utf8'));
  const result = classifyFrontSourceChange({
    changedFiles,
    basePackage,
    headPackage,
    registry,
  });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `source_changed=${String(result.sourceChanged)}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `reason=${result.reason}\n`);
  }
  process.stdout.write(`${JSON.stringify({ ...result, base, head, changedFiles }, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = {
  classifyFrontSourceChange,
  isExclusivelyOwnedFrontendPath,
  isFrontendSourcePath,
  isIsolatedOsWorkspaceMigration,
  isLintPackageWorkspaceMigration,
};
