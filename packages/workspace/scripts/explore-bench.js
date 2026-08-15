#!/usr/bin/env bun

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Database } = require('bun:sqlite');

const { ensureIndex } = require('./lib/index/indexer');
const { retrieve } = require('./lib/search/retriever');
const {
  buildExploreBenchReport,
  renderExploreBenchMarkdown,
  validateBenchmarkCases,
} = require('./lib/explore-bench');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function relativeToRepo(filePath) {
  const relative = path.relative(repoRoot(), filePath);
  return relative.startsWith('..') ? path.basename(filePath) : relative;
}

function printHelp() {
  writeStdout('usage: bun run explore-bench -- [options]');
  writeStdout('');
  writeStdout('measure the current Explore control without changing ranking or Explore state.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --cases <path>          benchmark cases JSON (default: explore-bench/cases.v1.json)');
  writeStdout('  --trace-db <path>       explicit OpenWorkspace trace SQLite database');
  writeStdout('  --evidence-root <path>  evidence-log tree (default: repo .task)');
  writeStdout('  --rank-control          run current retriever for curated benchmark cases');
  writeStdout('  --output-dir <path>     write e0-control.json and e0-control.md');
  writeStdout('  --json                  print JSON instead of Markdown');
  writeStdout('  --help                  show this help');
}

function parseArgs(argv) {
  const args = {
    cases: path.join(__dirname, '..', 'explore-bench', 'cases.v1.json'),
    evidenceRoot: path.join(repoRoot(), '.task'),
    json: false,
    outputDir: null,
    rankControl: false,
    traceDb: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--cases':
        args.cases = path.resolve(argv[++index]);
        break;
      case '--trace-db':
        args.traceDb = path.resolve(argv[++index]);
        break;
      case '--evidence-root':
        args.evidenceRoot = path.resolve(argv[++index]);
        break;
      case '--rank-control':
        args.rankControl = true;
        break;
      case '--output-dir':
        args.outputDir = path.resolve(argv[++index]);
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
  return args;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function repoIdentifier() {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: repoRoot(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
    return remote || repoRoot();
  } catch {
    return repoRoot();
  }
}

function defaultTraceDbPath() {
  const root = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'OpenWorkspace', 'traces')
    : path.join(os.homedir(), '.local', 'share', 'openworkspace', 'traces');
  return path.join(root, sha256(repoIdentifier()).slice(0, 24), 'traces.db');
}

function safeJson(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadExploreTraceRows(dbPath) {
  if (!fs.existsSync(dbPath)) return { rows: [], databaseFound: false };
  const db = new Database(dbPath, { readonly: true });
  try {
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='tool_traces'").all();
    if (tables.length === 0) return { rows: [], databaseFound: true };
    const sourceRows = db.query(
      'SELECT ts, tool, ok, duration_ms, input_tokens, output_tokens, result_json FROM tool_traces WHERE tool = ? ORDER BY ts ASC',
    ).all('explore');
    const rows = sourceRows.map((row) => {
      const envelope = safeJson(row.result_json);
      const payload = envelope?.data && Array.isArray(envelope.data.results)
        ? envelope.data
        : (envelope && Array.isArray(envelope.results) ? envelope : null);
      return {
        ts: row.ts,
        tool: row.tool,
        ok: Boolean(row.ok),
        durationMs: Number(row.duration_ms),
        inputTokens: Number(row.input_tokens),
        outputTokens: Number(row.output_tokens),
        payload,
      };
    });
    return { rows, databaseFound: true };
  } finally {
    db.close();
  }
}

function collectEvidenceLogs(root) {
  if (!fs.existsSync(root)) return { events: [], fileCount: 0, parseErrorCount: 0 };
  const events = [];
  let fileCount = 0;
  let parseErrorCount = 0;
  const stack = [root];
  while (stack.length > 0) {
    const directory = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        stack.push(entryPath);
        continue;
      }
      if (entry.name !== 'evidence-log.json') continue;
      fileCount += 1;
      try {
        const parsed = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
        for (const event of Array.isArray(parsed.events) ? parsed.events : []) {
          events.push({
            id: event?.id || null,
            action: event?.action || null,
            source: event?.source || null,
            type: event?.type || null,
          });
        }
      } catch {
        parseErrorCount += 1;
      }
    }
  }
  return { events, fileCount, parseErrorCount };
}

function loadBenchmarkCases(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed?.cases)) {
    throw new Error('benchmark case file must have schemaVersion=1 and a cases array');
  }
  validateBenchmarkCases(parsed.cases);
  return parsed;
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

async function rankControlCases(cases) {
  try {
    const indexResult = await ensureIndex({ json: true, reindex: false });
    const rankings = new Map();
    for (const benchmarkCase of cases) {
      const results = await retrieve(indexResult.store, indexResult.repoRoot, benchmarkCase.query, {
        budget: 10,
        changedFiles: indexResult.changedFiles,
        changedOnly: false,
        depth: 2,
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
        embeddingConfigId: indexResult.stats?.embeddingConfigId ?? null,
        embeddingDimensions: indexResult.stats?.embeddingDimensions ?? null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ExploreBench control ranking failed: ${message}`, { cause: error });
  }
}

function writeReport(outputDir, report, markdown) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'e0-control.json');
  const markdownPath = path.join(outputDir, 'e0-control.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, `${markdown.trimEnd()}\n`, 'utf8');
  return { jsonPath, markdownPath };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const benchmarkFile = loadBenchmarkCases(args.cases);
  const traceDb = args.traceDb || process.env.OPENWORKSPACE_TRACE_DB || defaultTraceDbPath();
  const traces = loadExploreTraceRows(traceDb);
  const evidence = collectEvidenceLogs(args.evidenceRoot);
  const control = args.rankControl
    ? await rankControlCases(benchmarkFile.cases)
    : { rankings: new Map(), indexMetadata: null };

  const report = buildExploreBenchReport({
    traceRows: traces.rows,
    evidenceEvents: evidence.events,
    benchmarkCases: benchmarkFile.cases,
    rankingsByCaseId: control.rankings,
  });
  report.metadata = {
    controlCommit: currentCommit(),
    rankingMode: args.rankControl ? 'current-control' : 'not-run',
    benchmarkSchemaVersion: benchmarkFile.schemaVersion,
    benchmarkCaseCount: benchmarkFile.cases.length,
    evidenceLogFileCount: evidence.fileCount,
    evidenceParseErrorCount: evidence.parseErrorCount,
    traceDatabaseFound: traces.databaseFound,
    traceRowCount: traces.rows.length,
    benchmarkCaseFile: relativeToRepo(args.cases),
    index: control.indexMetadata,
  };

  const markdown = renderExploreBenchMarkdown(report, { title: 'ExploreBench E0 control baseline' });
  let written = null;
  if (args.outputDir) written = writeReport(args.outputDir, report, markdown);

  if (args.json) {
    writeStdout(JSON.stringify({ report, written }, null, 2));
  } else {
    writeStdout(markdown);
    if (written) {
      writeStdout(`wrote: ${relativeToRepo(written.jsonPath)}`);
      writeStdout(`wrote: ${relativeToRepo(written.markdownPath)}`);
    }
  } catch (error) {
    throw new Error('ExploreBench execution failed', { cause: error });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  writeStderr(`ExploreBench failed: ${message}`);
  process.exit(1);
});
