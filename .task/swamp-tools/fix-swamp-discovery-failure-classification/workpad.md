# fix swamp discovery failure classification

branch: `task/swamp-tools/fix-swamp-discovery-failure-classification`
stream: `stream/swamp-tools`
pr: https://github.com/consuelohq/opensaas/pull/2540
started: 2026-09-22

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
bun run task:push -- --message "type(swamp-tools): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: negative caching applies only when the Swamp executable is genuinely unavailable (`ENOENT`); timeouts, nonzero exits, parse errors, and other transient discovery failures retry immediately. New test titles follow the repository `should [behavior] when [condition]` convention.
existing local pattern: `runtime-tool-providers-swamp.test.ts` already covers missing provider, timeout, large output, negative cache, incomplete workflow recovery, collisions, batch, and scoped execution with a real fake CLI process.
new or changed tests: change the nonzero model-search failure assertion to prove immediate retry; add a missing-binary recovery assertion proving ENOENT is negative-cached; rename the four cited test titles and the newly added provider tests to the repository naming convention.
focused red command: `bun --cwd packages/os vitest run tests/runtime-tool-providers-swamp.test.ts`.
expected red failure: a nonzero model-search failure is still classified provider-unavailable and cached, so the second call will not spawn again.
no-test waiver: not applicable.

## Acceptance criteria

- Cache only ENOENT discovery failures for the short failure TTL.
- Treat timeout/nonzero/parse/other launch failures as incomplete/transient and do not negative-cache them.
- Keep incomplete workflow discovery uncached.
- Update cited test names to repository style without splitting paired scenarios.
- Preserve all earlier Swamp provider fixes and pass focused tests, real Swamp smoke, strict review, canonical verify, then merge and ship Canary.

- 2026-09-22 21:04:41 append: `.task/swamp-tools/fix-swamp-discovery-failure-classification/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-22 21:04:41 fs.write: `.task/swamp-tools/fix-swamp-discovery-failure-classification/workpad.md`
- 2026-09-22 21:06:30 fs.write: `.task/swamp-tools/fix-swamp-discovery-failure-classification/workpad.md`
- 2026-09-22 21:08:51 fs.write: `.task/swamp-tools/fix-swamp-discovery-failure-classification/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`

- 2026-09-22 21:05:02 apply-patch: `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- 2026-09-22 21:05:23 apply-patch: `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`

## workspace-owned: validation evidence

- 2026-09-22 21:05:29 `checkFiles`: passed — OK
- 2026-09-22 21:06:45 `review.run`: passed — OK
- 2026-09-22 21:07:49 `verify`: passed — OK
- 2026-09-22 21:08:39 `verify`: passed — OK

## Evidence

- Focused red reproduced both classification failures: timeout returned `provider-unavailable`, and nonzero model-search failure was negative-cached; trace `trc_3553069e08b2`.
- Focused green: 4 files / 743 tests passed after limiting negative caching to ENOENT; trace `trc_fec402c5241a`.
- `checkFiles` passed changed production/test files; trace `trc_5cb806618f59`.
- Current checksum-verified Swamp `20260922.204047.0-sha.4957bcbd` passed the real compatibility smoke; trace `trc_f893869e5471`.
- Disposable Swamp download cleaned again; trace `trc_2aec6b08098c`.
- CodeRabbit timeout naming nit was not applied: `timeoutMs` is an existing public/internal convention throughout the facade and changing it here alone would reduce consistency while adding no behavioral safety.

- 2026-09-22 21:06:30 append: `.task/swamp-tools/fix-swamp-discovery-failure-classification/workpad.md`

## Final verification

- Strict review: 0 blockers / 0 findings; trace `trc_42e1aa98a1c8`.
- Canonical verify: `passed: true`, `publishValid: true`; final trace `trc_c41f36cecd31` (the same head also passed in `trc_4c9df16f0385`).

- 2026-09-22 21:08:51 append: `.task/swamp-tools/fix-swamp-discovery-failure-classification/workpad.md`
