# Promote partial install recovery CLI

branch: `task/os/promote-partial-install-recovery-cli`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2259
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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria

- [ ] Transplant only the verified partial-install recovery CLI patch from commit `ab1b5f393a974833fb321b693addd0a4b4425279` onto current `stream/os`; do not carry inherited history from PR #2250.
- [ ] Prove the recovery behavior red on current stream, then green after the transplant.
- [ ] Pass strict review + full verify on the fresh stream-based task.
- [ ] Promote task to `stream/os`, then use the main-targeting stream review PR for the canonical canary release.
- [ ] Verify the canary channel resolves to the released immutable bundle. Do not promote beta/stable.

## plan

1. Copy only the two already-reviewed recovery test files from `ab1b5f39` onto current stream and run them red.
2. Apply only the production + test-selection files from `ab1b5f39`; exclude old task metadata/history.
3. Run focused recovery tests, selector contracts, strict review, and full verify.
4. Push and promote this fresh task into `stream/os`.
5. Release the resulting main-targeting stream review PR to canary with the canonical `release` tool, then verify canary manifest/installer state.

## Test-first contract

behavior under test: A verified hosted runtime exposes a usable `consuelo` recovery CLI and PATH entry before device auth/onboarding, while canonical `runtime/current` activation still waits for successful onboarding.
existing local pattern: Source task PR #2250 / commit `ab1b5f39` already established and reviewed the lifecycle materializer/private installer bridge/bootstrap ordering pattern; this integration task re-proves it against current `stream/os` without importing stale branch history.
new or changed tests: `packages/os/tests/lifecycle-command.test.ts`, `packages/os/tests/bootstrap-recovery-cli.test.ts`, plus existing workspace test-selection ownership regression.
focused red command: `bun x vitest run packages/os/tests/lifecycle-command.test.ts packages/os/tests/bootstrap-recovery-cli.test.ts` after copying tests only onto current stream.
expected red failure: tests compile but fail because current `stream/os` does not yet expose the pre-onboarding lifecycle materializer/private installer mode/bootstrap recovery ordering.
no-test waiver: not applicable.

- 2026-08-29 00:29:37 append: `.task/os/promote-partial-install-recovery-cli/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 00:29:37 fs.write: `.task/os/promote-partial-install-recovery-cli/workpad.md`
- 2026-08-29 00:30:27 fs.write: `.task/os/promote-partial-install-recovery-cli/workpad.md`
- 2026-08-29 00:32:19 fs.write: `.task/os/promote-partial-install-recovery-cli/workpad.md`

## validation evidence

- Fresh task started directly from current `stream/os`; stream context was 0 ahead / 0 behind at task creation.
- Tests-only red: 5 failed / 1 passed. Failures were exactly missing `materializeLifecycleCommand`, unknown `--materialize-lifecycle-command`, and missing `prepare_recovery_cli` bootstrap ordering.
- Applied only source hunks from `ab1b5f39`; generated registry patch was intentionally not applied because current stream had newer mappings.
- Regenerated current registry: 2676 tests, 2591 mapped, 85 unmapped, 75 rules.
- Focused green: recovery tests 6/6; targeted test-selection regression 1/1.

## key decisions

- Abandoned promotion of PR #2250 because it was 46 inherited commits ahead / 18 behind current stream with a 103-file compare and real merge conflicts. No force-push or broad merge was used.
- Fresh PR #2259 is the narrow integration surface based on current `stream/os`.

- 2026-08-29 00:30:27 append: `.task/os/promote-partial-install-recovery-cli/workpad.md`

## workspace-owned: validation evidence

- Fresh task started directly from current `stream/os`; stream context was 0 ahead / 0 behind at task creation.
- Tests-only red: 5 failed / 1 passed. Failures were exactly missing `materializeLifecycleCommand`, unknown `--materialize-lifecycle-command`, and missing `prepare_recovery_cli` bootstrap ordering.
- Applied only source hunks from `ab1b5f39`; generated registry patch was intentionally not applied because current stream had newer mappings.
- Regenerated current registry: 2676 tests, 2591 mapped, 85 unmapped, 75 rules.
- Focused green: recovery tests 6/6; targeted test-selection regression 1/1.
- 2026-08-29 00:31:13 `review.run`: passed — OK
- 2026-08-29 00:32:13 `verify`: passed — OK

## current status

- [x] Narrow patch transplanted onto current `stream/os` baseline.
- [x] Focused red -> green proven on the fresh stream baseline.
- [x] Strict review: 0 blocking issues / 0 findings; one nonblocking install-docs opportunity.
- [x] Full verify: `passed=true`, `publishValid=true`, base `HEAD`, bootstrap head `4eeda1329c7774f39e56fca4b4f72019de42daaa`.
- [ ] Push PR #2259 and promote to `stream/os`.
- [ ] Release the resulting main-targeting stream review PR to canary and verify the channel.

## notes for ko

- PR #2250 remains unpromoted because its inherited history is conflicted; PR #2259 is the clean stream-based replacement for the same eight-file fix.

- 2026-08-29 00:32:19 append: `.task/os/promote-partial-install-recovery-cli/workpad.md`
