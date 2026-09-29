# make detached verify safe for internal callers and self-hosting

branch: `task/tooling-reliability/make-detached-verify-safe-for-internal-callers-and-self-hosting`
stream: `stream/tooling-reliability`
pr: https://github.com/consuelohq/opensaas/pull/2595
started: 2026-09-26

## acceptance criteria

- [x] Agent-facing typed `verify` with a task session executes the verify implementation from that task worktree, so verify changes can self-host instead of silently loading stale controller-main code.
- [x] Internal workflows that require a completed gate must opt into foreground verification; they must never interpret `VERIFY_PENDING` + exit 0 as a successful verification.
- [x] Both workspace and OS `stream-sync` copies invoke verify with `--foreground` and push only after the completed foreground gate passes.
- [x] Both workspace and OS `confirm --verify` paths invoke verify with `--foreground` because they synchronously classify pass/fail evidence.
- [x] Release remains runtime-scoped and durable; add regression coverage so a stale repository checkout cannot make the typed release tool fall back to repository-local synchronous release code.
- [x] Focused tests prove the routing/caller contracts before implementation; strict review and full task verify pass before promotion.

## plan

1. Freeze the live regressions in focused tests: stream.sync must include foreground verify, confirm must include foreground verify, and typed task verify command planning must use the task worktree.
2. Patch internal callers to request foreground verification explicitly.
3. Patch facade command cwd routing so task-scoped `verify` executes from the resolved task worktree; leave generic non-task controller tools unchanged.
4. Add/strengthen release execution-scope regression coverage.
5. Run focused tests and a live task-scoped typed verify smoke; strict review, verify, push, merge.

## Test-first contract

behavior under test:
- internal synchronous consumers of verify use `--foreground` and cannot mistake `VERIFY_PENDING` for pass.
- a task-scoped typed verify plan has cwd equal to the resolved task worktree, not the stale controller checkout.
- release tool command metadata remains `executionScope: runtime`.

existing local pattern:
- `stream-sync.js` and `confirm.js` call `bun run verify ... --json` synchronously and currently omit `--foreground`.
- `resolveWorkspaceCommandCwd` sends only code-run/code-call and task:/stream: scripts to task worktrees; plain `verify` falls back to controller cwd even when a task worktree is resolved.
- release's OS tool handler already declares `executionScope: 'runtime'`; this needs a regression guard because the currently installed older runtime did not yet have that behavior.

new or changed tests:
- add a focused contract test covering both stream-sync and confirm copies for `--foreground`.
- extend facade tests to assert task-scoped verify command plans run from the resolved task worktree.
- extend tool package/manifest coverage to assert release is runtime-scoped.

focused RED command:
`bun x vitest run packages/workspace/tests/verification.test.js packages/os/tests/facade/facade.test.ts packages/os/tests/release-tool-surface.test.ts -t "foreground verify|task-scoped verify|runtime-scoped release"`

expected RED:
- stream-sync/confirm sources omit `--foreground`.
- verify command planning uses controller cwd instead of taskWorktree.
- release runtime-scope assertion may already pass on source; it is a regression guard, not the primary red.

no-test waiver: not applicable.

## current status

- Reproduced a safety regression live: `stream.sync` received `VERIFY_PENDING` from detached verify, treated exit 0 as pass, and pushed the stream before the detached verifier completed.
- Reproduced self-hosting mismatch: direct task-worktree verify returns pending in ~0.4s, while typed verify on the older installed/controller path times out because it loads stale controller-main tooling.
- Reproduced the same stale-controller symptom on typed release; source already contains the durable runtime-scoped release implementation, but the installed older runtime does not yet.
- Canary release bootstrap is running durably as `release-e83759cbca102b616a294383` using the merged source implementation while this follow-up closes the caller/routing gap.
- Focused RED reproduced both follow-up defects: synchronous verify consumers lacked `--foreground`, and the facade planned task-scoped verify from controller cwd instead of the resolved task worktree. The release runtime-scope regression was already green.
- Production fix is implemented: both stream-sync copies and both confirm copies explicitly use `--foreground`; task-scoped verify command planning now uses `taskWorktree`; release runtime-scope remains guarded.
- Focused GREEN passed: 3 targeted tests across verification/facade/release surface, plus syntax checks for all four synchronous caller scripts and `git diff --check`.
- Added a test-selection regression for the synchronous `confirm` callers and mapped both OS/workspace copies to the focused publish gate. RED selected only the broad OS package suite; GREEN selects `workspace-publish-gate` and suppresses the broad package test from selected suites.
- Broader focused validation passed: 91 workspace verification/selector tests, task-scoped facade routing contract, 6 release-surface tests, 4 stream-sync runtime tests, syntax checks, and `git diff --check`.
- Strict review against `origin/stream/tooling-reliability` is clean: 0 blockers, 0 findings.
- Full foreground verify completed in 52.3s with 13 focused registry suites, 0 failed suites, DB guard clean, and a publish-valid stamp.
- Live installed-runtime smoke remains post-promotion because the current installed runtime is `0.1.131`; source-level facade coverage proves the new task-worktree routing until the fixed runtime is activated.

## key decisions

- Non-blocking verify is an agent boundary behavior, not a universal verify behavior. Internal safety gates must opt into foreground completion.
- Task-scoped verify should self-host from the task worktree; release should execute from the immutable installed runtime rather than repository-local controller code.

## files changed

- `packages/workspace/scripts/stream-sync.js`
- `packages/os/scripts/stream-sync.js`
- `packages/workspace/scripts/confirm.js`
- `packages/os/scripts/confirm.js`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/workspace/tests/verification.test.js`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/release-tool-surface.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-09-26 16:59:50 write: `.task/tooling-reliability/make-detached-verify-safe-for-internal-callers-and-self-hosting/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-26 16:59:50 fs.write: `.task/tooling-reliability/make-detached-verify-safe-for-internal-callers-and-self-hosting/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/confirm.js`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/release-tool-surface.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/scripts/confirm.js`
- `packages/workspace/scripts/stream-sync.js`

- 2026-09-26 17:02:02 apply-patch: `packages/workspace/scripts/stream-sync.js`
- 2026-09-26 17:02:02 apply-patch: `packages/os/scripts/stream-sync.js`
- 2026-09-26 17:02:02 apply-patch: `packages/workspace/scripts/confirm.js`
- 2026-09-26 17:02:02 apply-patch: `packages/os/scripts/confirm.js`
- 2026-09-26 17:02:02 apply-patch: `packages/os/scripts/lib/facade/executor.ts`

- 2026-09-26 17:02:26 apply-patch: `.task/tooling-reliability/make-detached-verify-safe-for-internal-callers-and-self-hosting/workpad.md`

## workspace-owned: validation evidence

- 2026-09-26 18:11:06 `review.run`: passed — OK
