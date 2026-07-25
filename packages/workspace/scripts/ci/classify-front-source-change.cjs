const { appendFileSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const FRONT_SOURCE_ROOTS = [
  'packages/twenty-front/',
  'packages/twenty-ui/',
  'packages/twenty-shared/',
  'packages/twenty-sdk/',
];

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

function classifyFrontSourceChange({ changedFiles, basePackage, headPackage }) {
  if (changedFiles.includes('yarn.lock')) {
    return { sourceChanged: true, reason: 'yarn-lock' };
  }
  if (changedFiles.some(isFrontendSourcePath)) {
    return { sourceChanged: true, reason: 'frontend-source' };
  }
  if (changedFiles.includes('package.json')) {
    if (!basePackage || !headPackage) {
      return { sourceChanged: true, reason: 'package-json-unavailable' };
    }
    if (!isLintPackageWorkspaceMigration(basePackage, headPackage)) {
      return { sourceChanged: true, reason: 'package-json' };
    }
    return { sourceChanged: false, reason: 'eslint-workspace-migration' };
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
  const result = classifyFrontSourceChange({ changedFiles, basePackage, headPackage });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `source_changed=${String(result.sourceChanged)}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `reason=${result.reason}\n`);
  }
  process.stdout.write(`${JSON.stringify({ ...result, base, head, changedFiles }, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = {
  classifyFrontSourceChange,
  isFrontendSourcePath,
  isLintPackageWorkspaceMigration,
};
