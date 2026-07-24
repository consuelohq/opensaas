# implement linux platform support

branch: `task/os-native/implement-linux-platform-support`
stream: `stream/os-native`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1645/implement-linux-platform-support
github pr: https://github.com/consuelohq/opensaas/pull/1645
started: 2026-07-24

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `packages/os/docs/linux-platform.md`
- `packages/os/scripts/lib/platforms/linux.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/linux-platform.test.ts`

## workspace-owned: files changed

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `packages/os/docs/linux-platform.md`
- `packages/os/scripts/lib/platforms/linux.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/linux-platform.test.ts`

## workspace-owned: activity log

- 2026-07-24 18:05:51 fs.write: `.task/os-native/implement-linux-platform-support/workpad.md`
- 2026-07-24 18:06:16 fs.write: `packages/os/tests/linux-platform.test.ts`
- 2026-07-24 18:07:15 fs.write: `packages/os/scripts/lib/platforms/linux.ts`
- 2026-07-24 18:09:05 fs.write: `packages/os/docs/linux-platform.md`
- 2026-07-24 18:09:52 fs.write: `.task/os-native/implement-linux-platform-support/workpad.md`
- 2026-07-24 18:17:41 fs.write: `.task/os-native/implement-linux-platform-support/workpad.md`
- 2026-07-24 18:20:11 fs.write: `.task/os-native/implement-linux-platform-support/workpad.md`

## workspace-owned: validation evidence

- 2026-07-24 18:10:13 `review.run`: passed — OK
- 2026-07-24 18:11:08 `review.run`: passed — OK
- 2026-07-24 18:11:15 `verify`: passed — OK
- 2026-07-24 18:28:02 `review.run`: passed — OK
- 2026-07-24 18:28:11 `verify`: passed — OK
- 2026-07-24 18:28:53 `verify`: passed — OK

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
bun run task:push -- --message "type(os-native): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/lifecycle/index.ts`
- `packages/os/scripts/lib/lifecycle/paths.ts`
- `packages/os/scripts/lib/platforms/linux.ts`
- `packages/os/scripts/lifecycle.ts`

## worker 20 execution contract

### acceptance criteria

- [ ] Reject unsupported OS, CPU, or libc before creating service files.
- [ ] Install and manage the promoted immutable runtime through a systemd user unit when available.
- [ ] Use a bounded foreground fallback when a systemd user manager is unavailable; never require Docker.
- [ ] Keep Consuelo-owned directories/files at strict user-only permissions and preserve user-owned visible content.
- [ ] Provide browser auth when available and a deterministic headless URL/code handoff otherwise.
- [ ] Expose structured Linux lifecycle status and diagnostics through the shared engine boundary.
- [ ] Remove only Consuelo-owned Linux service artifacts during uninstall.
- [ ] Cover clean install, alternate PATH, service lifecycle, auth fallback, update/rollback/repair integration, permissions, unsupported hosts, uninstall/reinstall, Ubuntu and a materially different distro CI lane.
- [ ] Preserve existing lifecycle/distribution regressions and merge only into `stream/os-native`.

### implementation plan

1. Add a typed Linux platform adapter under `scripts/lib/platforms/` that owns host detection, XDG paths, service unit rendering/install/restart/uninstall, permissions, auth handoff, and diagnostics.
2. Compose the adapter with `LifecycleServiceController`; leave bundle verification, atomic activation, rollback, repair, and retention in the shared lifecycle engine.
3. Add behavior-first tests for preflight fail-closed behavior, systemd and fallback operation, auth handoff, permissions, lifecycle composition, and uninstall preservation.
4. Add a native Linux/Ubuntu lane plus Debian container lane to the existing distribution workflow and document the supported matrix.
5. Run focused red/green, distribution and lifecycle regressions, review/verify, CI, CodeRabbit, and independent Grok review.

### Test-first contract

- Behavior under test: a Linux user can install/start/restart/diagnose/uninstall Consuelo OS without Docker, while unsupported architecture/libc fails before service mutation and headless auth remains usable.
- Existing local patterns: injected process runners from `lifecycle/service.ts`, temporary-home behavior tests from `lifecycle-engine.test.ts` and `lifecycle-retention-uninstall.test.ts`, stable JSON/typed result contracts.
- New test: `packages/os/tests/linux-platform.test.ts` plus workflow assertions in the same suite.
- Focused red command: `bun x vitest run tests/linux-platform.test.ts` from `packages/os`.
- Expected red failure: imports for the Linux platform adapter and its behavior contracts do not exist.

### discovery evidence

- Shared lifecycle engine already provides verified bundle download, immutable staging, atomic activation, health-gated rollback, repair, retention, and uninstall policy.
- Existing service controller contains only partial Linux uninstall behavior and still restarts through the macOS-oriented reload adapter.
- Architecture spike requires a systemd user service first and a separate bounded fallback; machine-wide privilege is out of scope.
- Existing CI has Ubuntu native coverage but no materially different Linux distro lane.

### issues and recovery additions

- Initial unscoped reads failed with ambiguous task selection; recovered by direct task-scoped reads.
- Initial task was mistakenly created on `stream/os-distribution` before the brief was readable; no product edits occurred. Failure and recovery are durable on PR #1644.
- `batch` does not propagate outer `taskSession` to child `fs.read` calls in this environment (traces `trc_1716183ffec9`, `trc_d7f52de1f8bc`); recovered with direct task-scoped `code.call`/`fs.read`.
- Broad explore query failed (`trc_8573695d1010`); a single-intent retry succeeded, then exact `fs.search` established current code truth.

- 2026-07-24 18:05:51 append: `.task/os-native/implement-linux-platform-support/workpad.md`

- 2026-07-24 18:06:16 write: `packages/os/tests/linux-platform.test.ts`

- 2026-07-24 18:07:15 write: `packages/os/scripts/lib/platforms/linux.ts`

- 2026-07-24 18:07:28 apply-patch: `packages/os/scripts/lib/platforms/linux.ts`

- 2026-07-24 18:07:50 apply-patch: `packages/os/scripts/lib/platforms/linux.ts`
- 2026-07-24 18:08:31 apply-patch: `packages/os/tests/linux-platform.test.ts`

- 2026-07-24 18:08:40 apply-patch: `packages/os/scripts/lifecycle.ts`

- 2026-07-24 18:08:56 apply-patch: `.github/workflows/consuelo-os-distribution-environments.yaml`
- 2026-07-24 18:09:05 write: `packages/os/docs/linux-platform.md`

- 2026-07-24 18:09:44 apply-patch: `packages/os/scripts/lib/platforms/linux.ts`
### implementation and validation progress

- Added `scripts/lib/platforms/linux.ts` with x64/arm64 and glibc/musl detection, XDG systemd-user unit management, bounded session fallback, strict permissions, browser/headless auth handoff, structured status, and ownership-safe uninstall.
- Wired the default lifecycle CLI service controller to the Linux adapter while preserving the existing macOS/Windows reload controller.
- Added Ubuntu-native and Debian 12 container CI coverage and documented the support matrix and fallback limitations.
- Focused red: missing Linux adapter module (`trc_6b91dcdaf5ed`).
- Intermediate red: fallback status re-probed systemd and changed manager (`trc_33c45496d389`); fixed by retaining a live fallback PID as the active manager and cleaning stale PID state.
- Focused green: 7 Linux platform tests pass.
- Shared lifecycle regression: 71 tests pass across Linux adapter, lifecycle engine, rollback/uninstall, and native lifecycle client (`trc_b87fc1819ce6`).
- Distribution regression: 76 pass, 7 existing TODO (`trc_ab5c0437d241`).
- Syntax/typecheck passes (`trc_b87fc1819ce6`).
- Typed `git.diff` returned an empty revision diff and typed `status` resolved the repository root instead of the supplied task session (`trc_ee624d64aba1`, `trc_6f3256c8bfc6`); recovered with task-scoped read-only `code.call` in the exact worktree (`trc_5dc421a364e9`).

- 2026-07-24 18:09:52 append: `.task/os-native/implement-linux-platform-support/workpad.md`

- 2026-07-24 18:10:37 apply-patch: `packages/os/scripts/lib/platforms/linux.ts`
- 2026-07-24 18:10:52 apply-patch: `packages/os/scripts/lib/platforms/linux.ts`

- 2026-07-24 18:12:15 apply-patch: `packages/os/.tmp-reviews/implement-linux-platform-support/grok-prompt.md`
### Grok wrapper recovery

- First exact Grok invocation exceeded the outer `code.call` deadline and returned no review object. Process inspection found two duplicate still-running wrapper trees, so the result is treated as incomplete/fail-closed.
- Recovery plan: terminate duplicate incomplete runs, invoke the exact wrapper once with stdout/stderr redirected into the task temp review directory, then bounded-poll the process and validate that the final output is non-empty valid JSON before posting.

Wait reason: Grok 4.5 independent review wrapper must complete and flush a structured JSON result.
Duration: poll every 30 seconds for up to 15 minutes.
Resume action: inspect the wrapper PID and parse `packages/os/.tmp-reviews/implement-linux-platform-support/grok-output.json` immediately after process exit.
Expected signal: wrapper process exits zero and output parses as the required review JSON object.
Fallback: treat cancelled, timed-out, empty, or invalid output as failed closed; record evidence and retry only through the same scoped wrapper route.

- 2026-07-24 18:17:41 append: `.task/os-native/implement-linux-platform-support/workpad.md`

- Recovery attempt through advertised `task.call` failed with live endpoint `UNKNOWN_TOOL_SCOPE` despite tools.search listing the tool. The prior background launch remained attached to the code.call process tree and was terminated at the outer timeout, producing empty output and SIGTERM evidence (`trc_831d681bbd09`, `trc_1a46ce2d8703`).
- Next recovery: launch the exact wrapper with `setsid -f`, closed stdin, and file-backed stdout/stderr/exit status, then apply the logged 30-second bounded poll plan.

- 2026-07-24 18:20:11 append: `.task/os-native/implement-linux-platform-support/workpad.md`

- 2026-07-24 18:27:43 apply-patch: `.github/workflows/consuelo-os-distribution-environments.yaml`
- 2026-07-24 18:27:43 apply-patch: `packages/os/scripts/lib/platforms/linux.ts`
- 2026-07-24 18:27:43 apply-patch: `packages/os/tests/linux-platform.test.ts`
