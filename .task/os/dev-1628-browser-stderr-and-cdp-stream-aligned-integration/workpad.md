# DEV-1628 Browser stderr and CDP stream aligned integration

branch: `task/os/dev-1628-browser-stderr-and-cdp-stream-aligned-integration`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2705
started: 2026-10-30

## acceptance criteria

- [x] Confirm the 64 KiB Chrome stderr backpressure and missing explicit CDP routing regressions from current stream baseline.
- [x] Preserve the persistent browser owner on explicit `--cdp`, `--cdp=` and `connect` and permit retry after helper exit.
- [x] Keep owned Chrome fd2 nonblocking, bound helper stderr diagnostics, and ensure timeout/descendant cleanup.
- [x] Preserve OS/workspace runtime byte parity, executable file modes, CI test-selection and script-parity classifications.
- [x] Validate with a disposable real Chrome profile and exact CDP owner PID; do not touch the existing Wet Stone login/session.
- [x] Record safe scoped recovery instructions and independent upstream failures.
- [x] Complete required review/verify and prepare non-force publication and stream promotion.

## plan

1. Recover tested implementation from DEV-1628 initial task without introducing unrelated main commits, in an isolated managed task started from stream/os.
2. Copy only regression tests; prove red (22 failing / 38 passing) on current stream baseline before production changes.
3. Copy parity-safe browser implementation and executable Chrome shim; patch only the existing stream CI browser selector rule, regenerate registry, classify shim in script-parity audit.
4. Run focused green tests, isolated Chrome/CDP smoke, review and full verify; publish via exact-head-safe task workflow with executable mode intact. Keep main and live Chrome unchanged.

## files changed

- none yet

## key decisions

- The native `agent-browser` CLI 0.25.3 starts Chrome as a child with stderr that may become an unread pipe. OS now injects a Chrome executable shim through the supported environment override on macOS (or explicit Unix Chrome path), redirects Chrome's fd0-2 to /dev/null, preserves CDP fd3+, and buffers only the helper's stderr (64 KiB tail with truncation marker). The user-provided browser executable override wins.
- Explicit CDP/connect arguments bypass OS default profile selection entirely. Attach requests should retain the verified `--cdp` endpoint; later commands, especially close, must specify the same scoped routing or they may spawn a fresh profile.
- `stream/os` already has independent DEV-1630/DEV-1637 and media/Chrome UI changes. Only patch the browser selector rule, not upstream CI rules; update the script-parity classification precisely and regenerate the derived registry.
- The previous GitHub API task.push dropped shell executable bits (100755 -> 100644). Keep the executable bits on the remote task branch via a normal non-force Git push; do not use force or bypass verification.

## notes for ko

- Current branch is PR #2705, based on `stream/os` `fe9adc9fb933914e046e7f48b5dcbc22ab2c762c`. PR #2703 is superseded and must be closed only after successful promotion of this branch.
- All browser changes in OS and workspace match byte-for-byte. The Chrome shim is included by the runtime bundle's default `scripts` discovery path.
- New branch tests: 154/154 passed (60 browser, 93 test selector, 1 parity audit). A disposable Chrome launch from this branch confirmed fd2=/dev/null, CDP port 59876, title DEV1628-STREAM-CDP and unchanged verified owner PID 84907. The final `close` command without explicit profile failed (upstream native helper's default profile routing); the disposable Chrome process and temporary profile are no longer present. It was never the persistent user browser.
- `review.run` reports zero blocking findings. `verify` passed with `publishValid=true`: all 10 selected suites green (including browser, selector, parity audit, release freshness, lifecycle and docs) and DB guard zero risks. Verification stamp: `.task/os/dev-1628-browser-stderr-and-cdp-stream-aligned-integration/verify.json`.

## improvements noticed

- It is unsafe to invoke a new `agent-browser close` helper without the verified `--profile` or `--cdp` routing, even after a successful session-scoped CDP attach; user docs warn against a global close and recommend keeping the routing explicit.

## errors i ran into

- Original PR #2703 could not merge into stream due generated registry conflict. After a task-branch merge with stream, the full verification selected unrelated upstream OS package tests; the script-parity gap was fixed, but that broad suite failed on preexisting corrupt PNG signatures (`efbfbd504e470d0a` in both `origin/main` and `origin/stream/os`) plus Playwright trace-request-budget timeouts. Do not overwrite design/trace owners' files to satisfy an unrelated DEV-1628 gate.
- New branch red phase produced exactly 22 failing tests before the implementation moved (missing `runAgentBrowser`, missing shell shim and injected default profile). With the implementation, focused tests are green.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract (stream-aligned DEV-1628)
- behavior under test: Chrome launch must not block when stderr exceeds 64 KiB; helper diagnostics bounded and cleanup/retry deterministic; explicit `--cdp <port>`, `--cdp=<uri>` and `connect` must not acquire the persistent OS profile. Browser executable launcher must be executable and preserve fd3+ for CDP.
- existing local pattern: original DEV-1628 task branch `task/os/dev-1628-prevent-os-browser-freezes-and-support-cdp-recovery` built tests/implementation from source main; strict parity between `packages/os` and `packages/workspace`; received pre-merge full verify PASS with 9 CI suites, 60 browser and 92 CI selector tests. Isolated Chrome PID 13783 and title DEV1628-CDP proven.
- new or changed tests: copy tested OS/workspace `browser-service.test.ts` plus new `browser-process.test.ts` tests; add exact shell entry in script-parity fixture and CI test-selection rule. Run red tests on current stream baseline before moving production implementation.
- focused red command: `bunx vitest run packages/os/tests/browser-service.test.ts packages/os/tests/browser-process.test.ts packages/workspace/tests/browser-service.test.ts packages/workspace/tests/browser-process.test.ts`.
- expected red failure: default profile erroneously injected on `--cdp` / `connect`, missing `runAgentBrowser` process API, missing Chrome shell shim.
- no-test waiver: none.

## Why a second managed task session is necessary
- Initial task PR #2703 was created from `main`, while `stream/os` had diverged. PR merge initially failed due a generated CI registry conflict; independent stream integration in the old worktree made 22 unrelated suites mandatory. Broad OS test baseline failed on preexisting corrupted `packages/os/assets/consuelo-mark*.png` (present in current stream), plus a Playwright trace request timeout. The browser-specific tests remain green. Preserve other owners' binaries and trace tests instead of changing them in this task.
- New isolated session starts directly from current `stream/os` SHA `fe9adc9f` to scope review and test selector to this change only. Once this branch is fully verified and merged into stream, close superseded PR #2703 without force pushing or changing main.
- Must preserve executable mode 100755 on new shell scripts: GitHub API task.push previously converted modes to 100644, which breaks native Chrome shim execution. Use standard non-force Git commit and push to retain file modes, after verifying. No runtime update, direct persistent profile changes, deployment or carrier calls.

- 2026-10-30 19:37:29 append: `.task/os/dev-1628-browser-stderr-and-cdp-stream-aligned-integration/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-30 19:37:29 fs.write: `.task/os/dev-1628-browser-stderr-and-cdp-stream-aligned-integration/workpad.md`

- 2026-10-30 19:38:13 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-10-30 19:38:20 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`

## workspace-owned: validation evidence

- 2026-10-30 19:38:48 `checkFiles`: passed — OK
- 2026-10-30 19:40:03 `review.run`: passed — OK
- 2026-10-30 19:40:44 `verify`: passed — OK
- 2026-10-30 19:40:55 `verify`: passed — OK

## workspace-owned: files read

- none yet

- 2026-10-30 19:39:46 apply-patch: `.task/os/dev-1628-browser-stderr-and-cdp-stream-aligned-integration/workpad.md`

- 2026-10-30 19:41:03 apply-patch: `.task/os/dev-1628-browser-stderr-and-cdp-stream-aligned-integration/workpad.md`