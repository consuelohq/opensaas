# ship trace token marker hotfix

branch: `task/os-trace-hotfix/ship-trace-token-marker-hotfix`
stream: `stream/os-trace-hotfix`
pr: https://github.com/consuelohq/opensaas/pull/2567
started: 2026-09-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/streams/os-trace-hotfix/AGENTS.md` (deleted)
- `packages/workspace/streams/os-trace-hotfix/AGENTS.md` (deleted)

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
bun run task:push -- --message "type(os-trace-hotfix): description" --changed
bun run task:pr
bun run task:finish
```

## Purpose

Ship only the already-tested trace token-marker correction to `main`, without merging the 62-file `stream/os` review PR. This is a transport-only hotfix stream created from current `main` specifically to avoid unrelated scope.

## Acceptance criteria

- [ ] Apply only the five product/test files changed by commit `e1994cfd2fbc63da6d2d121e823792114a380700`; do not import prior task metadata or unrelated `stream/os` work.
- [ ] Trace token UI contains no `≈` marker.
- [ ] Existing token-number fallback behavior remains unchanged.
- [ ] Focused trace tests, review, and verify pass on the main-based hotfix branch.
- [ ] Merge the hotfix stream PR to `main` and release/update the installed OS so the visible Tracing page is corrected.

## Test-first contract

behavior under test: unchanged from the source fix task — token totals render without approximation markers while fallback totals remain intact.
existing local pattern: source fix task `task/os/remove-approximate-token-marker-regression` already ran a red/green regression test and broader trace UI validation.
new or changed tests: none in this transport task beyond copying the already-tested regression test with the exact patch.
focused red command: covered in source task; red failed on `expect(browser).not.toContain('≈')` before implementation.
expected red failure: already observed in source task before implementation.
no-test waiver: this task is exact patch transport from a tested commit onto a clean `main`-based hotfix stream. Re-running focused and broader green validation here replaces a duplicate red cycle.

- 2026-09-23 02:46:15 append: `.task/os-trace-hotfix/ship-trace-token-marker-hotfix/workpad.md`

## workspace-owned: files changed

- `packages/os/streams/os-trace-hotfix/AGENTS.md` (deleted)
- `packages/workspace/streams/os-trace-hotfix/AGENTS.md` (deleted)

## workspace-owned: activity log

- 2026-09-23 02:46:15 fs.write: `.task/os-trace-hotfix/ship-trace-token-marker-hotfix/workpad.md`
- 2026-09-23 02:47:22 fs.trash: `packages/os/streams/os-trace-hotfix/AGENTS.md`
- 2026-09-23 02:47:29 fs.trash: `packages/workspace/streams/os-trace-hotfix/AGENTS.md`
- 2026-09-23 02:47:47 fs.write: `.task/os-trace-hotfix/ship-trace-token-marker-hotfix/workpad.md`

## Scope containment

`stream.create` necessarily seeded two stream-local `AGENTS.md` files. Because this hotfix stream is only transport for the token-marker correction, those seed files were deleted in the task so the eventual hotfix stream → main diff does not add permanent hotfix-stream instructions. Product/test delta remains the five intended files plus normal task metadata.

Validation on the main-based hotfix task:
- exact filtered patch from `e1994cfd2fbc63da6d2d121e823792114a380700` applied cleanly;
- source/generated search: zero matches for `≈`, `totalTokensEstimated`, or `tokenUsage`;
- trace UI suite: 4 files / 51 tests passed;
- browser client: 4/4 passed.

- 2026-09-23 02:47:47 append: `.task/os-trace-hotfix/ship-trace-token-marker-hotfix/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 02:48:02 `review.run`: passed — OK
- 2026-09-23 02:48:31 `verify`: passed — OK
