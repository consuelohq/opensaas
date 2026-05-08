#!/usr/bin/env bun

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { resolveGitRoot } = require('./lib/paths');

const HOMEBREW_SQLITE_LIB = '/opt/homebrew/opt/sqlite/lib';

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run audit -- [options]');
  writeStdout('');
  writeStdout('check script/docs/index drift and truthfulness gaps.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --scripts  compare SCRIPTS.md against package.json scripts');
  writeStdout('  --docs     check markdown path references');
  writeStdout('  --index    check index freshness against current files');
  writeStdout('  --json     output structured json');
  writeStdout('  --help     show this help');
}

function parseArgs(argv) {
  const args = { docs: false, index: false, json: false, scripts: false };

  for (const argument of argv) {
    if (argument === '--scripts') args.scripts = true;
    else if (argument === '--docs') args.docs = true;
    else if (argument === '--index') args.index = true;
    else if (argument === '--json') args.json = true;
    else if (argument === '--help') args.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }

  if (!args.scripts && !args.docs && !args.index && !args.help) {
    args.scripts = true;
    args.docs = true;
    args.index = true;
  }

  return args;
}

function ensureSqliteExtensionEnvironment(args) {
  if (!args.index || process.platform !== 'darwin') return;
  if (process.env.WORKSPACE_AUDIT_DYLD_REEXEC === '1') return;

  const currentPath = process.env.DYLD_LIBRARY_PATH || '';
  if (currentPath.split(':').includes(HOMEBREW_SQLITE_LIB)) return;
  if (!fs.existsSync(HOMEBREW_SQLITE_LIB)) return;

  const result = spawnSync(process.execPath, [__filename, ...process.argv.slice(2)], {
    env: {
      ...process.env,
      DYLD_LIBRARY_PATH: currentPath ? `${HOMEBREW_SQLITE_LIB}:${currentPath}` : HOMEBREW_SQLITE_LIB,
      WORKSPACE_AUDIT_DYLD_REEXEC: '1',
    },
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getDocumentedScripts(repoRoot) {
  const scriptsPath = path.join(repoRoot, 'packages', 'workspace', 'SCRIPTS.md');
  const content = fs.readFileSync(scriptsPath, 'utf8');
  const scripts = new Set();
  const pattern = /^### ([a-z0-9:_-]+)\s+—/mg;
  let match = pattern.exec(content);

  while (match) {
    scripts.add(match[1]);
    match = pattern.exec(content);
  }

  return scripts;
}

function auditScripts(repoRoot) {
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  const actualScripts = new Set(Object.keys(packageJson.scripts || {}).filter((scriptName) => {
    const command = packageJson.scripts[scriptName];
    return String(command).includes('packages/workspace/scripts/');
  }));
  const documentedScripts = getDocumentedScripts(repoRoot);

  const missing = Array.from(documentedScripts).filter((scriptName) => !actualScripts.has(scriptName)).sort();
  const undocumented = Array.from(actualScripts).filter((scriptName) => !documentedScripts.has(scriptName)).sort();

  return {
    documented_count: documentedScripts.size,
    actual_count: actualScripts.size,
    missing,
    undocumented,
    passed: missing.length === 0 && undocumented.length === 0,
  };
}

function getMarkdownFiles(repoRoot) {
  const output = execFileSync('git', ['ls-files', '*.md', 'AGENTS.md'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return output.split('\n').filter(Boolean);
}

function auditDocs(repoRoot) {
  const missing = [];
  const pathPattern = /(?:^|[\s`(])((?:packages|scripts|src|\.kiro|\.task|docs)\/[A-Za-z0-9._/\-]+(?:\.[A-Za-z0-9]+)?)/g;

  for (const markdownPath of getMarkdownFiles(repoRoot)) {
    const content = fs.readFileSync(path.join(repoRoot, markdownPath), 'utf8');
    let match = pathPattern.exec(content);

    while (match) {
      const referencedPath = match[1].replace(/[),.;:]$/, '');
      if (!referencedPath.includes('*') && !fs.existsSync(path.join(repoRoot, referencedPath))) {
        missing.push({ document: markdownPath, path: referencedPath });
      }
      match = pathPattern.exec(content);
    }
  }

  return {
    missing_paths: missing.slice(0, 50),
    missing_count: missing.length,
    passed: missing.length === 0,
  };
}

function loadIndexAuditDependencies() {
  // Keep index-only native dependencies out of --scripts/--docs startup.
  const runtimeRequire = module.require.bind(module);
  return {
    ...runtimeRequire('./lib/index/chunker'),
    ...runtimeRequire('./lib/index/store'),
    ...runtimeRequire('./lib/index/indexer'),
  };
}

function auditIndex(repoRoot) {
  const { contentHash, createStore, getRemoteUrl, isIndexablePath } = loadIndexAuditDependencies();
  const store = createStore(repoRoot, getRemoteUrl(repoRoot));
  const stale = [];
  const deleted = [];

  for (const file of store.getFiles()) {
    const absolutePath = path.join(repoRoot, file.path);
    if (!fs.existsSync(absolutePath)) {
      deleted.push(file.path);
      continue;
    }

    if (!isIndexablePath(file.path)) continue;

    const currentHash = contentHash(fs.readFileSync(absolutePath, 'utf8'));
    if (currentHash !== file.content_hash) {
      stale.push(file.path);
    }
  }

  return {
    stale,
    deleted,
    stale_count: stale.length,
    deleted_count: deleted.length,
    stats: store.getStats(),
    passed: stale.length === 0 && deleted.length === 0,
  };
}

function getAuditRoot() {
  const taskWorktree = process.env.TASK_WORKTREE;
  if (taskWorktree && fs.existsSync(taskWorktree)) {
    return resolveGitRoot(taskWorktree);
  }

  return resolveGitRoot(process.cwd());
}

function printHuman(result) {
  if (result.scripts) {
    writeStdout('audit --scripts:');
    writeStdout(`  documented: ${result.scripts.documented_count}, actual: ${result.scripts.actual_count}`);
    if (result.scripts.missing.length === 0) writeStdout('  ok: all documented scripts exist');
    for (const scriptName of result.scripts.missing) writeStdout(`  missing script: ${scriptName}`);
    for (const scriptName of result.scripts.undocumented) writeStdout(`  undocumented script: ${scriptName}`);
    writeStdout('');
  }

  if (result.docs) {
    writeStdout('audit --docs:');
    writeStdout(`  missing path references: ${result.docs.missing_count}`);
    for (const item of result.docs.missing_paths.slice(0, 10)) {
      writeStdout(`  ${item.document}: ${item.path}`);
    }
    writeStdout('');
  }

  if (result.index) {
    writeStdout('audit --index:');
    writeStdout(`  stale: ${result.index.stale_count}, deleted: ${result.index.deleted_count}`);
    if (!result.index.passed) writeStdout('  run: bun run explore -- "<question>" --reindex');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  ensureSqliteExtensionEnvironment(args);

  const repoRoot = getAuditRoot();
  const result = {};

  if (args.scripts) result.scripts = auditScripts(repoRoot);
  if (args.docs) result.docs = auditDocs(repoRoot);
  if (args.index) result.index = auditIndex(repoRoot);

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  const failed = Object.values(result).some((section) => section && section.passed === false);
  if (failed) process.exitCode = 1;
}

try {
  Promise.resolve(main()).catch((err) => {
    writeStderr(err instanceof Error ? (err.stack || err.message) : String(err));
    process.exit(1);
  });
} catch (err /* unknown */) {
  writeStderr(err instanceof Error ? (err.stack || err.message) : String(err));
  process.exit(1);
}
