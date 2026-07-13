type PackageInfo = {
  dir: string;
  name: string;
  scripts: Record<string, string>;
  dependencies: string[];
};

const decoder = new TextDecoder();

function run(cmd: string[]) {
  const proc = Bun.spawnSync({ cmd, stdout: 'pipe', stderr: 'pipe' });
  return {
    command: cmd.join(' '),
    ok: proc.exitCode === 0,
    exitCode: proc.exitCode,
    stdout: decoder.decode(proc.stdout),
    stderr: decoder.decode(proc.stderr),
  };
}

function lines(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

const changed = unique(lines(run(['git', 'diff', '--name-only', 'HEAD']).stdout)
  .concat(lines(run(['git', 'diff', '--name-only', '--cached']).stdout)));
const packageJsonFiles = lines(run(['git', 'ls-files', '**/package.json']).stdout)
  .filter((path) => !path.includes('/node_modules/'));

const packages: PackageInfo[] = [];
for (const file of packageJsonFiles) {
  const json = JSON.parse(await Bun.file(file).text()) as {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dir = file.replace(/\/package\.json$/, '');
  packages.push({
    dir,
    name: json.name ?? dir,
    scripts: json.scripts ?? {},
    dependencies: unique([
      ...Object.keys(json.dependencies ?? {}),
      ...Object.keys(json.devDependencies ?? {}),
    ]),
  });
}

const impactedPackages = packages
  .filter((pkg) => changed.some((file) => file === pkg.dir || file.startsWith(pkg.dir + '/')))
  .map((pkg) => ({
    name: pkg.name,
    dir: pkg.dir,
    availableChecks: Object.keys(pkg.scripts).filter((script) => /^(test|lint|typecheck|build|verify)/.test(script)),
  }));

const sourceFiles = changed.filter((file) => /\.(ts|tsx|js|jsx)$/.test(file)).slice(0, 30);
const symbols = [];
for (const file of sourceFiles) {
  const text = await Bun.file(file).text();
  const exportNames = [...text.matchAll(/^export\s+(?:type\s+)?(?:const|function|class|type)\s+([A-Za-z0-9_]+)/gm)]
    .map((match) => match[1]);
  const imports = [...text.matchAll(/^import\s+.*?from\s+['"]([^'"]+)['"]/gm)]
    .map((match) => match[1]);
  const lineSpans = exportNames.length > 0 ? [{ from: 1, to: Math.min(40, text.split('\n').length) }] : [];
  const snippets = lineSpans.map((span) => ({ ...span, text: text.split('\n').slice(span.from - 1, span.to).join('\n') }));
  symbols.push({ file, exports: exportNames, imports, lineSpans, snippets });
}

const candidateCommands = impactedPackages.flatMap((pkg) =>
  pkg.availableChecks.slice(0, 3).map((script) => ({
    package: pkg.name,
    command: ['bun', 'run', '--cwd', pkg.dir, script].join(' '),
  })),
);

const repositoryImpact = {
  changedFiles: changed,
  packagesScanned: packages.length,
  impactedPackages,
  sourceFiles,
  symbols,
  candidateCommands,
  riskNotes: [
    changed.some((file) => file.includes('/migrations/')) ? 'migration touched: verify up/down behavior' : null,
    changed.some((file) => /manifest|schema|generated/.test(file)) ? 'generated/schema surface touched: run exact surface verification' : null,
    changed.some((file) => /security|auth|token|secret/i.test(file)) ? 'security-sensitive names touched: include failure-path tests' : null,
  ].filter(Boolean),
};

console.log(JSON.stringify({ ok: true, repositoryImpact }, null, 2));
