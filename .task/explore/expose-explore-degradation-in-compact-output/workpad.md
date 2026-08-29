# Expose Explore degradation in compact output

branch: `task/explore/expose-explore-degradation-in-compact-output`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2303
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

## acceptance criteria

- [ ] Default compact Explore JSON includes `embedding_status` and `chunks_deferred` from `index_stats` so facade callers can distinguish semantic-ready from lexical-degraded retrieval.
- [ ] Full Explore output remains unchanged except for already-present fields.
- [ ] Compact output tests prove both healthy and degraded index stats are preserved without expanding the payload materially.
- [ ] Explore critical suite, strict review, canonical verify, stream promotion, PR #2300 CI/review, Canary release, Workspace Edge deployment, and live baselines succeed.

## plan

1. Sync this task branch to current `stream/explore` before production edits because task bootstrap started from `main`.
2. Add a focused red compact-output regression for the two degradation fields.
3. Update only the compact index-stats projection, then run focused + full Explore critical suites.
4. Review/verify, promote #2303 into the stream, and resume #2300 final release gate.

## Test-first contract

behavior under test: default compact Explore JSON preserves semantic hydration status and deferred-chunk count so callers can detect degraded lexical fallback.
existing local pattern: `packages/os/scripts/lib/search/explore-output.js` owns compact/full projection; `packages/os/tests/explore-output-contract.test.ts` protects compact payload fields and size.
new or changed tests: extend `explore-output-contract.test.ts` with `index_stats.embedding_status='degraded'` and `chunks_deferred>0`, asserting both survive compact projection; keep the existing compact payload-size assertion.
focused red command: `bun --cwd packages/os test tests/explore-output-contract.test.ts`.
expected red failure: current `compactIndexStats()` omits both fields, so compact output loses degradation state while full output contains it.
no-test waiver: not applicable.

## key decisions

- Codex P1 is valid because JSON mode suppresses hydration warnings and the facade defaults to compact detail; hiding degradation there makes fallback operationally invisible.
- Keep the fix in output projection only; do not change retrieval/hydration behavior again.

- 2026-08-29 08:12:33 append: `.task/explore/expose-explore-degradation-in-compact-output/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 08:12:33 fs.write: `.task/explore/expose-explore-degradation-in-compact-output/workpad.md`
- 2026-08-29 08:13:45 fs.write: `.task/explore/expose-explore-degradation-in-compact-output/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/search/explore-output.js`
- `packages/os/tests/explore-output-contract.test.ts`

## implementation status

- Added `chunks_deferred` and `embedding_status` to compact Explore `index_stats`; full detail remains pass-through.
- Added a degraded compact-output regression with `chunks_deferred: 42` and `embedding_status: 'degraded'`.

## validation evidence

- Red: focused output contract failed exactly because compact output omitted both degradation fields; 5/6 tests passed.
- Green: focused output contract 6/6.
- Full Explore critical suite: 13 files / 93 tests green after restoring the task worktree's standard `packages/os/node_modules` dependency view. The first broad run's 4 failures were all environment-only `tree-sitter` resolution errors; no product assertion failed after dependencies were visible.
- Diff scope is limited to compact output projection + output contract test + task metadata.

## current status

Third Codex P1 is fixed locally. Next: strict review, canonical verify, publish #2303 into `stream/explore`, then resume PR #2300 final CI/review and Canary release/live smoke.

- 2026-08-29 08:13:45 append: `.task/explore/expose-explore-degradation-in-compact-output/workpad.md`
