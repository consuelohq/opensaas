const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_REPO = 'consuelohq/opensaas';
const DEFAULT_MAIN_BRANCH = 'main';
const DEFAULT_WORKTREE_ROOT = path.join(os.tmpdir(), 'opensaas-worktrees');

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
  resolveGitRoot,
  toWorktreeDirectoryName,
};
