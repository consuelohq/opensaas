# OS ExploreBench: E2 live challenger

Generated: 2026-08-15T10:50:49.420Z

- Cases: **10**
- MRR: **0.95**

| k | Recall@k | required-node recall | nDCG@k |
|---:|---:|---:|---:|
| 1 | 0.3 | 0.333333333333 | 0.728571428571 |
| 3 | 0.491666666667 | 0.55 | 0.621705568371 |
| 5 | 0.55 | 0.6 | 0.626294948118 |
| 10 | 0.675 | 0.716666666667 | 0.674138268613 |

## Case diagnostics at max k

| case | reciprocal rank | missing required nodes |
|---|---:|---|
| explore-ranking | 1.000 | packages/os/scripts/lib/search/ranker.js<br>packages/os/scripts/explore.js |
| explore-beliefs | 1.000 | none |
| task-start | 0.500 | packages/os/scripts/lib/task-meta.js |
| task-push | 1.000 | packages/os/scripts/lib/task-selection.js |
| stream-sync | 1.000 | none |
| strict-review | 1.000 | packages/os/scripts/review.js |
| code-call | 1.000 | packages/os/scripts/lib/code-call/runtime.ts |
| trace-search | 1.000 | none |
| tool-manifest | 1.000 | packages/os/manifests/generated/tool.manifest.json |
| explicit-search-scope | 1.000 | none |

## Provenance

- Retrieval surface: **packages/os**
- Commit: `4ca0a2a084ec423f1c56c7ae5ecc60a6860ab160`
- Case file: `packages/os/explore-bench/cases.v1.json`
- Index files/chunks: **16673 / 86910**
