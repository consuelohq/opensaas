const expected = 'Run focused repo-scoped Python, Bun, or Bash programs where runtime output is the evidence: tests, package scripts, typechecks, syntax checks, exact CLI reproduction, small diagnostics, and bounded data shaping inside the active task worktree. Prefer compact packets with paths, line spans, and extracted snippets over raw file dumps.';

const files = [
  'packages/workspace/tooling/tool-manifest.json',
  'packages/workspace/manifests/tool-manifest.json',
  'packages/workspace/manifests/core-manifest.json',
  'packages/os/tooling/dev-tool-manifest.json',
  'packages/os/manifests/tool.manifest.json',
  'packages/os/manifests/core.manifest.json',
];

const report = [];

for (const file of files) {
  const parsed = JSON.parse(await Bun.file(file).text());
  const tools = Array.isArray(parsed) ? parsed : parsed.tools;
  const entry = tools.find((tool: { name?: string }) => tool.name === 'code.call');

  report.push({
    file,
    found: Boolean(entry),
    matches: entry?.description === expected,
  });
}

const ok = report.every((item) => item.found && item.matches);
console.log(JSON.stringify({ ok, report }, null, 2));
process.exit(ok ? 0 : 1);
