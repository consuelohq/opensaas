# DEV-1628 Prevent OS browser freezes and support CDP recovery

branch: `task/os/dev-1628-prevent-os-browser-freezes-and-support-cdp-recovery`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2703
started: 2026-10-30

## acceptance criteria

- [x] Establish scoped test-first contract, prove pre-fix regression failure.
- [x] Prevent an owned new Chrome from blocking on full stderr pipe; bound helper diagnostics and ensure helper close/timeout cleanup.
- [x] Preserve explicit `--cdp` and `connect` routes without injecting profile/session lookup; failed helper can be retried.
- [x] Validate in isolated real Chrome with exact PID, fd2, CDP and login/profile isolation.
- [x] Mirror browser runtime and tests across OS and workspace and update CI test selection.
- [x] Document PID/profile-scoped safe recovery and limitations; never switch or terminate the existing Wet Stone browser.
- [ ] Complete review/verify gates and promote task to stream/os, pending publication.

## plan

1. Read Linear DEV-1628, OS/workspace browser integration, upstream native agent-browser CLI and test patterns.
2. Add red CDP routing and stderr/cleanup tests, implement safe Chrome executable override and bounded helper stderr, mirror shared surfaces.
3. Run focused tests plus isolated Chrome/CDP process smoke, update safe recovery docs and focused CI selection rule.
4. Review/verify, task.push immediately followed by task.pr into stream/os; no main merge, production runtime update or carrier initiation.

## files changed

- `packages/os/scripts/chrome-stderr-safe.sh`
- `packages/os/scripts/lib/browser/process.ts`
- `packages/os/tests/browser-process.test.ts`
- `packages/workspace/scripts/chrome-stderr-safe.sh`
- `packages/workspace/scripts/lib/browser/process.ts`
- `packages/workspace/scripts/lib/browser/service.ts`
- `packages/workspace/tests/browser-process.test.ts`
- `packages/workspace/tests/browser-service.test.ts`

## key decisions

- Native agent-browser 0.25.3 starts Chrome as a grandchild; OS's own piped stderr was already drained, but Chrome's fd 2 was an undrained 64 KiB pipe. Avoid patching compiled native binary. Use the supported `AGENT_BROWSER_EXECUTABLE_PATH` hook to launch Chrome via a tiny shell script redirecting stdio to /dev/null and preserving CDP fd3+. Bound only helper stderr to 64 KiB and include explicit truncation marker; diagnostics remain available in agent-browser errors, console and trace, not raw Chrome stderr.
- Respect explicit user-configured browser binary; default shim only when Google Chrome is present on macOS or an explicit `CONSUELO_BROWSER_CHROME_BINARY` override is set on Unix. Existing sessions are never altered.
- Explicit `--cdp`, `--cdp=...` or `connect` bypasses the OS default profile selection and session lookup. Keep `--cdp` explicit for repeated calls, because the native helper might not keep an attach sticky.
- CI rule `os-browser-headed-handoff` was extended to select all four small browser test files, including changes to the shell shim, instead of only old headed-handoff cases. Generated registry refreshed.

## notes for ko

- All new work and Chrome tests executed in isolated task worktree and disposable profile. No persisted `~/.agent-browser-ko` change, no active Wet Stone browser kill, no credentials copied, no dialing or provider calls.
- Isolated real Chrome 156 launched with fd2 `/dev/null`; owner PID 13783 stayed unchanged on OS wrapper `--cdp` attach and returned test title `DEV1628-CDP`. Session was scoped and disposable test profile removed after process stopped.
- OS/workspace browser source and launcher parity enforced by test; no main integration, runtime rollout or production deployment is part of this worker task.

## improvements noticed

- Native CLI `connect` and subsequent attach helper calls may need explicit CDP endpoint on every call. Direct `get title` after a fresh helper without explicit profile/CDP can create a wrong profile owner; docs now prefer always specifying it.

## errors i ran into

- Initial red phase: 9/29 tests failed as expected due to injected profile and absent process/shell guards. After implementation all four focused browser suites passed (60/60), plus targeted CI selector test passed.
- Initial real Chrome smoke lost explicit routing on its `get title` helper and failed to retrieve DevTools port, not a live-profile regression. Retest with exact disposable profile and explicit CDP succeeded; isolated profile cleaned.
- Repository-wide `audit({scripts:true,docs:true})` fails on pre-existing cross-repo documentation drift (4 missing/4 undocumented script names; 12,810 unresolved historical docs paths unrelated to DEV-1628). No unrelated repair attempted.

## Final validation for publication
- Focused browser tests: 60/60 across OS and workspace, including 192 KiB fake Chrome stderr, 192 KiB helper stderr, failed helper and retry, SIGTERM/SIGKILL timeout, lingering descendant pipe, explicit --cdp/connect routing and byte parity.
- Test-selector tests: 92/92, including regenerated registry exact rule.
- Isolated macOS Chrome test: 156.0.8078.79 launched with verified owned profile; PID 13783 fd2 was /dev/null, CDP port 56520 attached via OS browser wrapper and returned DEV1628-CDP without launching second owner; disposable profile cleaned.
- `checkFiles` syntax passed for all touched browser TypeScript files.
- `review.run`: zero blocking issues.
- `verify`: PASSED with publishValid=true, zero review findings and DB risks; all 9 selected CI suites passed including browser, test selection, audit unit, release freshness and lifecycle contracts. Stamp: `.task/os/dev-1628-prevent-os-browser-freezes-and-support-cdp-recovery/verify.json`.
- Scoped limitation: Chrome's native raw stderr is discarded to avoid both credential leaks and backpressure; use bounded helper stderr and browser console/trace. No deployment/live switch, user retains approval over production browser changes.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/browser.js`
- `packages/os/scripts/lib/browser/cli.ts`
- `packages/os/scripts/lib/browser/config.ts`
- `packages/os/scripts/lib/browser/process.ts`
- `packages/os/scripts/lib/browser/service.ts`
- `packages/os/scripts/lib/browser/types.ts`
- `packages/os/tests/browser-process.test.ts`
- `packages/os/tests/browser-service.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Task acceptance (DEV-1628)
- Resolve browser launcher stderr backpressure without losing diagnostic visibility or creating unbounded logs/buffers.
- Prove >64 KiB of generated child stderr cannot block continued browser/CDP-like work; cover normal exit, helper error, timeout, and cleanup.
- Explicit `--cdp <port>` / `--cdp=<port>` and `connect <port|url>` must attach to an existing Chrome without injecting the shared `--profile` or launching a second profile owner; recovery after a failed helper must be possible.
- Document safe scoped recovery and ownership checks; preserve existing Wet Stone Chrome/login, no real-provider calls, no runtime switch.
- Maintain byte-identical OS/workspace browser runtime copies, focused green tests, review + verify, task.push -> task.pr into stream/os.

## Test-first contract
behavior under test: OS browser launcher drains or redirects >65536 bytes of stderr while a concurrent CDP-like child operation progresses; output retention bounded, exited/failed helpers settle and can be retried; explicit existing-CDP attach bypasses default profile/session management.
existing local pattern: packages/os/tests/browser-service.test.ts uses an injected BrowserContext process recorder; packages/os/scripts/lib/browser/process.ts implements the subprocess wrapper; packages/os and packages/workspace browser runtime files have strict byte parity.
new or changed tests: extend browser-service tests for --cdp and connect no-profile and helper failure retry; add focused process integration tests with an isolated helper child writing >64KiB stderr and exercising close/exit/timeout handling. May add isolated headed/CDP runtime smoke if feasible without touching the persistent profile.
focused red command: bunx vitest run packages/os/tests/browser-service.test.ts packages/os/tests/browser-process.test.ts (within managed worktree).
expected red failure: explicit CDP injects --profile; stress/cleanup test fails against current unbounded stderr capture or missing reusable launcher interface.
no-test waiver: none.

## Investigation
- Live package: /opt/homebrew/bin/agent-browser -> installed native 0.25.3 darwin-arm64 binary. OS wrapper already pipes + continuously reads immediate agent-browser stdout/stderr, but retains both without bound. Captured 64KiB Chrome stderr is a different nested process; cannot assert the OS wrapper alone is its cause. Do not patch native binary or interrupt currently owned Chrome.
- CDP root cause confirmed in runBrowserCommandEffect: explicit-routing detector only recognizes --profile/--session, not --cdp or connect.

- 2026-10-30 19:12:06 append: `.task/os/dev-1628-prevent-os-browser-freezes-and-support-cdp-recovery/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/chrome-stderr-safe.sh`
- `packages/os/scripts/lib/browser/process.ts`
- `packages/os/tests/browser-process.test.ts`
- `packages/workspace/scripts/chrome-stderr-safe.sh`
- `packages/workspace/scripts/lib/browser/process.ts`
- `packages/workspace/scripts/lib/browser/service.ts`
- `packages/workspace/tests/browser-process.test.ts`
- `packages/workspace/tests/browser-service.test.ts`

## workspace-owned: activity log

- 2026-10-30 19:12:06 fs.write: `.task/os/dev-1628-prevent-os-browser-freezes-and-support-cdp-recovery/workpad.md`
- 2026-10-30 19:14:14 apply-patch: `packages/os/tests/browser-service.test.ts`
- 2026-10-30 19:14:37 write: `packages/os/tests/browser-process.test.ts`
- 2026-10-30 19:14:37 fs.write: `packages/os/tests/browser-process.test.ts`
- 2026-10-30 19:15:55 write: `packages/os/scripts/lib/browser/process.ts`
- 2026-10-30 19:15:55 fs.write: `packages/os/scripts/lib/browser/process.ts`
- 2026-10-30 19:16:02 apply-patch: `packages/os/scripts/lib/browser/service.ts`
- 2026-10-30 19:16:11 write: `packages/os/scripts/chrome-stderr-safe.sh`
- 2026-10-30 19:16:11 fs.write: `packages/os/scripts/chrome-stderr-safe.sh`
- 2026-10-30 19:16:11 write: `packages/workspace/scripts/chrome-stderr-safe.sh`
- 2026-10-30 19:16:11 fs.write: `packages/workspace/scripts/chrome-stderr-safe.sh`
- 2026-10-30 19:16:19 write: `packages/workspace/scripts/lib/browser/process.ts`
- 2026-10-30 19:16:19 fs.write: `packages/workspace/scripts/lib/browser/process.ts`
- 2026-10-30 19:16:19 write: `packages/workspace/scripts/lib/browser/service.ts`
- 2026-10-30 19:16:19 fs.write: `packages/workspace/scripts/lib/browser/service.ts`
- 2026-10-30 19:19:27 apply-patch: `packages/os/SCRIPTS.md`
- 2026-10-30 19:19:27 apply-patch: `packages/workspace/SCRIPTS.md`
- 2026-10-30 19:19:40 apply-patch: `packages/os/tests/browser-service.test.ts`
- 2026-10-30 19:19:40 apply-patch: `packages/os/tests/browser-process.test.ts`
- 2026-10-30 19:20:28 fs.write: `packages/workspace/tests/browser-service.test.ts`
- 2026-10-30 19:20:29 fs.write: `packages/workspace/tests/browser-process.test.ts`

## workspace-owned: validation evidence

- 2026-10-30 19:20:10 `checkFiles`: passed — OK
- 2026-10-30 19:20:10 `audit`: failed — COMMAND_FAILED
- 2026-10-30 19:20:28 write: `packages/workspace/tests/browser-service.test.ts`
- 2026-10-30 19:20:29 write: `packages/workspace/tests/browser-process.test.ts`
- 2026-10-30 19:21:41 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-10-30 19:21:41 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-10-30 19:22:41 apply-patch: `.task/os/dev-1628-prevent-os-browser-freezes-and-support-cdp-recovery/workpad.md`
- 2026-10-30 19:23:59 `review.run`: passed — OK
- 2026-10-30 19:24:40 `verify`: passed — OK

- 2026-10-30 19:24:48 apply-patch: `.task/os/dev-1628-prevent-os-browser-freezes-and-support-cdp-recovery/workpad.md`