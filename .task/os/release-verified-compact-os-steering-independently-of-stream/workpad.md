# Release verified compact OS steering independently of stream

branch: `task/os/release-verified-compact-os-steering-independently-of-stream`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2741
started: 2026-10-31

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

## Scope and acceptance criteria

- [ ] Cherry-pick only the three proven steering-projection changes from task PR #2740 / stream/os commit 051b11f596248265604bf2e255a7c52d052288de into current main without merging stream/os history.
- [ ] Preserve main's independent trace, security, and routing changes; no forced merges or changes to checks.
- [ ] Run focused red/green steering regressions, typecheck, review and verify on exact branch.
- [ ] Rebase task PR #2741 onto main, enforce CI and review, merge exact tested head to main only when safe.
- [ ] Release to canary (the installed node's existing channel) and update this OS Mac to exactly released version; smoke test live get_steering.
- [ ] Search actual historical user-authored `system.md` independently; leave live file unchanged pending high-confidence recovery.

## Test-first contract

behavior under test: getSteering exposes an offline count and no offline node details, installed skills titles + unchanged descriptions only, and compact names of effective core tools with on-demand tools.search; authoritative user system.md still wins and routing is fail-closed.
existing local pattern: packages/os/tests/os-get-steering-trace.test.ts with isolated home and node routing fixtures, cwd packages/os.
new or changed tests: from verified stream commit 051b11f... for node, skill, core manifest, fallback and disabled selection.
focused red command: bunx vitest run tests/os-get-steering-trace.test.ts (cwd packages/os), after porting tests only.
expected red failure: main's existing renderer includes offline node bodies, JSON skills and full tool manifest; assertions will fail.
no-test waiver: none.

## Procedure

1. Diff main and stream/os exact three paths. Update tests first, red then source changes green, respecting current main changes.
2. Verify with OS review gate and selected regressions.
3. Keep task PR #2741 targeting main via GitHub PR base adjustment; task.pr must be taskOnly so it does not merge into stream.
4. Use OS release tool only after exact-head CI and review; default auto-update installed Mac.

## Context

- User explicitly authorized isolated main release, preserving stream/os unrelated work, and OS Mac update.
- Their newest user-authored system.md remains unrecovered; historical repo dev-steering.md and system_prompt.md are confirmed not it.

- 2026-10-31 05:52:54 append: `.task/os/release-verified-compact-os-steering-independently-of-stream/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 05:52:54 fs.write: `.task/os/release-verified-compact-os-steering-independently-of-stream/workpad.md`
- 2026-10-31 05:54:06 fs.write: `.task/os/release-verified-compact-os-steering-independently-of-stream/workpad.md`
- 2026-10-31 05:54:47 fs.write: `.task/os/release-verified-compact-os-steering-independently-of-stream/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/os.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`

- 2026-10-31 05:53:35 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-10-31 05:53:48 apply-patch: `packages/os/scripts/os.ts`
- 2026-10-31 05:53:48 apply-patch: `packages/os/scripts/lib/steering-snapshot-cache.ts`
## Validation and isolation evidence (2026-10-31)

- Exact-source comparison: `steering-snapshot-cache.ts` and `os-get-steering-trace.test.ts` match merged stream/os byte for byte; `os.ts` retains main's `finishSteeringExecution(...).result.content` field as the only difference (no unrelated stream code merged).
- RED: 6 failures / 12 passes in `tests/os-get-steering-trace.test.ts` with tests ported before renderer; failures were expected from uncompressed main behavior.
- GREEN: 25/25 in steering trace, selection CLI, canonical authority tests.
- `bunx nx run consuelo-os:typecheck`: passed.
- `git diff --check`: passed.
- Current Mac: Consuelo OS 0.1.143 on canary; targeted channel for isolated release: canary.
- Scope remains only 3 OS source/test files plus generated task metadata.

## Next publish gates

- Run managed verify (review, selected critical suites, stamp).
- Push task PR #2741, explicitly retarget to `main`, verify exact diff, checks and code review.
- Invoke approved OS release operation to canary, let it enforce safe main merge and installed version.

- 2026-10-31 05:54:06 append: `.task/os/release-verified-compact-os-steering-independently-of-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 05:54:42 `verify`: passed — OK

## Managed verify result

- Exact-task verify passed: publishValid=true, 8 selected critical suites passed, zero failed suites, zero review findings, code quality/typecheck/DB guard passed.
- Next: task.push, retain task-only PR #2741, retarget main (no task.pr merge to stream), check CI before release.

- 2026-10-31 05:54:47 append: `.task/os/release-verified-compact-os-steering-independently-of-stream/workpad.md`
