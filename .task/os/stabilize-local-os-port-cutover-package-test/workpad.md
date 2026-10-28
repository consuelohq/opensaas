# stabilize local os port cutover package test

branch: `task/os/stabilize-local-os-port-cutover-package-test`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2504
started: 2026-09-21

## acceptance criteria

- [x] Launchd-specific port-cutover assertions explicitly provision the macOS path instead of inheriting the test runner OS.
- [x] The focused port-cutover suite remains GREEN 10/10 on macOS and is deterministic on Linux CI because platform selection is now explicit.
- [ ] Promote into `stream/os`, rerun stream CI, then release PR #2499 to canary and update the local node.

## plan

1. Reproduce/inspect the CI ENOENT failures and focused local pass.
2. Trace connector materialization platform branching.
3. Make the tests that assert launchd plists explicitly request `platform: 'darwin'`.
4. Run focused GREEN, promote, then use stream CI as the Linux/full-package gate before release.

## files changed

- `packages/os/tests/local-os-port-cutover.test.ts` — make the three launchd-plist scenarios explicit macOS provisioning tests.

## key decisions

- Do not change production provisioning. `materializeWorkspaceConnectorBootstrap` correctly emits systemd on Linux and launchd plists on macOS; the test was accidentally relying on the developer machine's `process.platform` while asserting a macOS artifact.
- Preserve every existing port/plist assertion; only make the intended platform part of the test fixture.

## notes for ko

- Root cause is CI platform, not cache work or test concurrency: these tests pass locally on macOS because `options.platform ?? process.platform` selects launchd, but GitHub Linux correctly selects systemd and therefore never creates the plist the test tries to read.
- Focused GREEN after the fix: `local-os-port-cutover.test.ts` 10/10, trace `trc_67c068971f87`.
- The previous stream CI run reached this as the only deterministic remaining `@consuelo/os` package failure after the script-parity and task-skill migration blockers were repaired.

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

## Test-first contract

behavior under test: local OS reprovisioning always materializes the expected cloudflared connector plist for migrated/default, persisted custom, and explicit legacy-port cases, including when the full `@consuelo/os` package suite runs concurrently.
existing local pattern: `packages/os/tests/local-os-port-cutover.test.ts` provisions isolated temp homes and asserts generated chatgpt config plus cloudflared plist contents; focused execution passes, while full package CI reproducibly loses generated plist files in multiple cases.
new or changed tests: first isolate the package-suite interference and add/adjust the narrowest regression around the shared mutable state or test isolation boundary that causes the plist to disappear; do not weaken plist assertions.
focused red command: reproduce with the same `@consuelo/os` package-test command used by registry CI, then reduce to the smallest pair/subset that makes `tests/local-os-port-cutover.test.ts` fail.
expected red failure: ENOENT reading `node/security/generated/com.consuelo.os.cloudflared.connector-*.plist` despite the same test passing in isolation.
no-test waiver: not applicable.

- 2026-09-21 04:37:58 append: `.task/os/stabilize-local-os-port-cutover-package-test/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 04:37:58 fs.write: `.task/os/stabilize-local-os-port-cutover-package-test/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`

- 2026-09-21 04:38:30 apply-patch: `packages/os/tests/local-os-port-cutover.test.ts`

- 2026-09-21 04:38:53 apply-patch: `.task/os/stabilize-local-os-port-cutover-package-test/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 04:39:21 `review.run`: passed — OK
