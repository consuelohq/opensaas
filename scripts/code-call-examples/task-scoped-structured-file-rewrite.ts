const mappings = [
  ['packages/os/tests/code-call.test.ts', 'packages/workspace/tests/code-call.test.ts'],
  ['packages/os/tests/code-call-service-architecture.test.ts', 'packages/workspace/tests/code-call-service-architecture.test.ts'],
];

function gitShow(path: string): string {
  const proc = Bun.spawnSync({
    cmd: ['git', 'show', 'origin/stream/os:' + path],
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode !== 0) {
    throw new Error('git show failed for ' + path + ': ' + new TextDecoder().decode(proc.stderr));
  }

  return new TextDecoder().decode(proc.stdout);
}

const written = [];

for (const [sourcePath, targetPath] of mappings) {
  const text = gitShow(sourcePath)
    .replaceAll('os-code-call-', 'workspace-code-call-')
    .replaceAll('task-os-code-call-', 'task-workspace-code-call-');

  await Bun.write(targetPath, text);

  written.push({
    sourcePath,
    targetPath,
    chars: text.length,
    lines: text.split('\n').length,
  });
}

console.log(JSON.stringify({ ok: true, written }, null, 2));
