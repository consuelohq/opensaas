# Preserve semantic outage metadata across embedding transports

branch: `task/explore/preserve-semantic-outage-metadata-across-embedding-transports`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2425
started: 2026-09-08

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

## Test-first contract

behavior under test: semantic transport outages must retain `semanticUnavailable` through both direct OpenRouter failures and gateway response-body failures, so an interactive hydration outage suppresses the redundant query embedding and preserves the bounded lexical fallback path.
existing local pattern: `packages/os/tests/semantic-embedding-gateway.test.ts` exercises gateway availability classification, and `packages/os/tests/explore-index-hydration-fallback.test.ts` verifies one-request lexical fallback after hydration outage.
new or changed tests: add gateway body-read failure coverage and direct OpenRouter timeout/network metadata coverage; keep existing local-validation behavior non-unavailable.
focused red command: `bun --cwd packages/os test tests/semantic-embedding-gateway.test.ts tests/explore-index-hydration-fallback.test.ts`
expected red failure: gateway body-read rejection and direct OpenRouter transport failure surface ordinary errors without `semanticUnavailable === true` under current code.
no-test waiver: not applicable.

## acceptance criteria

- [ ] Direct OpenRouter abort/network failures preserve semantic-unavailable metadata through `embedTexts`.
- [ ] Gateway body-consumption failures after successful headers are classified unavailable.
- [ ] HTTP/local payload classification remains unchanged: 408/429/5xx unavailable; local validation remains non-unavailable.
- [ ] Interactive Explore retains one-outage-attempt lexical fallback semantics and whole-phase latency bound.
- [ ] Focused/broad tests, strict review, full verify, stream promotion, current-head CI/review, merge, Canary release, local update, and live acceptance are green.

- 2026-09-08 15:31:46 append: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 15:31:46 fs.write: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`
- 2026-09-08 15:32:46 fs.write: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`
- 2026-09-08 15:33:07 fs.write: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`
- 2026-09-08 15:33:18 fs.write: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`
- 2026-09-08 15:34:02 fs.write: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`
- 2026-09-08 15:35:05 fs.write: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/tests/semantic-embedding-gateway.test.ts`

- 2026-09-08 15:32:03 apply-patch: `packages/os/tests/semantic-embedding-gateway.test.ts`
- 2026-09-08 15:32:14 apply-patch: `packages/os/tests/semantic-embedding-gateway.test.ts`
## TDD evidence

- focused true red `trc_a67c6955d8db`: `semantic-embedding-gateway.test.ts` ran 15 tests; 13 existing tests passed and exactly the two new current-head Codex regressions failed because `semanticUnavailable` was undefined for (1) a successful gateway response whose body read timed out and (2) a direct OpenRouter transport timeout.

- 2026-09-08 15:32:46 append: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`

- 2026-09-08 15:32:47 apply-patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-09-08 15:32:47 apply-patch: `packages/os/scripts/lib/index/embedder.js`
- focused green `trc_e753b0e31375`: all 15 semantic gateway/transport tests pass; both new current-head Codex regressions are fixed while the existing local validation/status/deadline contracts remain green.

- 2026-09-08 15:33:07 append: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`

- broad setup-only false failure `trc_f01e14007f3a`: 94/102 tests passed; all 8 failures exited before product behavior because the new task worktree lacked package-local `tree-sitter` dependencies. This is the same ignored-worktree dependency setup issue seen in prior Explore tasks, not a regression.

- 2026-09-08 15:33:18 append: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`

- broad Explore suite `trc_dfcc66bdfa12`: 13 files / 102 tests passed after repairing ignored package-local dependencies. Both ~9.2s hydration deadline regressions remain green, as do provider/local classification, benchmark, runtime routing, edge gateway, and decision-engine contracts.

- 2026-09-08 15:34:02 append: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 15:34:21 `review.run`: passed — OK
- 2026-09-08 15:34:57 `verify`: passed — OK

## Final task validation

- [x] Direct OpenRouter transport failures preserve `semanticUnavailable` through both direct-batch and outer batch wrapping.
- [x] Gateway response-body read/parse failures after headers are classified unavailable with original cause preserved.
- [x] HTTP/local classification remains scoped: 408/429/5xx unavailable; local payload validation remains non-unavailable.
- [x] Focused red `trc_a67c6955d8db` reproduced both current-head Codex P2s; focused green `trc_e753b0e31375` passed 15/15.
- [x] Broad Explore suite `trc_dfcc66bdfa12`: 13 files / 102 tests passed.
- [x] Strict review `trc_9ddbaf76cc20`: zero findings.
- [x] Full verify `trc_e0227ff64334`: publish-valid, zero review findings and zero DB risks.

### Product/test files changed

- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/tests/semantic-embedding-gateway.test.ts`

### Publish checklist

- [x] focused red captured
- [x] focused green captured
- [x] broad suite green
- [x] strict review green
- [x] full verify green
- [ ] task pushed/promoted to stream
- [ ] stream current-head CI/reviews green
- [ ] stream merged to main
- [ ] Canary release + local update complete
- [ ] live acceptance complete

- 2026-09-08 15:35:05 append: `.task/explore/preserve-semantic-outage-metadata-across-embedding-transports/workpad.md`
