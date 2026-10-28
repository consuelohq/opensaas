# remove approximate token marker regression

branch: `task/os/remove-approximate-token-marker-regression`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2566
started: 2026-09-23

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`

## Scope correction

This task only removes the approximate-token UI regression introduced by the previous verify-compaction task. The verify output compaction, verify single-flight/deduplication, and fallback token-number calculation stay intact.

## Acceptance criteria

- [ ] Trace token cells no longer render the `≈` prefix.
- [ ] Selected-trace token metrics and branch token totals no longer render the `≈` prefix.
- [ ] Existing token totals remain numerically unchanged, including fallback payload-derived totals when persisted token counts are absent.
- [ ] No verify/release behavior is changed in this task.
- [ ] Rebuild the checked-in trace inspector bundle and validate the rendered/runtime contract.

## Plan

1. Add a regression test that the browser and virtual-list runtimes contain no approximate-token glyph while `totalTokens()` still preserves fallback totals.
2. Run the focused test red against the current stream state.
3. Remove only the estimate-display metadata/helper added in the previous task; restore direct `totalTokens()` formatting.
4. Rebuild the inspector runtime bundle, rerun focused tests, review the diff, verify, and promote through `stream/os`.

## Test-first contract

behavior under test: trace token values render as ordinary numeric totals with no `≈` marker anywhere in the trace UI, while token-number fallback behavior remains unchanged.
existing local pattern: the inspector interaction test already reads browser runtime source for user-visible interaction contracts and directly tests `totalTokens()` for recorded and fallback values.
new or changed tests: extend `packages/os/tests/trace-site-inspector-interactions.test.ts` to assert browser and virtual-list sources do not contain `≈`; preserve the existing fallback-total assertions.
focused red command: `bunx vitest run packages/os/tests/trace-site-inspector-interactions.test.ts --reporter=dot --silent=passed-only --no-color`
expected red failure: the new no-approximation assertions fail because both browser runtimes currently format estimated rows with `≈`.
no-test waiver: not applicable.

- 2026-09-23 02:36:41 append: `.task/os/remove-approximate-token-marker-regression/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-23 02:36:41 fs.write: `.task/os/remove-approximate-token-marker-regression/workpad.md`
- 2026-09-23 02:37:01 apply-patch: `packages/os/tests/trace-site-inspector-interactions.test.ts`
- 2026-09-23 02:38:58 apply-patch: `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- 2026-09-23 02:38:58 apply-patch: `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- 2026-09-23 02:38:58 apply-patch: `packages/os/scripts/lib/trace-site-inspector/model.ts`
- 2026-09-23 02:38:58 apply-patch: `packages/os/tests/trace-site-inspector-interactions.test.ts`
- 2026-09-23 02:41:26 fs.write: `.task/os/remove-approximate-token-marker-regression/workpad.md`

## Implementation status

- Root cause confirmed: the prior task introduced `tokenUsage(...).estimated` and prefixed `≈` whenever persisted token fields were absent. The trace rows shown in the live UI frequently lack those persisted fields, so the fallback path classified nearly every visible row as estimated and added `≈` across the table.
- Scope correction: removed only the estimate-display metadata and glyph formatting. `totalTokens()` still uses persisted counts first and the same payload-size fallback when those counts are absent.
- No verify compaction, verify single-flight, release, or trace persistence behavior was changed.

## TDD evidence

- RED: focused inspector test failed exactly on `expect(browser).not.toContain('≈')` with the live runtime still containing the marker.
- GREEN: focused inspector test passed: 12/12.
- Broader trace UI regression suite passed: 4 files, 51 tests.
- Browser-client contract passed: 4/4.
- OS typecheck/syntax gate passed.
- Runtime bundle rebuilt successfully and a source/generated search found zero matches for `≈`, `totalTokensEstimated`, or `tokenUsage`.

## Recovery notes

- First focused-test invocation used the `bun` code runtime with a shell command, which the runner correctly rejected as source-code syntax. Retried with the shell runtime and got the intended red failure.
- First bundle build failed because the task worktree did not have `packages/os/node_modules`; the main checkout did. Added a local ignored symlink for the task worktree only, then the canonical build succeeded. No dependency files changed.

## Files changed

- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js` (generated)

- 2026-09-23 02:41:26 append: `.task/os/remove-approximate-token-marker-regression/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 02:41:42 `review.run`: passed — OK
- 2026-09-23 02:42:12 `verify`: passed — OK
