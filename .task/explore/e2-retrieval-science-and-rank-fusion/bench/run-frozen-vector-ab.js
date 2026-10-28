const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');

const root = process.cwd();
const osRequire = createRequire(path.join(root, 'packages/os/scripts/_bench.cjs'));
const workspaceRequire = createRequire(path.join(root, 'packages/workspace/scripts/_oracle.cjs'));
const { embedText: oracleEmbedText } = workspaceRequire('./lib/index/embedder.js');
const { createStore } = osRequire('./lib/index/store.js');
const { getRemoteUrl } = osRequire('./lib/index/indexer.js');
const {
  evaluateBenchmark,
  renderBenchmarkMarkdown,
  validateBenchmarkCases,
} = osRequire('./lib/explore-bench.js');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function loadCommonJsFromSource(source, filename) {
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  instance._compile(source, filename);
  return instance.exports;
}

async function rankCases(retrieve, store, cases) {
  const rankings = new Map();
  for (const benchmarkCase of cases) {
    const results = await retrieve(store, root, benchmarkCase.query, {
      budget: 10,
      changedFiles: [],
      changedOnly: false,
      depth: 2,
      worktreeId: null,
    });
    rankings.set(benchmarkCase.id, results.map((result) => ({
      path: result.path,
      score: Number(result.score?.toFixed?.(6) ?? result.score ?? 0),
    })));
  }
  return rankings;
}

async function main() {
  const casePath = path.join(root, 'packages/os/explore-bench/cases.v1.json');
  const parsed = JSON.parse(fs.readFileSync(casePath, 'utf8'));
  validateBenchmarkCases(parsed.cases);

  const vectors = new Map();
  const vectorHashes = {};
  for (const benchmarkCase of parsed.cases) {
    const vector = await oracleEmbedText(benchmarkCase.query, { kind: 'query' });
    vectors.set(benchmarkCase.query, vector);
    const bytes = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
    vectorHashes[benchmarkCase.id] = sha256(bytes);
  }

  const embedder = osRequire('./lib/index/embedder.js');
  const originalEmbedText = embedder.embedText;
  embedder.embedText = async (query) => {
    const vector = vectors.get(query);
    if (!vector) throw new Error(`missing frozen query vector for: ${query}`);
    return vector;
  };

  const retrieverFilename = path.join(root, 'packages/os/scripts/lib/search/retriever.js');
  const controlSource = execFileSync('git', ['show', 'HEAD:packages/os/scripts/lib/search/retriever.js'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  const challengerSource = fs.readFileSync(retrieverFilename, 'utf8');
  const controlRetrieve = loadCommonJsFromSource(controlSource, retrieverFilename).retrieve;

  delete osRequire.cache[osRequire.resolve('./lib/search/retriever.js')];
  const challengerRetrieve = osRequire('./lib/search/retriever.js').retrieve;
  const store = createStore(root, getRemoteUrl(root));

  try {
    const stats = store.getStats();
    const started = Date.now();
    const controlRankings = await rankCases(controlRetrieve, store, parsed.cases);
    const challengerRankings = await rankCases(challengerRetrieve, store, parsed.cases);
    const runId = sha256(JSON.stringify({ vectorHashes, index: stats, cases: parsed.cases })).slice(0, 16);
    const commonMetadata = {
      retrievalSurface: 'packages/os',
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      caseFile: 'packages/os/explore-bench/cases.v1.json',
      budget: 10,
      depth: 2,
      indexMode: 'frozen',
      index: {
        totalFiles: stats.totalFiles,
        totalChunks: stats.totalChunks,
        lastIndexed: stats.lastIndexed,
      },
      queryVectorSource: 'single-run temporary legacy OpenRouter Qwen3-Embedding-4B 2560d oracle; OS gateway returned WORKSPACE_HOSTNAME_NOT_FOUND',
      queryVectorHashes: vectorHashes,
      comparisonRunId: runId,
    };

    const control = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      benchmark: evaluateBenchmark(parsed.cases, controlRankings),
      metadata: {
        ...commonMetadata,
        variant: 'control',
        retrieverSha256: sha256(controlSource),
      },
    };
    const challenger = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      benchmark: evaluateBenchmark(parsed.cases, challengerRankings),
      metadata: {
        ...commonMetadata,
        variant: 'challenger',
        retrieverSha256: sha256(challengerSource),
      },
    };

    const outDir = path.join(root, 'packages/os/explore-bench/reports');
    fs.mkdirSync(outDir, { recursive: true });
    for (const [name, report, title] of [
      ['e2-live-control', control, 'OS ExploreBench: E2 live control'],
      ['e2-live-challenger', challenger, 'OS ExploreBench: E2 live challenger'],
    ]) {
      fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      fs.writeFileSync(
        path.join(outDir, `${name}.md`),
        `${renderBenchmarkMarkdown(report, { title }).trimEnd()}\n`,
        'utf8',
      );
    }

    process.stdout.write(`${JSON.stringify({
      comparisonRunId: runId,
      sameVectorHashes: JSON.stringify(control.metadata.queryVectorHashes) === JSON.stringify(challenger.metadata.queryVectorHashes),
      sameIndex: JSON.stringify(control.metadata.index) === JSON.stringify(challenger.metadata.index),
      control: control.benchmark.metrics,
      challenger: challenger.benchmark.metrics,
      controlRetrieverSha: control.metadata.retrieverSha256,
      challengerRetrieverSha: challenger.metadata.retrieverSha256,
    }, null, 2)}\n`);
  } finally {
    embedder.embedText = originalEmbedText;
    store.db.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
