import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', cwd: repoRoot });
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result;
}

function resolveBaseRef() {
  if (process.env.DOCUMENTATION_BOUNDARY_BASE) return process.env.DOCUMENTATION_BOUNDARY_BASE;
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  const branch = git(['branch', '--show-current']).stdout.trim();
  if (branch.startsWith('task/documentation/')) return 'origin/stream/documentation';
  return 'origin/main';
}

const baseRef = resolveBaseRef();
const baseCheck = git(['rev-parse', '--verify', baseRef], { allowFailure: true });
if (baseCheck.status !== 0) throw new Error(`Documentation boundary base does not exist: ${baseRef}`);
const mergeBase = git(['merge-base', baseRef, 'HEAD']).stdout.trim();

const commands = [
  ['diff', '--name-only', `${mergeBase}...HEAD`],
  ['diff', '--name-only'],
  ['diff', '--cached', '--name-only'],
  ['status', '--porcelain', '--untracked-files=all'],
];
const files = new Set();
for (const args of commands) {
  const result = git(args);
  for (const line of result.stdout.split('\n')) {
    if (!line.trim()) continue;
    const file = args[0] === 'status' ? line.slice(3).trim() : line.trim();
    files.add(file.replace(/^"|"$/g, ''));
  }
}
const illegal = [...files].filter(
  (file) => !file.startsWith('packages/documentation/') && !file.startsWith('.task/'),
);
if (illegal.length) {
  process.stderr.write(`${JSON.stringify({ ok: false, baseRef, mergeBase, illegal }, null, 2)}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ ok: true, baseRef, mergeBase, checked: [...files].sort() }, null, 2)}\n`);
