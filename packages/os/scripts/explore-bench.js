#!/usr/bin/env bun

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { ensureIndex, getRemoteUrl } = require('./lib/index/indexer');
const { createStore } = require('./lib/index/store');
const { evaluateBenchmark, renderBenchmarkMarkdown, validateBenchmarkCases } = require('./lib/explore-bench');
const { retrieve } = require('./lib/search/retriever');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function packageRoot() {
  return path.resolve(__dirname, '..');
}

function repoRoot() {
  return path.resolve(packageRoot(), '..', '..');
}

function relativeToRepo(filePath) {
  const relative = path.relative(repoRoot(), filePath);
  return relative.startsWith('..') ? path.basename(filePath) : relative;
}

function printHelp() {
  writeStdout('usage: bun run explore:benchmark -- [options]');
  writeStdout('');
  writeStdout('measure agent-facing Consuelo OS Explore retrieval without mutating Explore evidence state.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --cases <path>       benchmark cases JSON (default: explore-bench/cases.v1.json)');
  writeStdout('  --case <id>          run one case; repeat to run a bounded subset');
  writeStdout('  --budget <n>         files returned per case (default: 10)');
  writeStdout('  --depth <n>          graph expansion depth (default: 2)');
  writeStdout('  --refresh-index      refresh changed files before ranking (default: frozen existing index)');
  writeStdout('  --output-dir <path>  write <name>.json and <name>.md');
  writeStdout('  --name <slug>        report filename/title suffix (default: explore-bench)');
  writeStdout('  --json               print JSON instead of Markdown');
  writeStdout('  --help               show this help');
}

function parseArgs(argv) {
  const args = {
    budget: 10,
    cases: path.join(packageRoot(), 'explore-bench', 'cases.v1.json'),
    caseIds: [],
    depth: 2,
    json: false,
    name: 'explore-bench',
    outputDir: null,
    refreshIndex: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--cases':
        args.cases = path.resolve(argv[++index]);
        break;
      case '--case':
        args.caseIds.push(argv[++index]);
        break;
      case '--budget':
        args.budget = Number.parseInt(argv[++index], 10);
        break;
      case '--depth':
        args.depth = Number.parseInt(argv[++index], 10);
        break;
      case '--output-dir':
        args.outputDir = path.resolve(argv[++index]);
        break;
      case '--name':
        args.name = argv[++index];
        break;
      case '--refresh-index':
        args.refreshIndex = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown flag: ${argument}`);
    }
  }

  if (!Number.isFinite(args.budget) || args.budget <= 0) {
    throw new Error('--budget must be a positive number');
  }
  if (!Number.isFinite(args.depth) || args.depth < 0) {
    throw new Error('--depth must be zero or greater');
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(args.name)) {
    throw new Error('--name must be a filesystem-safe slug');
  }

  return args;
}

function loadBenchmarkCases(filePath, selectedIds) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed?.cases)) {
    throw new Error('benchmark case file must have schemaVersion=1 and a cases array');
  }
  validateBenchmarkCases(parsed.cases);
  if (!selectedIds.length) return parsed.cases;

  const selected = new Set(selectedIds);
  const cases = parsed.cases.filter((benchmarkCase) => selected.has(benchmarkCase.id));
  const missing = Array.from(selected).filter((id) => !cases.some((benchmarkCase) => benchmarkCase.id === id));
  if (missing.length > 0) throw new Error(`unknown benchmark case id(s): ${missing.join(', ')}`);
  return cases;
}

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
  } catch {
    return null;
  }
}

async function rankCases(cases, args) {
  const root = repoRoot();
  const indexResult = args.refreshIndex
    ? await ensureIndex({ cwd: root, json: true, reindex: false })
    : (() => {
      const store = createStore(root, getRemoteUrl(root));
      const stats = store.getStats();
      if ((stats.totalFiles || 0) === 0 || (stats.totalChunks || 0) === 0) {
        store.db?.close?.();
        throw new Error('frozen semantic index is empty; run Explore once or pass --refresh-index');
      }
      return {
        repoRoot: root,
        store,
        changedFiles: [],
        worktreeId: null,
        stats,
      };
    })();
  const rankings = new Map();

  try {
    for (const benchmarkCase of cases) {
      const results = await retrieve(indexResult.store, indexResult.repoRoot, benchmarkCase.query, {
        budget: args.budget,
        changedFiles: indexResult.changedFiles,
        changedOnly: false,
        depth: args.depth,
        worktreeId: indexResult.worktreeId,
      });
      rankings.set(benchmarkCase.id, results.map((result) => ({
        path: result.path,
        score: Number(result.score?.toFixed?.(6) ?? result.score ?? 0),
      })));
    }

    return {
      rankings,
      indexMetadata: {
        totalFiles: indexResult.stats?.totalFiles ?? null,
        totalChunks: indexResult.stats?.totalChunks ?? null,
        lastIndexed: indexResult.stats?.lastIndexed ?? null,
      },
    };
  } finally {
    indexResult.store?.db?.close?.();
  }
}

function writeReport(outputDir, name, report, markdown) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${name}.json`);
  const markdownPath = path.join(outputDir, `${name}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, `${markdown.trimEnd()}\n`, 'utf8');
  return { jsonPath, markdownPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const cases = loadBenchmarkCases(args.cases, args.caseIds);
  const startedAt = Date.now();
  let ranked;
  try {
    ranked = await rankCases(cases, args);
  } catch (error /* unknown */) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ExploreBench ranking failed: ${message}`, { cause: error });
  }
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    benchmark: evaluateBenchmark(cases, ranked.rankings),
    metadata: {
      retrievalSurface: 'packages/os',
      commit: currentCommit(),
      caseFile: relativeToRepo(args.cases),
      caseIds: cases.map((benchmarkCase) => benchmarkCase.id),
      budget: args.budget,
      depth: args.depth,
      indexMode: args.refreshIndex ? 'refreshed' : 'frozen',
      index: ranked.indexMetadata,
    },
  };
  const markdown = renderBenchmarkMarkdown(report, { title: `OS ExploreBench: ${args.name}` });
  const written = args.outputDir ? writeReport(args.outputDir, args.name, report, markdown) : null;

  if (args.json) {
    writeStdout(JSON.stringify({ report, written }, null, 2));
  } else {
    writeStdout(markdown);
    if (written) {
      writeStdout(`wrote: ${relativeToRepo(written.jsonPath)}`);
      writeStdout(`wrote: ${relativeToRepo(written.markdownPath)}`);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  writeStderr(`ExploreBench failed: ${message}`);
  process.exit(1);
});
