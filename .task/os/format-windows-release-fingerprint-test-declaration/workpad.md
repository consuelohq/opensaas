# format Windows release fingerprint test declaration

branch: `task/os/format-windows-release-fingerprint-test-declaration`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1730/format-windows-release-fingerprint-test-declaration
github pr: https://github.com/consuelohq/opensaas/pull/1730
started: 2026-07-29

## acceptance criteria

- [x] Resolve the valid formatting review finding without changing runtime behavior.
- [x] Pass the repository formatter and focused runtime-bundle suite.
- [x] Pass strict review and workspace verification.

## plan

1. Read the relevant code and update this plan before editing.

## review-finding discovery

- Scope: wrap only the long Windows release-fingerprint test declaration flagged on stream PR #1728.
- Acceptance: preserve test behavior and keep the declaration within the repository formatter width.
- Test-first waiver: this is a formatting-only review correction with no runtime behavior change; rerun the focused runtime-bundle suite after the edit.
- Exact-head rule: refresh `stream/os`, then restart all PR checks and independent review before merging main.

## current status

- Formatting correction, strict review, and verification are green; publish remains.

## files changed

- `packages/os/tests/distribution/runtime-bundle.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- Shortened the test description so the declaration fits formatter width and ran Prettier on the touched file.

## workspace-owned: validation evidence

- `bunx prettier --check packages/os/tests/distribution/runtime-bundle.test.ts` passed.
- `bun test packages/os/tests/distribution/runtime-bundle.test.ts` passed: 20 tests, 134 expectations.
- Strict review reported zero issues and zero blockers.
- Workspace verification passed with a publish-valid stamp.
- 2026-07-29 08:30:27 `review.run`: passed — OK
- 2026-07-29 08:30:39 `verify`: passed — OK
- 2026-07-29 08:30:59 `verify`: passed — OK

## key decisions

- Prettier does not split the original long string literal, so the test name was shortened while retaining the `should ... when ...` behavior description.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The first follow-up task was incorrectly based on `main`; its empty PR #1729 was closed, and this task was explicitly bootstrapped with `startFrom: stream`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-29 08:27:46 apply-patch: `.task/os/format-windows-release-fingerprint-test-declaration/workpad.md`
- 2026-07-29 08:28:04 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-29 08:29:18 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`

- 2026-07-29 08:30:01 apply-patch: `.task/os/format-windows-release-fingerprint-test-declaration/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/format-windows-release-fingerprint-test-declaration/current.json`, `.task/os/format-windows-release-fingerprint-test-declaration/session.json`, `.task/os/format-windows-release-fingerprint-test-declaration/verify.json`, `.task/os/format-windows-release-fingerprint-test-declaration/workpad.md`, `.task/tasks/os/format-windows-release-fingerprint-test-declaration.json`, `packages/os/tests/distribution/runtime-bundle.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
