# OS ExploreBench: E2 live control — INVALID EVIDENCE

This run is retained only as a failure diagnostic. The OS embedding gateway returned `WORKSPACE_HOSTNAME_NOT_FOUND`, every ranked `topPaths` list is empty, and the zero metrics therefore do **not** represent a valid control policy. Do not use this artifact as comparative, confirmatory, or promotion evidence.

Generated: 2026-08-15T10:50:49.419Z

- Cases: **10**
- MRR: **0**

| k | Recall@k | required-node recall | nDCG@k |
|---:|---:|---:|---:|
| 1 | 0 | 0 | 0 |
| 3 | 0 | 0 | 0 |
| 5 | 0 | 0 | 0 |
| 10 | 0 | 0 | 0 |

## Case diagnostics at max k

| case | reciprocal rank | missing required nodes |
|---|---:|---|
| explore-ranking | 0.000 | packages/os/scripts/lib/search/ranker.js<br>packages/os/scripts/lib/search/retriever.js<br>packages/os/scripts/explore.js |
| explore-beliefs | 0.000 | packages/os/scripts/lib/state/explore-state.js<br>packages/os/scripts/lib/state/evidence-log.js<br>packages/os/scripts/explore.js |
| task-start | 0.000 | packages/os/scripts/task-start.js<br>packages/os/scripts/lib/task-meta.js |
| task-push | 0.000 | packages/os/scripts/task-push.js<br>packages/os/scripts/lib/verification.js<br>packages/os/scripts/lib/task-selection.js |
| stream-sync | 0.000 | packages/os/scripts/stream-sync.js<br>packages/os/scripts/lib/task-meta.js |
| strict-review | 0.000 | packages/os/scripts/review.js<br>packages/os/scripts/lib/review-run-state.js |
| code-call | 0.000 | packages/os/scripts/code-call.ts<br>packages/os/scripts/lib/code-call/runtime.ts<br>packages/os/scripts/lib/code-call/service.ts |
| trace-search | 0.000 | packages/os/scripts/lib/trace-sites-local-read-backend.ts<br>packages/os/scripts/lib/trace-search-query.ts |
| tool-manifest | 0.000 | packages/os/scripts/generate-tool-manifest.ts<br>packages/os/manifests/generated/tool.manifest.json |
| explicit-search-scope | 0.000 | packages/os/scripts/lib/search/retriever.js<br>packages/os/scripts/lib/search/ranker.js |

## Provenance

- Retrieval surface: **packages/os**
- Commit: `4ca0a2a084ec423f1c56c7ae5ecc60a6860ab160`
- Case file: `packages/os/explore-bench/cases.v1.json`
- Index files/chunks: **16673 / 86910**
