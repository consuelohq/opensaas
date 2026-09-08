# Fix live Explore gateway and policy routing

branch: `task/explore/fix-live-explore-gateway-and-policy-routing`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2297
started: 2026-08-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(explore): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/src/semantic-embedding-gateway.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/scripts/confidence-score.js`
- `packages/os/scripts/decide-next.js`
- `packages/os/scripts/exploit.js`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/index/chunker.js`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/indexer.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/lib/search/retriever.js`
- `packages/os/tests/explore-hypothesis-model.test.ts`
- `packages/os/tests/explore-index-hydration-fallback.test.ts`
- `packages/os/tests/explore-output-contract.test.ts`
- `packages/os/tests/explore-retriever-fallback.test.ts`
- `packages/os/tests/explore-runtime-routing.test.ts`
- `packages/os/tests/semantic-embedding-edge-gateway.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/decision-engine/handler.ts`
- `packages/os/tools/decision-engine/manifest.ts`
- `packages/workspace/scripts/confidence-score.js`
- `packages/workspace/scripts/decide-next.js`
- `packages/workspace/scripts/exploit.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`

## acceptance criteria

- [ ] `gateway.consuelohq.com/v1/os/semantic-embeddings` is served by the intended platform-global Worker route in live Canary and bypasses workspace-host lookup.
- [ ] Explore stops after the first systemic embedding-provider/gateway failure during index hydration instead of retrying tens of thousands of chunks; the error remains actionable and bounded.
- [ ] Lexical fallback remains available for query-time semantic failure once index bootstrap is healthy.
- [ ] `confidenceScore`, `decideNext`, and `exploit` are projections of the unified OS Explore policy; `exploit` without an explicit target cannot select while `edit_ready` is false.
- [ ] Historical baseline queries complete on the released Canary runtime and produce coherent policy output.
- [ ] Focused tests, strict review, verify, stream merge, Canary release, and local update succeed.

## plan

1. Reproduce live gateway and Explore timeout behavior and inspect deployed Cloudflare routing.
2. Add focused red regressions for fail-fast embedding hydration and unified compatibility routing.
3. Make the smallest runtime/deployment fixes, preserving lexical fallback and current security controls.
4. Run focused tests, live gateway smoke, exact historical Explore baselines, review, and verify.
5. Merge to `stream/explore`, release to Canary, update locally, and rerun live traces.

## Test-first contract

behavior under test: systemic embedding-gateway failure aborts index hydration after the first failed batch instead of iterating all missing chunks; compatibility decision tools consume the unified Explore policy and exploit fails closed unless edit-ready.
existing local pattern: `explore-retriever-fallback.test.ts`, `explore-runtime-routing.test.ts`, decision-engine policy tests, and semantic gateway edge tests.
new or changed tests: add an indexer fail-fast regression with a mocked failing embedder; extend runtime/decision tests so compatibility commands route to OS runtime policy and exploit does not select when policy says read/insufficient evidence; add/extend Cloudflare route/deploy contract if routing drift is representable in repo config.
focused red command: run only the new/changed Explore indexer + runtime-routing/policy + semantic gateway tests.
expected red failure: current indexer attempts more than one failed embedding chunk/batch; current compatibility commands still resolve old workspace scripts / exploit selects despite non-edit-ready policy; live gateway route check returns workspace-host lookup 404 until deployment is reconciled.
no-test waiver: not applicable.

## key decisions

- The handler source already checks the semantic embedding gateway before workspace routing, so the live `WORKSPACE_HOSTNAME_NOT_FOUND` response is deployment/route drift unless a different Worker is bound to the hostname.
- Treat fail-fast hydration as distinct from query-time lexical fallback: bootstrap should abort on a systemic provider failure, while retrieval can still fall back lexically when a single query embedding is unavailable.

- 2026-08-29 07:35:55 append: `.task/explore/fix-live-explore-gateway-and-policy-routing/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 07:35:55 fs.write: `.task/explore/fix-live-explore-gateway-and-policy-routing/workpad.md`
- 2026-08-29 07:41:18 fs.write: `.task/explore/fix-live-explore-gateway-and-policy-routing/workpad.md`
- 2026-08-29 07:47:37 fs.write: `.task/explore/fix-live-explore-gateway-and-policy-routing/workpad.md`
- 2026-08-29 07:48:59 fs.write: `.task/explore/fix-live-explore-gateway-and-policy-routing/workpad.md`

## wait recovery

Wait reason: OS OAuth introspection returned 401 twice during read-only source search.
Duration: 15s.
Resume action: retry the exact `ensureIndex(` source search, then continue implementation only if OS auth recovers.
Expected signal: read-only `fs.search` returns normally.
Fallback: one additional bounded backoff if the same 401 repeats; no repo mutation through fallback tooling.

- 2026-08-29 07:41:18 append: `.task/explore/fix-live-explore-gateway-and-policy-routing/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 07:43:48 `checkFiles`: passed — OK
- 2026-08-29 07:48:04 `review.run`: passed — OK
- 2026-08-29 07:48:50 `verify`: passed — OK

## implementation status

- Added an explicit `gateway.consuelohq.com/*` Workspace Edge route before the wildcard route so the platform-global semantic endpoint cannot depend on hostname registry lookup.
- Changed normal Explore index hydration from every missing embedding to a bounded working set: up to 64 query-relevant lexical chunks plus up to 32 changed chunks. Explicit `--reindex` remains the full missing-chunk candidate path.
- Gateway/OpenRouter document hydration is batched up to 32 items; local embeddings retain the existing small local concurrency.
- The first systemic hydration batch failure pauses semantic hydration and returns the remaining retrieval path to lexical fallback instead of retrying the entire missing corpus.
- Explore reports `chunks_deferred` and `embedding_status` in index stats.
- Routed `confidenceScore`, `decideNext`, and `exploit` through the installed OS runtime and regenerated the characterized tool surface.
- Added the indexer and hydration regression to the critical Explore selector and regenerated the registry.

## validation evidence

- Red: 16-file failing-gateway fixture made 17 embedding requests before implementation; runtime-routing test showed compatibility tools had no `executionScope: runtime`; wrangler route test showed no explicit gateway route.
- Green: failing-gateway fixture now returns the lexical target and stays within <=3 gateway requests.
- Green: healthy 96-file fresh-index fixture completes with the target and <=3 gateway requests, proving bounded startup on success as well as failure.
- Green: focused Explore science suite 13 files / 87 tests.
- Green: tool manifest/layout suite 2 files / 20 tests.
- Green: workspace selector suite 72 tests.
- Green: syntax checks for all touched JS/TS/test files.
- Green: `generate-tool-manifest:check` reports generated manifests are current.
- Narrow explicit changed-file selection is `pass`; the indexer is owned by `os-explore-retrieval-science` and does not select the auto OS package suite.
- Earlier broad `origin/stream/explore` selector included parallel OS task changes and surfaced unrelated script-parity inventory drift; that evidence was not used to widen this task.
- OAuth wait recovery: after the 15s bounded wait, the immediate read-only retry reached OS normally; the first retry error was only an unescaped ripgrep parenthesis and the corrected query succeeded.

- 2026-08-29 07:47:37 append: `.task/explore/fix-live-explore-gateway-and-policy-routing/workpad.md`

## final local gate

- Strict review: 0 task-owned issues, 0 blockers.
- Canonical `verify`: passed, full mode, `publishValid=true`, DB risks/findings 0.
- Final behavior coverage includes both provider-outage failover and healthy-provider bounded hydration.
- Documentation opportunity for the tool reference is non-blocking; the public input/output contract did not gain a new user action, while execution now correctly uses the installed runtime.

## current status

Implementation is locally complete and publish-valid. Next: task push -> PR promotion into `stream/explore`, then stream/main release to Canary, Workspace Edge deployment, local runtime update, and live Explore A/B smoke against historical queries.

- 2026-08-29 07:48:59 append: `.task/explore/fix-live-explore-gateway-and-policy-routing/workpad.md`
