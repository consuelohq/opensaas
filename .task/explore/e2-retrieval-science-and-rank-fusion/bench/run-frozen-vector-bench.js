const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');

const root = process.cwd();
const reportName = process.argv[2] || 'e2-live-control';
const title = process.argv[3] || reportName;
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
    vectorHashes[benchmarkCase.id] = crypto.createHash('sha256').update(bytes).digest('hex');
  }

  const osEmbedder = osRequire('./lib/index/embedder.js');
  osEmbedder.embedText = async (query) => {
    const vector = vectors.get(query);
    if (!vector) throw new Error(`missing frozen query vector for: ${query}`);
    return vector;
  };
  const retrieverPath = osRequire.resolve('./lib/search/retriever.js');
  delete osRequire.cache[retrieverPath];
  const { retrieve } = osRequire('./lib/search/retriever.js');

  const store = createStore(root, getRemoteUrl(root));
  try {
    const stats = store.getStats();
    const rankings = new Map();
    const started = Date.now();
    for (const benchmarkCase of parsed.cases) {
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

    const retrieverSource = fs.readFileSync(path.join(root, 'packages/os/scripts/lib/search/retriever.js'));
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      benchmark: evaluateBenchmark(parsed.cases, rankings),
      metadata: {
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
        queryVectorSource: 'temporary legacy OpenRouter Qwen3-Embedding-4B 2560d oracle; OS gateway returned WORKSPACE_HOSTNAME_NOT_FOUND',
        queryVectorHashes: vectorHashes,
        retrieverSha256: crypto.createHash('sha256').update(retrieverSource).digest('hex'),
      },
    };

    const outDir = path.join(root, 'packages/os/explore-bench/reports');
    fs.mkdirSync(outDir, { recursive: true });
    const markdown = renderBenchmarkMarkdown(report, { title });
    fs.writeFileSync(path.join(outDir, `${reportName}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outDir, `${reportName}.md`), `${markdown.trimEnd()}\n`, 'utf8');

    process.stdout.write(`${JSON.stringify({
      reportName,
      metrics: report.benchmark.metrics,
      caseResults: report.benchmark.caseResults.map((entry) => ({
        id: entry.id,
        reciprocalRank: entry.reciprocalRank,
        recall10: entry.recallAtK['10'],
        requiredRecall10: entry.requiredRecallAtK['10'],
        ndcg10: entry.ndcgAtK['10'],
        missingRequiredPaths: entry.missingRequiredPaths,
        topPaths: entry.topPaths.slice(0, 5),
      })),
      metadata: {
        durationMs: report.durationMs,
        index: report.metadata.index,
        retrieverSha256: report.metadata.retrieverSha256,
      },
    }, null, 2)}\n`);
  } finally {
    store.db.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
