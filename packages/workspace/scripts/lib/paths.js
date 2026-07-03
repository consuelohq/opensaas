const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse: parseYaml } = require('yaml');

const FALLBACK_REPO = 'consuelohq/opensaas';
const DEFAULT_MAIN_BRANCH = 'main';
const DEFAULT_WORKTREE_ROOT = path.join(os.tmpdir(), 'opensaas-worktrees');

function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function normalizeConsueloHome(value) {
  const resolved = path.resolve(expandHome(value));
  return path.basename(resolved) === 'os' && path.basename(path.dirname(resolved)) === '.consuelo'
    ? path.dirname(resolved)
    : resolved;
}

function getConsueloHome() {
  return normalizeConsueloHome(process.env.CONSUELO_HOME || process.env.CONSUELO_OS_HOME || '~/.consuelo');
}

function readYamlObject(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const parsed = parseYaml(fs.readFileSync(filePath, 'utf8'));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
}

function firstWorkspaceConfigPath(home) {
  const workspacesDir = path.join(home, 'workspaces');
  if (!fs.existsSync(workspacesDir)) return null;
  for (const entry of fs.readdirSync(workspacesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(workspacesDir, entry.name, 'shared', 'workspace.yaml');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function workspaceConfigPathFromHome(home) {
  if (process.env.CONSUELO_WORKSPACE_CONFIG) return path.resolve(expandHome(process.env.CONSUELO_WORKSPACE_CONFIG));
  const globalConfig = readYamlObject(path.join(home, 'consuelo.yaml'));
  const activeWorkspace = typeof globalConfig?.activeWorkspace === 'string' ? globalConfig.activeWorkspace : null;
  if (activeWorkspace) return path.join(home, 'workspaces', activeWorkspace, 'shared', 'workspace.yaml');
  return firstWorkspaceConfigPath(home);
}

function resolveRepoFromWorkspaceConfig(filePath) {
  const config = readYamlObject(filePath);
  if (!config) return null;
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const defaults = config.defaults && typeof config.defaults === 'object' ? config.defaults : {};
  const defaultProjectId = typeof defaults.project === 'string' ? defaults.project : null;
  const selected = projects.find((project) => project && typeof project === 'object' && project.id === defaultProjectId)
    || projects.find((project) => project && typeof project === 'object');
  return typeof selected?.repo === 'string' && selected.repo.includes('/') ? selected.repo : null;
}

function resolveDefaultRepo(override) {
  if (override) return override;
  if (process.env.CONSUELO_REPO) return process.env.CONSUELO_REPO;
  try {
    const home = getConsueloHome();
    const workspaceConfigPath = workspaceConfigPathFromHome(home);
    return workspaceConfigPath ? resolveRepoFromWorkspaceConfig(workspaceConfigPath) || FALLBACK_REPO : FALLBACK_REPO;
  } catch {
    return FALLBACK_REPO;
  }
}

const DEFAULT_REPO = resolveDefaultRepo();

function resolveGitRoot(cwd) {
  return execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
}

function getWorktreeRoot(override) {
  return override || process.env.WORKSPACE_WORKTREE_ROOT || process.env.OPENSAAS_WORKTREE_ROOT || DEFAULT_WORKTREE_ROOT;
}

function toWorktreeDirectoryName(branch) {
  return branch.replace(/\//g, '-');
}

function getPackageRoot() {
  return path.resolve(__dirname, '..', '..');
}

module.exports = {
  DEFAULT_MAIN_BRANCH,
  DEFAULT_REPO,
  getPackageRoot,
  getWorktreeRoot,
  resolveDefaultRepo,
  resolveGitRoot,
  toWorktreeDirectoryName,
};
