import { spawnSync } from 'node:child_process';

const commands = [
  ['git', ['diff', '--name-only']],
  ['git', ['diff', '--cached', '--name-only']],
  ['git', ['status', '--porcelain', '--untracked-files=all']],
];
const files = new Set();
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { encoding: 'utf8', cwd: '../..' });
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
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
  process.stderr.write(`${JSON.stringify({ ok: false, illegal }, null, 2)}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ ok: true, checked: [...files].sort() }, null, 2)}\n`);
