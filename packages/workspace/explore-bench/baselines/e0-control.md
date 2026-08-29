# ExploreBench E0 control baseline

Generated: 2026-08-15T08:37:07.739Z

## Trace baseline

- Explore calls in trace DB: **13**; successful payloads: **11**; failed/payloadless: **2**
- Trace range: **2026-07-13T05:51:46.032670+00:00** to **2026-07-28T18:01:56.717843+00:00**
- Output tokens: median **9420**, p90 **13333**, max **21903**
- Duration: median **10100 ms**, p90 **300154 ms**
- Result count: median **10**

## Tool adoption (deduplicated evidence events)

- Explore: **157**
- decideNext: **11**
- confidenceScore: **34**
- exploit: **6**

## Payload cost

- Compact-packet projection samples: **11**
- Median serialized-byte reduction: **81.9%**
- Projected median output tokens: **1704**
- Projection method: observed output tokens multiplied by compact/original payload byte ratio; estimate only

Largest result fields by serialized value bytes:

| field | bytes | share |
|---|---:|---:|
| typed_edges | 124737 | 33.7% |
| score_parts | 71703 | 19.4% |
| target | 71508 | 19.3% |
| graph_connections | 34540 | 9.3% |
| file_outline | 21865 | 5.9% |
| preview | 15446 | 4.2% |
| path | 7938 | 2.1% |
| reason | 6207 | 1.7% |
| symbol | 2959 | 0.8% |
| lines | 2760 | 0.7% |

## Curated retrieval benchmark

- Cases: **9**; evaluated: **9**; unlabeled: **0**
- MRR: **0.556790123457**

| k | Recall@k | required-node recall | nDCG@k |
|---:|---:|---:|---:|
| 1 | 0.087037037037 | 0.12962962963 | 0.269841269841 |
| 3 | 0.274074074074 | 0.314814814815 | 0.313442378051 |
| 5 | 0.357407407407 | 0.425925925926 | 0.344238148347 |
| 10 | 0.55 | 0.648148148148 | 0.427920847138 |

### Case diagnostics at max k

| case | reciprocal rank | missing required nodes |
|---|---:|---|
| explore-ranking-implementation | 0.200 | packages/workspace/scripts/lib/search/ranker.js<br>packages/workspace/scripts/lib/search/retriever.js |
| explore-belief-evidence-state | 1.000 | packages/workspace/scripts/lib/state/evidence-log.js |
| task-start-lifecycle | 0.200 | none |
| task-push-publish-gate | 1.000 | none |
| stream-sync-lifecycle | 0.500 | none |
| strict-review-run | 0.500 | none |
| code-call-runtime | 0.500 | packages/workspace/scripts/code-call.ts<br>packages/workspace/scripts/lib/code-call/runtime.ts |
| local-trace-query | 0.111 | packages/workspace/scripts/context.js |
| tool-manifest-generation | 1.000 | packages/workspace/tooling/tool-manifest.json |

## Input provenance

- Control commit: `a58ec4454d8fc991255f69be80019f3739501559`
- Ranking mode: **current-control**
- Evidence logs scanned: **562**; parse errors: **4**
- Index files/chunks: **15723 / 81167**
- Embedding configuration: `openrouter-qwen-qwen3-embedding-4b-2560d-workspace-code-retrieval-v1`

## Methodological limits

- Raw trace queries and payloads are analysis inputs only and are not embedded in this report.
- Compact-token numbers are byte-ratio projections, not measurements from a deployed compact response.
- Retrieval metrics use the curated labels in the benchmark corpus; they are not an unbiased estimate over all engineering queries.
- E0 measures the current Explore control and does not alter retrieval, ranking, belief updates, or response behavior.
