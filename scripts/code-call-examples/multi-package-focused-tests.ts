const commands = [
  ['bun', '--cwd', 'packages/workspace', 'test', 'tests/workflow-intent.test.ts', 'tests/tool-manifest.test.ts'],
  ['bun', '--cwd', 'packages/os', 'test', 'tests/tool-manifest.test.ts'],
  ['bun', '--cwd', 'packages/workspace', 'test', 'tests/facade/facade.test.ts', '-t', 'code.call'],
];

const results = [];

for (const cmd of commands) {
  const proc = Bun.spawnSync({ cmd, stdout: 'pipe', stderr: 'pipe' });
  const stdout = new TextDecoder().decode(proc.stdout);
  const stderr = new TextDecoder().decode(proc.stderr);
  const result = {
    command: cmd.join(' '),
    ok: proc.exitCode === 0,
    exitCode: proc.exitCode,
    stdout: stdout.slice(-12000),
    stderr: stderr.slice(-12000),
  };

  results.push(result);

  if (proc.exitCode !== 0) {
    console.log(JSON.stringify({ ok: false, failed: result, results }, null, 2));
    process.exit(proc.exitCode ?? 1);
  }
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
