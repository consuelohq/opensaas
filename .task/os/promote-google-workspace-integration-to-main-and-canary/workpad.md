# Promote Google Workspace integration to main and canary

branch: `task/os/promote-google-workspace-integration-to-main-and-canary`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2210/promote-google-workspace-integration-to-main-and-canary
github pr: https://github.com/consuelohq/opensaas/pull/2210
started: 2026-08-26

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 05:59:43 fs.write: `.task/os/promote-google-workspace-integration-to-main-and-canary/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 06:03:01 `review.run`: passed — OK
- 2026-08-26 06:04:03 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- Promote the already-reviewed Google Workspace integration from `stream/os` onto current `main` without importing unrelated stream history.
- Preserve the pinned `gog` v0.38.1 runtime, native `google` skill/tool, signed-node first-use OAuth bootstrap, approval boundaries, generated manifests/types, and MIT notice reconciliation.
- Release exactly the focused merge SHA to canary and verify Device Authority plus local Google status/auth behavior.

existing local pattern:
- Feature implementation was developed test-first in task PR #2205 and attribution follow-up #2208; both passed strict review and publish-valid verify before landing on `stream/os`.
- This task is a backport/release integration, not new feature implementation.

new or changed tests:
- No new behavior-specific tests planned. Re-run the Google focused suites and shared manifest/device-auth/install contracts against current `main` after backport/regeneration.

focused red command:
- Not applicable: the implementation and its tests already exist together in the reviewed source commits.

expected red failure:
- Not applicable for this promotion-only task.

no-test waiver:
- Waiver for creating a new RED test only. The source feature already completed RED/GREEN/strict-review/full-verify in #2205/#2208. This task must still run focused tests, strict review, and full verify after resolving current-main integration drift before any merge/release.

## current status

- Device Authority now has `GOOGLE_WORKSPACE_OAUTH_CLIENT_ID` and `GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET`, sourced directly from the existing local gog credential file without printing either value.
- Backported only feature commit `bfd4dd7150` and MIT attribution commit `3c07e1ec61` onto current `main`; the only cherry-pick conflict was generated test-selection registry data, which was regenerated from current main.
- Generated surfaces are current: 12 bundled skills, 162 tools, 15 core tools, and refreshed workspace types/docs/test-selection registry.
- Current-main compatibility exposed one Google-specific facade bug: `GoogleInput` omitted `dryRun`, so Zod stripped the field and synthetic dry-run reached the executable handler. Added the standard `dryRunField`; targeted Google dry-run now returns `DRY_RUN` without planning/executing a command.
- Focused Google/shared integration packet passes: 10 files / 106 tests, plus the targeted Google facade dry-run contract.
- The broad facade suite still has unrelated pre-existing media/subagent/fs failures on current main; this promotion task does not modify those areas.

- 2026-08-26 05:59:43 append: `.task/os/promote-google-workspace-integration-to-main-and-canary/workpad.md`

## workspace-owned: files read

- `packages/os/tools/github/manifest.ts`
- `packages/os/tools/google/handler.ts`
- `packages/os/tools/google/manifest.ts`
- `packages/os/tools/google/schema.ts`

- 2026-08-26 06:01:58 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`

- 2026-08-26 06:02:28 apply-patch: `.task/os/promote-google-workspace-integration-to-main-and-canary/workpad.md`
