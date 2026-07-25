# split consuelo and consuelo-dialer cli products

branch: `task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1647/split-consuelo-and-consuelo-dialer-cli-products
github pr: https://github.com/consuelohq/opensaas/pull/1647
started: 2026-07-25

## acceptance criteria

- [x] `consuelo` contains only OS lifecycle commands and excludes dialer/Twenty/Twilio/coaching runtime dependencies.
- [x] `consuelo-dialer` preserves existing sales/GTM commands and owns its config, output, telemetry, and CLI-mode globals.
- [x] Runtime bundles include the OS CLI and exclude the dialer product.
- [x] Legacy `consuelo os ...` routing is removed without a compatibility shim.
- [x] The final branch is synchronized with `stream/os-distribution` and passes focused tests, strict review, and publish-valid verification.
- [ ] The authoritative GitHub matrix passes and the task PR is merged into the stream.

## plan

1. Reconcile the existing Worker 30 branch with the completed distribution cleanup.
2. Preserve and verify the reviewed logger CLI-mode boundary correction.
3. Run the focused product-split suite and logger build, then strict review and full verification.
4. Publish, wait for authoritative CI, and merge task-to-stream only.

## current status

- Recovered existing PR #1647 and task session after distribution cleanup merged.
- GitHub updated the task branch onto current `stream/os-distribution`; local worktree fast-forwarded to remote SHA `f230f87bc4`.
- The independent review correction is reapplied: `@consuelo/logger` reads `__consuelo_dialer_cli_mode`, matching the dialer entrypoint, rather than the retired `__consuelo_cli_mode` global.

## files changed

- `packages/logger/src/index.ts`
- `packages/os/tests/cli-product-split.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- GREEN: Worker 30 product split suite passed 10/10 on the final distribution base (`trc_a00e84f25f9e`, `trc_82e40bf21d46`).
- GREEN: `@consuelo/logger` built successfully with the dialer-owned CLI-mode global (`trc_eb0365df2599`).
- RED: the original broad registry selected the full Twenty frontend target for one install-copy constant; the target produced 26.7 MB of output and exposed 127 pre-existing failing suites unrelated to this change (`trc_6157bd3268ed`).
- RED: added a precise-selection regression proving the registry could not let an exact cross-product contract own that file (`trc_9a716c1f3b54`).
- GREEN: added generic `exclusive` rule precedence, a precise `dialer-cli-install-copy` rule, and a product-boundary assertion for the final install command. Registry tests passed 9/9 and product tests passed 10/10 (`trc_82e40bf21d46`).
- GREEN: final affected-suite registry selected the exact Worker 30 contract plus the OS package rule, with no broad frontend suite; all selected commands passed (`trc_feaefa8c164b`).
- GREEN: review and registry selection now share exclusive ownership; selection regressions passed 13/13 and Worker 30 remained 10/10 (`trc_30669356a6e3`).
- GREEN: final strict review reports zero owned/blocking findings (`trc_4760079e7ace`).
- GREEN: full verification is publish-valid against current `stream/os-distribution` (`trc_8817c1014aa9`).
- 2026-07-25 19:54:21 `review.run`: passed — OK
- 2026-07-25 19:55:14 `review.run`: passed — OK
- 2026-07-25 19:56:07 `verify`: failed — COMMAND_FAILED
- 2026-07-25 19:57:46 `verify`: passed — OK

## key decisions

- CLI-safe plain logging is a dialer-owned concern. The OS lifecycle CLI does not enable the dialer global or inherit this behavior implicitly.
- Synchronization was performed through GitHub's PR update mechanism so the remote task branch remains authoritative and the final diff stays reviewable.
- Precise cross-product files may use an `exclusive` test-selection rule. Exclusivity claims only the files matched by that rule; other frontend files still select the broad frontend suite.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The task branch was three stream commits behind after PR #1651 and its infrastructure prerequisites landed. Local changes were stashed, the remote PR branch was updated from the stream, the worktree was fast-forwarded, and the two-file review fix reapplied cleanly.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/logger/project.json`
- `packages/os/tests/cli-product-split.test.ts`
- `packages/twenty-front/src/modules/navigation/constants/navigation-drawer-support-menu.constants.ts`
- `packages/workspace/scripts/lib/review-test-selection.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-07-25 19:56:46 apply-patch: `packages/workspace/tests/review-test-selection.test.js`
- 2026-07-25 19:57:05 apply-patch: `packages/workspace/scripts/lib/review-test-selection.js`

- 2026-07-25 19:58:00 apply-patch: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`