const files = [
  'errors.ts',
  'location.ts',
  'output.ts',
  'policy.ts',
  'process.ts',
  'runtime.ts',
  'runtimes.ts',
  'schema.ts',
  'service.ts',
  'snapshot.ts',
  'source.ts',
  'types.ts',
];

function gitShow(file: string): string {
  const proc = Bun.spawnSync({
    cmd: ['git', 'show', 'origin/stream/os:packages/os/scripts/lib/code-call/' + file],
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }

  return new TextDecoder().decode(proc.stdout);
}

const results = [];

for (const file of files) {
  const source = gitShow(file);
  const target = await Bun.file('packages/workspace/scripts/lib/code-call/' + file).text();

  results.push({
    file,
    exactMatch: source === target,
    sourceChars: source.length,
    targetChars: target.length,
  });
}

const ok = results.every((result) => result.exactMatch);
console.log(JSON.stringify({ ok, results }, null, 2));
process.exit(ok ? 0 : 1);
