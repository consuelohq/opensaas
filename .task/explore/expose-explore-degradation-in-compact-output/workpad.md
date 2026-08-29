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
