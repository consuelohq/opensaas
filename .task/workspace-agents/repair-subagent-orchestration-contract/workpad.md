# repair subagent orchestration contract

branch: `task/workspace-agents/repair-subagent-orchestration-contract`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1820/repair-subagent-orchestration-contract
github pr: https://github.com/consuelohq/opensaas/pull/1820
started: 2026-08-10

## acceptance criteria

- [ ] Codex receives an explicit requested model and supported reasoning override in deterministic argv.
- [ ] Edit-mode self-bootstrap can launch without a pre-existing taskSession and instructs task.start-first behavior.
- [ ] Canonical OS tmp instructions are staged into a controlled run directory with provenance.
- [ ] Detached runs have durable run IDs, requestId idempotency, bounded status/wait/logs/cancel attachment, and completion-unknown recovery.
- [ ] Provider capabilities, especially strict workspace-only, are explicit and never silently weakened.
- [ ] Manifest/schema/docs and any required OS-generated or compatibility surfaces are regenerated through the normal OS workflow.
- [ ] Focused red-to-green tests, relevant OS/workspace validation, strict review, canonical verify, and task.push are complete; stop before task.pr/task.merge/task.finish.

## plan

1. Reproduce the nine observed wrapper failures with fake providers and contract tests.
2. Implement a small durable lifecycle core around the existing provider adapters; keep Hono out of process orchestration and use Effect only where it improves typed normalization/capability state.
3. Add Codex capability/argv handling, tmp staging, self-bootstrap steering, and lifecycle actions while preserving the synchronous compatibility path.
4. Regenerate active OS manifest/types/docs and inspect workspace only for required compatibility output, then run focused and broad validation, review, verify, and push only the task branch.

## test-first contract

- Behavior under test: requested Codex model/reasoning reach argv; edit self-bootstrap is launchable; canonical `/tmp` handoff is staged; `requestId` retries reuse one run; status/wait/logs attach without spawn; transport/timeouts preserve durable identity; strict unsupported providers return a capability outcome; lifecycle docs warn that task.pr merges.
- Existing pattern: `packages/os/tests/subagent-executable-discovery.test.ts` executable fixtures plus `packages/os/scripts/lib/trace-persistence.ts` for durable trace persistence. Workspace tests are consulted only if the active OS generation path requires compatibility coverage.
- New tests: focused OS subagent orchestration contract fixture tests and any generated-surface compatibility checks required by the active OS workflow.
- Focused red command: `bunx vitest run packages/os/tests/subagent-orchestration-contract.test.ts` through the OS facade before production edits.
- Expected red failures: current Codex command omits `--model` and reasoning config, edit mode returns `TASK_SESSION_REQUIRED`, `/tmp` is rejected, lifecycle action inputs are absent, and attachment has no durable run ID.
- No-test waiver: none.

## current status

- Discovery complete. Current runtime is synchronous/single-shot, persists only post-completion logs, rejects absolute tmp instruction paths, and treats strict capability refusal as an untyped `OK`/`not_supported` result. Codex CLI evidence: installed `codex exec --help` advertises `-m/--model`, `-s/--sandbox`, `-C/--cd`, `--json`, stdin `-`, and `-c/--config`; it does not advertise `--ask-for-approval`, so adapter probing must be capability-driven.

### Lifecycle review correction before runtime integration

- The initial lifecycle patch was stopped before runtime integration. Review found that `mkdir` plus read/write/rename was not an atomic request claim, first-window log reads could miss terminal JSONL, and a live PID was reported running after its deadline.
- The corrected design must claim `state.json` with an exclusive create, parse a bounded log tail, and use a run-owned detached helper/exit marker for conservative timeout, cancellation, and restart/PID-reuse decisions. Unknown ownership must become `completion_unknown`, not an unverified kill.
- New focused red regressions are in `packages/os/tests/subagent-lifecycle-regressions.test.ts`: eight concurrent same-request starters must produce one provider spawn; a >8KB prefix must still recover the final message; an owned live process past its deadline must become `timed_out`.

## files changed

- `packages/os/scripts/subagent.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`
- `packages/os/tests/subagent-cli.test.ts`


## red evidence before production implementation

- 2026-08-10T03:45Z: focused OS suite ran after the handoff-root correction; 7 tests failed as intended.
- Codex argv contained `exec --cd <cwd> --sandbox read-only --json -` but omitted the requested model and reasoning config.
- Edit mode failed with `TASK_SESSION_REQUIRED` before the agent could self-bootstrap with `task.start`.
- The canonical `opensaas-handoffs` input was not staged and the durable `node/runs` provenance assertion failed.
- Lifecycle start returned the legacy completed single-shot result; no durable run ID or attach-only status/wait/logs contract existed.
- Bounded wait had no run identity/status, strict Codex capability returned `OK` instead of `CAPABILITY_NOT_SUPPORTED`, and the manifest lacked the merge-sensitive lifecycle warning.
- Existing `trace.persistence_failed` warning (`bun:sqlite` unavailable in the facade test runtime) was observed separately and is not part of the seven contract failures.

## workspace-owned: files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`
- `packages/os/tests/trace-persistence.test.ts`

## workspace-owned: activity log

- 2026-08-10 03:38:59 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:39:44 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:41:01 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:41:43 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:42:26 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:43:12 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:44:06 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:44:58 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:45:29 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:46:14 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:48:49 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:50:06 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:50:52 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:52:31 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:54:15 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:54:39 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:58:32 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:58:59 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 03:59:49 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:01:16 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:03:32 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:04:33 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:04:52 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:05:38 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:06:16 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:07:01 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:09:22 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:10:01 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:10:50 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:11:29 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:12:24 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:13:14 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:13:49 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:15:36 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:18:22 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:27:29 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:32:49 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:33:38 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:34:42 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:35:05 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 20:40:05 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 20:43:44 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 20:46:37 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 20:49:39 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 20:54:11 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 20:57:30 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 20:59:32 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 21:02:56 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 21:04:38 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-11 21:08:49 fs.write: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

## workspace-owned: validation evidence

- 2026-08-10 04:57:50 `review.run`: passed — OK
- 2026-08-10 04:58:21 `review.run`: passed — OK
- 2026-08-10 04:58:32 `verify`: passed — OK
- 2026-08-10 05:03:34 `review.run`: passed — OK
- 2026-08-10 05:03:38 `verify`: passed — OK
- 2026-08-11 20:43:17 `review.run`: passed — OK
- 2026-08-11 20:43:23 `verify`: passed — OK
- 2026-08-11 20:43:26 `review.run`: passed — OK
- 2026-08-11 20:43:31 `verify`: passed — OK
- 2026-08-11 20:44:16 `verify`: passed — OK
- 2026-08-11 20:49:09 `review.run`: passed — OK
- 2026-08-11 20:49:19 `verify`: passed — OK
- 2026-08-11 20:49:46 `verify`: passed — OK
- 2026-08-11 20:57:05 `review.run`: passed — OK
- 2026-08-11 20:57:20 `verify`: passed — OK
- 2026-08-11 20:57:36 `verify`: passed — OK
- 2026-08-11 21:02:33 `review.run`: passed — OK
- 2026-08-11 21:02:44 `verify`: passed — OK
- 2026-08-11 21:03:02 `verify`: passed — OK
- 2026-08-11 21:08:22 `review.run`: passed — OK
- 2026-08-11 21:08:36 `verify`: passed — OK
- 2026-08-11 21:08:55 `verify`: passed — OK

## key decisions

- Keep existing provider adapters and synchronous compatibility behavior; add lifecycle orchestration at the runtime boundary.
- Use the canonical OS-owned durable home/runs resolver, never a task/repo root, task worktree, `/tmp`, or in-memory map. A requestId derives a stable run key and is atomically claimed before spawn; status/wait/logs/cancel only read/update that record and never spawn. The task cwd/worktree remains execution metadata only.
- Stage only existing trusted repo/task inputs or files under the canonical OS handoff root `path.join(os.tmpdir(), 'opensaas-handoffs')` into the run directory, record source/provenance, then validate/use the staged copy. Never trust arbitrary files directly under `os.tmpdir()`.
- Do not adopt Hono for local process orchestration. Use Effect only if the small normalization/capability core makes typed failure paths clearer; avoid a broad rewrite.

## notes for ko

- Existing PR #1820 and taskSession `tsk_e7b2e423a0f7` are preserved. The orchestrator requested `task.push` as the terminal workflow action; `task.pr` merges into the stream and must not be called.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/build-runtime-bundle.ts`
- `packages/os/scripts/check-syntax.js`
- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/facade/branch-resolver.ts`
- `packages/os/scripts/lib/facade/errors.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/lifecycle/paths.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runner.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/review.js`
- `packages/os/scripts/run.ts`
- `packages/os/scripts/subagent.ts`
- `packages/os/scripts/tmp.js`
- `packages/os/steering/system_prompt.md`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`
- `packages/os/tests/trace-persistence.test.ts`
- `packages/os/tools/subagent/handler.test.ts`
- `packages/os/tools/subagent/handler.ts`
- `packages/os/tools/subagent/manifest.ts`
- `packages/os/tools/subagent/schema.ts`
- `packages/workspace/package.json`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/subagent.ts`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/tests/facade/facade.test.ts`

## Recovery and Luna round 2

- OS control plane recovered at 2026-08-10T03:27Z. Prior manually detached worker and temp worktree/logs were lost during restart; PR #1820 remained OPEN/CLEAN with zero changed files.
- Recovered the existing PR/worktree using task-start existing-PR adoption. Same taskSession restored: `tsk_e7b2e423a0f7`; no new branch/PR created.
- Durable Luna handoff restored from context to `~/.consuelo/subagent-runs/repair-1820-luna-r2/instructions.md`.
- Relaunched one worker in detached tmux session `repair-1820-luna-r2`, Codex model `gpt-5.6-luna`, reasoning `xhigh`, read-only Codex sandbox, working only through OS/MCP for repo mutations.

Wait reason: allow Luna round 2 to bootstrap, re-read the repaired task state, and begin test-first implementation without duplicate launch.
Duration: 30s.
Resume action: check tmux session, durable stdout/stderr/final/exit files, then inspect task workpad and git diff.
Expected signal: active JSONL OS/MCP calls or completed final message; stderr empty; task workpad and/or diff show red-test progress.
Fallback: if worker exited, inspect durable final/exit/stderr before any relaunch; if alive but idle, inspect latest JSONL event and continue bounded polling only if healthy.

- 2026-08-10 03:30:45 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 03:35:36 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
## Orchestrator correction before implementation

- The previous key decision to persist subagent lifecycle state under the task/repo root is rejected. The OS restart deleted the entire TMPDIR-backed task worktree, proving that `.task/...` and task-worktree-local run records are not restart-durable.
- Durable subagent lifecycle state must live under the canonical OS-owned home/run layout resolved by current Consuelo home helpers and configuration, not a hard-coded path. Current runtime identity resolves Consuelo home to `/Users/kokayi/.consuelo`; repo docs/guidance establish OS-owned `runs/` state and explicitly forbid long-lived runtime references to `/tmp`, staging checkouts, or task worktrees.
- The task/worktree path may be recorded as run metadata but must not be the durability boundary.
- Refreshed steering now states `packages/workspace` is deprecated and no longer requires updates. Do not mirror implementation into `packages/workspace` merely for historical parity. Verify the current source-of-truth/generation path and update only compatibility/generated surfaces that are still required.
- The same Luna Codex thread will be resumed after this correction; do not start a new task, PR, or independent worker.

- 2026-08-10 03:37:46 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna resume wait plan
- start time UTC: 2026-08-10T03:38:07Z
- Wait reason: allow the resumed Luna thread to absorb the orchestrator correction, update its workpad decision, and begin red-test edits.
- Duration: 20s initial poll.
- Resume action: inspect tmux r3, durable final/exit/stderr/stdout, latest agent message, workpad, and working-tree diff.
- Expected signal: explicit acknowledgement of OS-owned durable run state plus red test edits/failures; no duplicate task/PR; stderr clean.
- Fallback: if exited, inspect durable final/exit evidence before any recovery; if alive but still discovery-only, continue one bounded poll without relaunch.

- 2026-08-10 03:38:15 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 03:38:23 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna resume poll 2
- start time UTC: 2026-08-10T03:38:50Z
- Wait reason: corrected architecture is acknowledged; allow Luna to produce the first red-test changes.
- Duration: 20s.
- Resume action: inspect r3 completion state, latest agent/tool events, working-tree diff, and any focused test output recorded in the workpad.
- Expected signal: non-metadata test edits that reproduce one or more wrapper incidents, ideally with explicit failing evidence before runtime implementation.
- Fallback: if Luna starts production implementation without red evidence, interrupt and correct; if healthy and still preparing tests, allow one more bounded poll.

- 2026-08-10 03:38:59 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna resume poll 3
- start time UTC: 2026-08-10T03:39:32Z
- Wait reason: r3 is alive with zero stderr but emitted no new events during the previous 20s, consistent with an xhigh reasoning turn.
- Duration: 30s.
- Resume action: compare stdout byte count/event tail, tmux/child process state, diff, and final/exit markers.
- Expected signal: new MCP/test-edit activity or completion; byte count should advance if the turn resumes tool use.
- Fallback: if byte count is unchanged again, inspect child process and Codex session state before deciding whether the worker is stalled; do not relaunch blindly.

- 2026-08-10 03:39:44 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 03:40:17 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`

### Orchestrator test review correction
- `packages/os/scripts/tmp.js` defines the canonical handoff root as `path.join(os.tmpdir(), 'opensaas-handoffs')` and sanitizes names into that directory.
- The new tmp-staging contract test currently creates an arbitrary file directly under `tmpdir()`. Tighten it before production implementation so accepted external instruction sources are specifically inside the canonical `opensaas-handoffs` root (or otherwise carry equally strong OS-owned provenance). Do not broaden trust to arbitrary system temp files.
- The durable-run expectation under `CONSUELO_HOME/node/runs` is supported by `resolveConsueloHomeLayout().nodeRunsDir` and `runtime-state.ts` `runsDir`.

- 2026-08-10 03:41:01 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna resume r4 wait plan
- start time UTC: 2026-08-10T03:41:36Z
- Wait reason: allow same Luna thread to tighten canonical handoff provenance, rerun focused red tests, then begin implementation only if red evidence remains correct.
- Duration: 20s.
- Resume action: inspect r4 event tail, diff, workpad red evidence, and any first production edits.
- Expected signal: test source uses `opensaas-handoffs`; red suite still fails on the intended missing contract; implementation may then begin.
- Fallback: if runtime edits precede corrected red evidence, interrupt; otherwise continue review alongside implementation.

- 2026-08-10 03:41:43 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna resume r4 poll 2
- start time UTC: 2026-08-10T03:42:18Z
- Wait reason: resumed xhigh turn has started but has not emitted its first message/tool call yet; no stderr or exit signal.
- Duration: 20s.
- Resume action: inspect r4 JSONL byte count/event tail and corrected test source.
- Expected signal: agent acknowledges provenance correction and patches the test before runtime code.
- Fallback: if still only `turn.started`, inspect live Codex child state and allow one longer reasoning window rather than duplicate the session.

- 2026-08-10 03:42:26 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna resume r4 poll 3
- start time UTC: 2026-08-10T03:43:04Z
- Wait reason: Codex child PID 13447 is alive in sleep/wait state with the exact Luna/xhigh/read-only resume argv; no stderr or exit signal, so allow one longer model reasoning window.
- Duration: 60s.
- Resume action: inspect stdout advancement, final/exit markers, test correction, and working-tree diff.
- Expected signal: agent/tool events resume and canonical handoff test is patched before runtime implementation.
- Fallback: if stdout remains exactly 101 bytes after this window, treat the resume turn as stalled; stop only that session, then recover using the same Codex thread with a non-stdin prompt transport verified from CLI behavior rather than starting a new task.

- 2026-08-10 03:43:12 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r4 poll 4
- start time UTC: 2026-08-10T03:44:00Z
- Wait reason: Luna acknowledged the exact canonical handoff correction and promised a red rerun before runtime edits.
- Duration: 30s.
- Resume action: inspect corrected test source, red validation evidence, latest agent events, and first production diff if present.
- Expected signal: `opensaas-handoffs` appears in the test, intended red failures are recorded, then runtime implementation begins under `packages/os` only.
- Fallback: intervene only if implementation violates the two verified durability/provenance boundaries or touches deprecated workspace runtime without a demonstrated generation requirement.

- 2026-08-10 03:44:06 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 03:44:47 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`
- 2026-08-10 03:44:47 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r4 poll 5
- start time UTC: 2026-08-10T03:44:52Z
- Wait reason: canonical handoff test patch succeeded; allow Luna to rerun the focused red suite and transition to implementation.
- Duration: 15s.
- Resume action: inspect latest events, workpad validation evidence, and product-file diff.
- Expected signal: corrected red suite failure is recorded, followed by first `packages/os` runtime/schema/manifest edits.
- Fallback: if test rerun exposes a bad assertion, fix test contract before runtime edits; otherwise continue.

- 2026-08-10 03:44:58 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 03:45:22 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna implementation poll 1
- start time UTC: 2026-08-10T03:45:23Z
- Wait reason: corrected seven-test red contract is recorded; allow Luna to begin the first production implementation pass.
- Duration: 30s.
- Resume action: inspect first non-test `packages/os` diff, latest agent message/tool calls, and verify no deprecated workspace runtime edits.
- Expected signal: focused runtime/schema/manifest changes implementing model/reasoning, lifecycle durability, staging, self-bootstrap, and capability outcomes.
- Fallback: interrupt only for architecture/safety drift; otherwise review and let the worker continue toward green.

- 2026-08-10 03:45:29 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna implementation poll 2
- start time UTC: 2026-08-10T03:46:08Z
- Wait reason: Luna is reading the active OS generation/runtime surfaces after red evidence; no production files edited yet.
- Duration: 30s.
- Resume action: inspect new product-file diff and event tail.
- Expected signal: first implementation patches under `packages/os/scripts/lib/subagent`, facade schemas/types, or subagent tool package.
- Fallback: if still read-only, allow reasoning/discovery to finish; do not parallel-edit the same files from the orchestrator.

- 2026-08-10 03:46:14 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna implementation poll 2 result
- wake check UTC: 2026-08-10T03:48:38Z
- observed result: r4 remains alive (Codex child 13447), stderr empty, no final/exit marker, and no production diff yet. The worker completed its active OS source reads/searches and is in another xhigh reasoning interval.
- decision: do not duplicate or parallel-edit the subagent runtime. Continue one bounded 45s poll while the orchestrator independently verified the canonical `nodeRunsDir` resolver and noted that ordinary atomic rename alone is insufficient for requestId claim races; the implementation must use an exclusive/atomic claim primitive.

### Luna implementation poll 3
- Wait reason: allow the existing Luna thread to produce the first production patch after completing source discovery.
- Duration: 45s.
- Resume action: inspect stdout advancement, first non-test diff, and run/final markers.
- Expected signal: production edits under active `packages/os` subagent/facade/tool surfaces; no deprecated workspace runtime edits.
- Fallback: if still no product edit but worker is alive and stdout advances, continue; if stdout is unchanged and no activity, inspect the thread state before intervention.

- 2026-08-10 03:48:49 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 03:49:34 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

- 2026-08-10 03:49:56 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
## Orchestrator review of first lifecycle patch — blocking corrections

The new `packages/os/scripts/lib/subagent/lifecycle.ts` has the right overall boundary, but do not build further on it until these are corrected and covered by tests:

1. **Atomic idempotency claim race**: current `stageSubagentRunDirectory -> readState -> writeState(rename)` sequence is not an exclusive claim. Two concurrent `start` calls for the same requestId can both observe no state and both spawn. Initial state acquisition must use an atomic exclusive-create primitive (`open(..., 'wx')` or equivalent). The loser must read the winner's state and either reuse it (same fingerprint) or return `IDEMPOTENCY_CONFLICT`. Preserve atomic-replace writes for later state transitions.
2. **Bounded logs read the wrong end**: `readBoundedLog` reads offset 0 / the first 8 KB. Long JSONL runs can put the final agent/turn event after that window, causing false `completion_unknown`/failure. Read a bounded tail (or maintain a bounded final-event parser) while retaining persisted full log files.
3. **Execution timeout is not enforced while PID is alive**: `reconcileDurableSubagentRun` returns `running` immediately whenever `kill(pid, 0)` succeeds, regardless of `now - startedAt >= timeoutMs`. A stuck child can remain `running` forever. Define timeout semantics explicitly; when the run deadline passes, terminate the process group safely and persist `timed_out`, or otherwise model the timeout as completion-unknown if process ownership cannot be proven.
4. Add focused regression tests for concurrent same-request starts (prove one spawn), final message after >8 KB stdout, and an over-deadline still-alive fake child/process path.

Secondary item to inspect while fixing: a detached PID alone is weak process identity across restart/PID reuse. If the current OS conventions expose a stronger process identity/marker, use it; otherwise document the residual and make reconciliation conservative rather than treating an arbitrary reused PID as definitely our worker.

- 2026-08-10 03:50:06 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r5 review-fix wait plan
- start time UTC: 2026-08-10T03:50:48Z
- Wait reason: allow the same Luna thread to absorb the first production-review corrections and add red regressions before further lifecycle integration.
- Duration: 30s.
- Resume action: inspect r5 event tail, new tests, lifecycle diff, stderr/final/exit markers.
- Expected signal: acknowledgement of the atomic-claim/log-tail/timeout issues and red regression edits before additional runtime integration.
- Fallback: if the worker continues integrating without addressing the blockers, interrupt again; otherwise review the corrected lifecycle implementation.

- 2026-08-10 03:50:52 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r5 poll 1 result
- wake check UTC: 2026-08-10T03:52:23Z
- observed result: r5 remains alive, stderr is empty, no final/exit marker, and no new edits after reading the lifecycle/test sources. The worker is in a long Luna/xhigh reasoning turn.
- decision: preserve the single resumed thread and allow a 60s reasoning window; do not duplicate or edit its target files in parallel.

### Luna r5 poll 2
- Wait reason: allow Luna to design and add the three blocking regressions after source review.
- Duration: 60s.
- Resume action: inspect JSONL advancement, test/lifecycle diff, and run markers.
- Expected signal: new red tests for exclusive request claiming, long-output tail completion, and over-deadline live execution; then focused red results.
- Fallback: if the turn remains silent but process is healthy, inspect child state and continue only if the model is still active; no blind relaunch.

- 2026-08-10 03:52:31 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 03:53:18 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-10 03:53:18 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Orchestrator review of lifecycle regression tests
- The new regression file is safe/scoped and correctly exercises separate processes for the idempotency race and >8KB final-event placement.
- Tighten the concurrent claim assertion: in addition to provider spawn count = 1, parse all eight results and assert one shared runId and exactly one creator (`reused:false`) with all other callers reusing the same run.
- Tighten the timeout assertion: `status === timed_out` is insufficient. Prove the owned stuck provider/process group is actually terminated after reconciliation (allow a short bounded grace if SIGTERM is asynchronous). The test must fail if code merely labels the run timed_out while the child keeps running.
- Keep cancellation in cleanup as a safety backstop, but do not let cleanup make the behavioral assertion pass.

- 2026-08-10 03:54:15 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r6 test-strengthening wait plan
- start time UTC: 2026-08-10T03:54:34Z
- Wait reason: allow same Luna thread to strengthen the two lifecycle regression assertions and rerun the focused three-test suite red before lifecycle fixes.
- Duration: 30s.
- Resume action: inspect r6 events, regression-test diff, focused red output, and lifecycle diff.
- Expected signal: shared-runId/one-creator concurrency assertions plus actual process termination assertion; focused suite remains red before production fixes.
- Fallback: if production code changes before the strengthened red evidence, interrupt; otherwise proceed to green implementation review.

- 2026-08-10 03:54:39 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 03:55:13 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-10 03:56:08 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-10 03:56:46 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-10 03:57:11 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
## Orchestrator correction: concurrency regression is not yet valid

The latest focused lifecycle run produced 1 pass / 2 fails, but the passing test is the **known-racy requestId implementation**. Therefore the concurrency test is not a valid red regression yet; it is scheduler-dependent and cannot be used as evidence that the current claim is safe.

Before implementing exclusive-create semantics, make the race test deterministic enough to fail against the current `readState -> writeState` implementation and pass only with an exclusive claim. Do not rely on "8 processes happen to overlap." Preferred options, in order:
- factor the initial claim into a small storage primitive whose behavior can be concurrently exercised with a synchronization barrier / injected pre-commit hook or dependency;
- or use worker threads/shared barrier so all contenders enter the claim critical section together, with a test-only synchronization seam that does not affect production defaults;
- a static assertion that source contains `wx` is insufficient by itself; behavioral proof is required.

The test must demonstrate that the old check-then-act implementation can create >1 creator/spawn under a forced interleaving, while the exclusive-create implementation yields exactly one creator and one spawn. Avoid probabilistic retry loops as the sole proof.

Tail and timeout reds are valid. Production lifecycle fixes remain blocked until the request-claim regression is meaningfully red.

- 2026-08-10 03:58:32 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r7 deterministic-race wait plan
- start time UTC: 2026-08-10T03:58:50Z
- Wait reason: allow the same Luna thread to replace the scheduler-dependent concurrency check with deterministic forced-interleaving red evidence before production lifecycle fixes.
- Duration: 30s.
- Resume action: inspect r7 event tail, regression-test diff, and focused claim-test output.
- Expected signal: a deterministic synchronization seam/test is added and the current check-then-act implementation fails that claim regression for multiple creators/spawns.
- Fallback: if Luna begins production claim changes before obtaining meaningful red evidence, interrupt again; otherwise review the seam for production neutrality and determinism.

- 2026-08-10 03:58:59 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r7 poll 1 result
- wake check UTC: 2026-08-10T03:59:40Z
- observed result: r7 tmux alive, stderr 0 bytes, stdout still only `turn.started`; no product/test change from r7 yet.
- decision: this matches prior Luna/xhigh long reasoning intervals. Preserve the same thread and allow one 60s window before diagnosing a stall.

### Luna r7 poll 2
- Wait reason: allow deterministic-race test design to complete without duplicate launch.
- Duration: 60s.
- Resume action: inspect stdout advancement, child process state, regression diff, and focused claim-test evidence.
- Expected signal: Luna explains/implements a deterministic synchronization seam and runs the claim test red on current code.
- Fallback: if stdout remains exactly 101 bytes after this window, inspect resume transport/session health before another intervention.

- 2026-08-10 03:59:49 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r7 transport recovery / r8 wait plan
- r7 remained at `turn.started` for ~2 minutes with no stderr. No stale prior Codex process existed. `codex exec resume --help` confirms `[PROMPT]` is a supported positional argument and `-` explicitly selects stdin.
- Stopped only r7 and resumed the same Codex session ID as r8 using positional prompt transport; same Luna/xhigh model, same task/PR, no duplicate logical worker.
- Wait reason: verify positional-prompt resume clears the stdin-resume stall and allows deterministic-race test work to continue.
- Duration: 20s.
- Resume action: inspect r8 JSONL/event tail, stderr/final/exit, and regression diff.
- Expected signal: first agent message/tool call appears and work resumes on deterministic request-claim red evidence.
- Fallback: if positional resume also stalls, stop and diagnose Codex session state rather than creating a new task/agent.

- 2026-08-10 04:01:16 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r8 active poll
- wake check UTC: 2026-08-10T04:03:21Z
- observed result: positional-prompt r8 resumed successfully after ~2 minutes. First agent message explicitly keeps production lifecycle code untouched and commits to deterministic interleaving red evidence. It read lifecycle, workpad, and regression tests; stderr remains empty.
- Wait reason: allow Luna to implement the deterministic test seam and run the claim regression red.
- Duration: 30s.
- Resume action: inspect r8 tool/event tail, lifecycle/test diff, and claim-test output.
- Expected signal: test-only synchronization seam plus a behavioral claim test that fails on current check-then-act semantics.
- Fallback: reject any production claim fix that lands before meaningful red evidence.

- 2026-08-10 04:03:32 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:04:03 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-10 04:04:18 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

### Orchestrator review of deterministic race seam
- The barrier/`fs.existsSync` forced-interleaving strategy is directionally correct, but the generated Bun starter currently includes a static `import { startDurableSubagentRun } from ...` after the monkeypatch lines. ES module static imports are hoisted/evaluated before module body execution, so lifecycle may capture/run before the fs hook is installed.
- Use a dynamic `await import(modulePath)` only after installing the monkeypatch/barrier, then call the exported starter. This is necessary for the forced interleaving to actually intercept `readState -> fs.existsSync(state.json)`.
- Preserve the barrier cleanup and run only the claim test first. Expected current-code RED should show multiple fresh creators/provider spawns under the forced interleaving, not a harness/import failure.

- 2026-08-10 04:04:33 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:04:38 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
### Deterministic claim-test checkpoint
- First barrier run incorrectly passed because the starter used a static lifecycle import, which was evaluated before the fs monkeypatch.
- Luna has now changed the generated starter to `await import(...)` after installing the hook. This is the meaningful forced-interleaving checkpoint.
- Wait reason: allow the corrected single claim regression to run against unchanged check-then-act production code.
- Duration: 15s.
- Resume action: inspect r8 event/result and claim-test failure details.
- Expected signal: current implementation produces multiple creators/spawns/shared-state overwrite under forced interleaving, causing the test to fail for the intended race.
- Fallback: if it still passes, reject the seam and redesign before production claim changes.

- 2026-08-10 04:04:52 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:05:31 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
### Orchestrator correction: barrier is on the wrong side of the check
- The dynamic-import claim test still passes against the known-racy implementation. The fs hook is active, but it currently pauses *before* calling `originalExistsSync(candidate)` and calls the real check only after all 8 contenders are released. That allows the first released process to create `state.json`; later contenders then observe true and reuse, so the barrier accidentally serializes the check.
- Force the actual check-then-act interleaving: inside the first `state.json` hook, evaluate/cache `const existed = originalExistsSync(candidate)` BEFORE signaling/waiting at the barrier. All 8 contenders must capture the same pre-write `false`. After all 8 ready markers exist, return that cached `existed` value without rechecking the filesystem.
- Assert the test observed all 8 `.ready` markers so a broken hook cannot silently pass. Then the current implementation should produce multiple `reused:false` creators and/or multiple provider spawns and fail the one-creator invariant deterministically.
- Production claim code remains frozen until this forced-interleaving test is meaningfully RED.

### Deterministic claim regression is RED
- Added a production-neutral `beforeInitialClaim` hook to `startDurableSubagentRun`; the default remains a no-op. The test-only hook writes one ready marker per contender and blocks all eight callers after their common `readState` miss and before the initial write.
- Ran only `packages/os/tests/subagent-lifecycle-regressions.test.ts -t "atomically claims a requestId"` against the unchanged check-then-act claim path.
- RED evidence at 2026-08-10 04:06:16Z: all eight starters reached the barrier, and the provider spawn counter contained 8 entries where the invariant requires 1. The failure is the intended forced interleaving, not scheduler overlap or a harness/import error.
- Proceeding now to replace the initial write with an exclusive atomic create. Later state transitions will retain atomic replacement; the losing callers must read/reuse the winner or return `IDEMPOTENCY_CONFLICT`.

- 2026-08-10 04:05:38 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:06:10 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
### Claim-hook rewrite poll
- start time UTC: 2026-08-10T04:06:08Z
- Wait reason: lifecycle now exposes a production-no-op `beforeInitialClaim` seam; Luna is rewriting the regression to use that seam after one patch-context mismatch.
- Duration: 20s.
- Resume action: inspect r8 patch/test result.
- Expected signal: starter passes a barrier hook to `startDurableSubagentRun`; current check-then-act implementation fails deterministically with multiple creators/spawns.
- Fallback: if the test still passes or fails for harness reasons, keep production claim code frozen and correct the seam/test.

- 2026-08-10 04:06:16 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:06:35 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
### Lifecycle green implementation poll
- start time UTC: 2026-08-10T04:06:53Z
- Wait reason: deterministic claim red is proven (8 spawns vs 1); allow Luna to implement the three lifecycle fixes and run the focused three-test suite green.
- Duration: 30s.
- Resume action: inspect lifecycle diff, r8 events, and focused regression results.
- Expected signal: exclusive initial state claim with safe loser-read/retry, bounded tail parsing, owned deadline termination; all three lifecycle regressions green.
- Fallback: review for partial-state claim races, unverified PID kills, or test-only behavior leaking into production before accepting green.

- 2026-08-10 04:07:01 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:07:33 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

- 2026-08-10 04:08:05 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-10 04:08:29 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

- 2026-08-10 04:09:19 apply-patch: `packages/os/scripts/lib/subagent/runner.ts`
## SECURITY BLOCKER — do not persist inherited environment

The first runner-oriented start patch currently writes `env: Object.fromEntries(Object.entries(input.env)...)` into durable `launch.json` under `$CONSUELO_HOME/runs`. This is unacceptable: the inherited process environment may contain Stripe, GitHub, Railway, Cloudflare, Twilio, database, or other credentials. Durable subagent state/logs must never serialize arbitrary environment variables or secret values.

Required correction before runner implementation/tests continue:
- Remove `env` entirely from `launch.json` and from any persisted state/summary/log payload.
- The detached helper is spawned immediately by the parent with `env: input.env`; it can inherit that environment in-memory and pass `process.env` to the provider child without writing it to disk. No restart-respawn behavior should require reconstructing secret env from durable storage.
- Keep persisted launch metadata minimal: runId, ownerToken, command/argv, cwd, stdin path, stdout/stderr paths, owner/exit marker paths, timeout/deadline if the helper needs it. Review whether argv itself can contain sensitive values; do not persist arbitrary secret-bearing CLI args if a provider contract might contain them.
- All run-dir files must remain 0600/0700 as appropriate.

Additional lifecycle review requirements while fixing:
- `RUNNER_PATH` now points to `runner.ts`, but the file does not yet exist. Verify the helper execution path works in the packaged/installed OS layout, not only the source worktree.
- The helper should be the detached process-group leader; provider child should remain in that owned group so timeout/cancel can target the verified group.
- Before any kill, validate the durable owner token/marker matches this run. Do not kill solely because a raw PID is alive; stale marker + PID reuse must produce conservative `completion_unknown`, not an unrelated process kill.
- Runner/exit marker must be sufficient for restart reconciliation without respawning a provider.
- Initial exclusive claim is directionally correct (`wx` + read retry), but preserve recoverability if the winner dies after claim and before helper spawn.

- 2026-08-10 04:09:22 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r9 security-fix wait plan
- start time UTC: 2026-08-10T04:09:55Z
- Wait reason: allow the same Luna thread to add the secret-nonpersistence red regression before helper execution, then correct env persistence and ownership semantics.
- Duration: 45s.
- Resume action: inspect r9 events, new regression source/result, lifecycle/runner diff, and stderr/final/exit markers.
- Expected signal: sentinel secret test fails against current env-persisting launch metadata before the fix; then launch.json env snapshot is removed.
- Fallback: if helper execution begins while arbitrary env persistence remains, interrupt immediately; otherwise review runner ownership and packaging path before accepting green.

- 2026-08-10 04:10:01 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Security regression is validly RED
- Added the sentinel assertion immediately after startDurableSubagentRun returns, before waiting for the helper/provider or reading its receipt marker.
- Ran only packages/os/tests/subagent-lifecycle-regressions.test.ts -t "passes inherited secrets".
- RED evidence at 2026-08-10 04:13:31Z: persistedFiles.some(content => content.includes(sentinel)) returned true, so the current launch.json env snapshot leaks the inherited sentinel into the durable run directory. This is the intended security failure; provider completion cannot mask it.
- Production correction now removes arbitrary env serialization. The helper will inherit input.env only through its parent spawn and pass process.env to the provider in memory.

### Startup owner-publication regression is RED
- Added an immediate reconcile regression for a normal fast provider.
- Ran only the startup test at 2026-08-10 04:23:09Z. The first reconcile returned terminal completion_unknown before the runner had published owner.json; this is the transient startup race, not a completed/failed worker outcome.
- The correction must retain starting during a bounded owner-publication grace, then transition to running only after a valid token-bound owner marker; no transient completion_unknown may become irreversible.

## Ownership simplification — parent must not kill persisted PIDs

Runner review suggests a safer design than trying to re-authenticate a PID after restart:

- The lifecycle/facade parent must **never send SIGTERM/SIGKILL to a PID recovered from durable state**. This completely removes stale PID/PID-reuse risk.
- The detached runner owns the actual provider child in memory. Make the provider its own process group (`detached:true` inside runner), so the runner can safely terminate `-provider.pid` because that PID is a live child reference it directly created, not a value recovered after restart.
- Persist `timeoutMs`/deadline in secret-minimal launch metadata. Runner enforces execution deadline itself with a timer, terminates the provider process group, and writes a durable exit marker with explicit outcome (`completed` / `failed` / `timed_out`, exitCode/signal/error).
- Cancellation from lifecycle writes an atomic durable `cancel.json` (runId + ownerToken + requestedAt) rather than killing a PID. Runner polls/watches that marker, validates runId/ownerToken, terminates its owned provider group, and writes exit marker outcome `cancelled`.
- On SIGTERM/SIGINT to the runner itself, it should terminate its owned provider group before exiting.
- Parent reconciliation order: valid exit marker -> terminal truth; otherwise valid owner marker + runner liveness may indicate running; if runner is gone with no exit marker -> `completion_unknown`. Never respawn and never kill based on durable PID.
- If a deadline has passed but no valid exit marker appears, allow a short runner grace; if ownership/execution truth is still absent, report `completion_unknown` rather than parent-side kill. In normal operation the runner timer should make the timeout regression reach `timed_out` and provider-group-dead.
- Cancel API may wait a short bounded interval for the runner's exit marker. Do not claim `cancelled` if the runner is already gone and cancellation cannot be proven.

This design is cross-restart safe and removes the need for fragile PID command-line/heartbeat authentication. Keep owner/exit markers for observability, but not as authority for parent-side kill.

## Final public API integration validation

- 2026-08-10T05:00:46Z: lifecycle regressions passed 8/8 from the repository root. This final run includes exclusive request claiming with shared runId/one creator/one spawn, no-PID startup-grace recovery, owner-publication grace, bounded-tail completion, owned-provider timeout termination, secret non-persistence with in-memory provider receipt, runner-owned cancellation, and cancellation during starting.
- 2026-08-10T05:00:52Z: public orchestration contract passed 7/7. Attachment actions dispatch from `{action, runId}` without provider/instruction inputs, bounded wait preserves identity, exact Codex model/reasoning behavior is covered, and unsupported strict/reasoning capabilities are structured.
- The final architecture remains a filesystem lifecycle store under the canonical `nodeRunsDir` resolver plus a detached runner. Hono was not introduced and Effect was not introduced because the existing synchronous provider adapters plus typed filesystem state machine were clearer without a broad rewrite.
- No arbitrary environment snapshot is persisted; parent-to-runner/provider environment transfer is in memory only. Parent reconciliation performs only signal-0 liveness checks and never kills a PID recovered from durable state.
- The remaining trace suite caveat is the pre-existing facade fail-open trace-path test under the local `bun:sqlite`-unavailable runtime; the focused subagent trace persistence test passed. No deprecated `packages/workspace` runtime changes were made.

- 2026-08-10 04:10:50 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:10:55 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
### Secret regression first run is NOT valid RED yet
- The focused secret test failed before the security assertion because the partial lifecycle patch calls `writeJsonFile`, which is not yet defined. This is implementation/harness incompleteness, not evidence of env persistence.
- Before removing `env` from launch metadata, minimally complete the helper needed to write current launch.json (or otherwise make current env-persisting behavior executable) and rerun ONLY the secret test. Valid RED must prove: provider receives sentinel AND persisted run files contain the sentinel.
- Then remove env persistence and make the same test green. Do not count `writeJsonFile is not defined` as the security red phase.
- Also incorporate the newer ownership simplification in this workpad: parent/facade never kills recovered PIDs; runner owns timeout and cancel via in-memory child + durable cancel marker.

- 2026-08-10 04:11:29 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:11:32 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-10 04:11:48 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

### Secret regression correction 2 — isolate persistence from runner health
- The next secret test still did not hit the leak assertion because the provider receipt marker was absent; runner startup/completion is a separate unfinished concern.
- Reorder the test so immediately after `startDurableSubagentRun` returns, resolve the run directory, recursively read persisted files, and assert the sentinel is absent BEFORE waiting for the provider or reading its receipt marker. Against the current env-persisting `launch.json`, this must fail directly on `persistedFiles.some(...sentinel...) === false`.
- That is the valid security RED. After removing env persistence, the test proceeds to wait and then proves the provider received the sentinel in-memory. Runner startup failures then surface as their own green-implementation problem, not as a blocker to proving the leak.
- Do not remove the env snapshot until this direct persistence assertion is red.

- 2026-08-10 04:12:24 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Luna r10 consolidated lifecycle wait plan
- start time UTC: 2026-08-10T04:13:08Z
- Wait reason: same Luna thread has a consolidated security/ownership prompt; allow it to obtain direct sentinel-on-disk RED, then move lifecycle control into the runner.
- Duration: 45s.
- Resume action: inspect r10 events, secret-test result, lifecycle/runner diff, and run markers.
- Expected signal: valid persistence RED first; then env snapshot removal and runner-owned deadline/cancel implementation with no parent PID kill.
- Fallback: interrupt if env persistence is removed before direct RED, or if lifecycle retains parent-side `process.kill` against durable PIDs.

- 2026-08-10 04:13:14 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:13:25 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-10 04:13:45 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
### Valid security RED achieved
- 2026-08-10T04:13:31Z focused secret test failed directly at the persistence assertion: `persistedFiles.some(content => content.includes(sentinel))` returned true, expected false.
- This proves the current env-persisting launch metadata writes inherited secret values to durable run storage. The runner/provider completion path did not mask this assertion.
- Security implementation is now unblocked: remove env serialization, preserve in-memory inheritance, then prove persisted-files-clean + provider-received sentinel green.

### Runner-owned lifecycle green poll
- Wait reason: allow Luna to remove env persistence and implement runner-owned deadline/cancel marker control plus exit-marker reconciliation.
- Duration: 45s.
- Resume action: inspect lifecycle/runner diff, r10 event tail, and focused lifecycle test results.
- Expected signal: no env in LaunchSpec/launch.json; no parent-side PID kill; runner provider detached process group; timeout/cancel handled by runner; exit marker drives terminal status.
- Fallback: interrupt for any persisted env, parent kill of durable PID, or false cancellation/timeout status without marker proof.

- 2026-08-10 04:13:49 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Runner packaging review note
- Independent OS source review confirms sibling TypeScript helper execution via `process.execPath`/Bun is an established installed-runtime pattern, and `fileURLToPath(new URL('./runner.ts', import.meta.url))` is consistent with other shipped helpers.
- However, the new `scripts/lib/subagent/runner.ts` must be explicitly covered by the OS distribution/runtime bundle closure and associated distribution tests if the current runtime-bundle classifier/allowlist would otherwise omit it. Verify this before final green/release; a source-worktree-only helper is not acceptable.

- 2026-08-10 04:15:36 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:17:37 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

- 2026-08-10 04:18:11 apply-patch: `packages/os/scripts/lib/subagent/runner.ts`
## Additional lifecycle race — startup ownership publication
- Parent currently spawns the detached runner and immediately persists `status: running` with runner PID. Runner writes `owner.json` asynchronously afterwards.
- `reconcileDurableSubagentRun` currently maps a live runner with missing/stale owner marker straight to terminal `completion_unknown`. Therefore an immediate `status`/`wait` after `start` can permanently terminalize a healthy run before the helper has had time to publish ownership.
- Fix with an explicit bounded startup ownership-publication grace or by preserving `starting` until owner marker is observed. Add a regression: start a helper whose owner publication is deliberately delayed briefly, immediately call status/reconcile, assert it does not become terminal completion_unknown, then after owner publication it becomes running and completes normally.
- Do not make completion_unknown reversible once persisted; avoid entering it for transient startup races in the first place.

- 2026-08-10 04:18:22 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:18:54 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

- 2026-08-10 04:19:19 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

- 2026-08-10 04:20:52 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-10 04:20:53 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-10 04:21:04 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-10 04:23:04 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-10 04:23:18 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:23:33 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-10 04:23:50 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-10 04:24:10 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-10 04:24:14 apply-patch: `packages/os/scripts/lib/subagent/runner.ts`
- 2026-08-10 04:24:22 apply-patch: `packages/os/scripts/lib/subagent/runner.ts`
- 2026-08-10 04:25:04 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

### Orchestrator lifecycle audit — pre-spawn winner crash recovery
- `reconcileDurableSubagentRun` currently returns `starting` for any run with no `pid` until the full execution `deadlineAt`. If the exclusive-claim winner process dies after writing state but before publishing/spawning the runner, a 30-minute subagent timeout can leave a never-started run looking `starting` for 30 minutes.
- Apply the same short `STARTUP_GRACE_MS` to `!run.pid`: before grace -> `starting`; after grace with no runner PID/exit marker -> persist `completion_unknown` with a clear startup-failed/owner-never-published reason. Do not wait for execution deadline when execution never started.
- Add a focused recovery regression without a live provider: create/obtain a claimed starting run whose runner spawn is prevented/aborted, age `startedAt` beyond startup grace (test seam or state fixture; avoid a real 2s sleep), reconcile, and assert completion_unknown rather than indefinitely starting.
- Keep requestId state reusable only as the same run identity; do not silently spawn a second provider on later `start` retry after this uncertainty.

- 2026-08-10 04:27:29 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:29:26 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-10 04:29:33 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

### Pre-spawn recovery regression — RED
- 2026-08-10 04:29:44Z: focused `marks a claimed run completion_unknown after startup grace when no runner PID was published` failed as intended: expected `completion_unknown`, received `starting`.
- The test forces a claimed `starting` state, ages it beyond the 2s startup grace while keeping the execution deadline in the future, reconciles without a PID, and confirms same-request retry reuses the uncertain run rather than spawning. Production fix: apply startup grace to no-PID claims and persist `completion_unknown` with a startup ownership reason.

- 2026-08-10 04:29:58 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
- 2026-08-10 04:30:13 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

- 2026-08-10 04:32:42 apply-patch: `packages/os/scripts/lib/facade/types.ts`

### Orchestrator public-API review note — shared error/status types
- `packages/os/scripts/lib/facade/types.ts` `ErrorCode` currently does not include the contract codes `WAIT_TIMEOUT`, `CAPABILITY_NOT_SUPPORTED`, or `IDEMPOTENCY_CONFLICT` (it has older `UNSUPPORTED_CAPABILITY`). If subagent returns the new explicit codes, update the shared ErrorCode union and any generated/static code expectations consistently rather than casting/lying to TypeScript.
- Preserve backwards-compatible codes only where semantics are genuinely the same; the existing public contract explicitly asserts `WAIT_TIMEOUT` and `CAPABILITY_NOT_SUPPORTED`.
- `SubagentOutput` signature must include lifecycle statuses now exposed by durable actions (`starting`, `running`, `completion_unknown`, `cancelled`) in addition to prior completed/failed/not_configured/not_supported/timed_out, plus optional runId/requestId/reasoning/capabilities/unsupportedCapabilities/usage as actually returned.
- `SubagentInput` should include `action`, `runId`, `waitMs`, `reasoningEffort` and use action-specific validation (`superRefine` is already an established facade pattern if a discriminated union would complicate generators). status/wait/logs/cancel must reject missing runId at validation/runtime and never fall through to provider spawn.

- 2026-08-10 04:32:49 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:33:38 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
### Public API integration wait plan
- start time UTC: 2026-08-10T04:33:30Z
- Wait reason: r12 has the exact 7/7 public red baseline and has begun the shared error-code patch; allow one Luna/xhigh implementation interval without parallel edits to runtime/schema.
- Duration: 30s.
- Resume action: inspect r12 JSONL, public runtime/schema/description diff, and focused contract rerun if present.
- Expected signal: action dispatch/model+reasoning/self-bootstrap/staging/capability patches begin; no lifecycle regression changes unless required by contract integration.
- Fallback: if still reasoning-only but process healthy, inspect child state and continue; if public patch introduces spawn-on-attach or schema/type drift, interrupt and correct.

- 2026-08-10 04:33:38 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:33:51 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-10 04:34:35 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
### Capability-model correction
- Current `subagentCapabilities` marks PI `reasoningEffort:true`, but the PI adapter neither normalizes nor emits any reasoning-effort flag/config; `reasoningEffort` is currently wired only into the Codex provider config. Do not advertise a capability our adapter does not implement.
- Set PI `reasoningEffort:false` unless this task deliberately adds and tests a real PI reasoning mapping. The current scope only requires Codex reasoning, so false is preferred.
- More generally, `reasoningEffort` input against any provider with capabilities.reasoningEffort=false should produce an explicit capability outcome/error rather than silently ignore the request.

- 2026-08-10 04:34:42 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:34:54 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
## BLOCKING public dispatch review — attachment actions must be runId-only
- Current `executeSubagent` computes `provider = normalizeSubagentProvider(input)`, cwd/instruction resolution, reads the instruction file, applies dangerous-instruction checks and strict workspace checks BEFORE the `status/wait/logs/cancel` attachment branch.
- This violates the contract. `status`, `wait`, `logs`, and `cancel` must accept `runId` alone (plus waitMs where relevant), attach to existing durable state, and be structurally unable to spawn or read/validate a new instruction. Public contract calls them without provider/instructionPath.
- Move attachment-action dispatch to the very beginning after action/runId validation, before provider normalization, cwd resolution, instructionPath resolution, file reads, policy/capability checks, or provider config. Resolve provider/model/policy/cwd/instructionPath/capabilities from the persisted `DurableSubagentRun` loaded by runId.
- Missing/unknown runId should return a deterministic validation/not-found failure; it must never fall through to a start/run provider path.
- `logs` similarly reads durable log paths from the run record; no caller-supplied provider/path should be required.
- `cancel` must only write the runner control marker for the referenced run; no instruction source should be touched.
- Schema/CLI must reflect this: provider/instructionPath required only for `run`/`start`, not attachment actions. Use action-specific `superRefine` or equivalent.

- 2026-08-10 04:35:05 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:37:07 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-10 04:38:00 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-10 04:39:03 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-10 04:39:10 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-10 04:39:26 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-10 04:39:34 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-10 04:39:47 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-10 04:39:54 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-10 04:40:00 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-10 04:40:20 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-10 04:40:31 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-10 04:41:10 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-08-10 04:41:44 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-10 04:41:56 apply-patch: `packages/os/tools/subagent/schema.ts`
- 2026-08-10 04:42:02 apply-patch: `packages/os/tools/subagent/schema.ts`

- 2026-08-10 04:45:32 apply-patch: `packages/os/scripts/lib/facade/types.ts`
- 2026-08-10 04:45:32 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`

- 2026-08-10 04:45:45 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-08-10 04:46:07 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-08-10 04:46:21 apply-patch: `packages/os/scripts/subagent.ts`

- 2026-08-10 04:46:50 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-10 04:48:52 apply-patch: `packages/os/scripts/generate-types.ts`
- 2026-08-10 04:49:02 apply-patch: `packages/os/scripts/generate-docs.ts`

- 2026-08-10 04:53:40 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-10 04:54:49 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

## Public API integration and final validation evidence

- Architecture is a filesystem lifecycle store under the canonical Consuelo home `nodeRunsDir`, plus a detached `scripts/lib/subagent/runner.ts`. Run records, staged instructions, provenance, bounded logs, cancel markers, and exit markers survive facade/task-worktree loss. The task cwd/worktree is metadata only.
- Hono was not introduced into process orchestration. Effect was not introduced: the existing typed facade/runtime shape plus durable JSON state made the lifecycle clearer without a framework rewrite. `packages/workspace` runtime was not mirrored or edited.
- 2026-08-10T04:30:30Z: lifecycle regressions green, 8/8, including exclusive same-request claim, aged no-PID pre-spawn recovery, owner-publication grace, bounded tail completion, owned timeout provider-group termination, secret non-persistence/provider receipt, runner-owned cancellation, and starting-window cancellation.
- 2026-08-10T04:42:29Z and 2026-08-10T04:53:59Z: public orchestration contract green, 7/7. Attachment actions dispatch before provider/instruction/cwd work, reuse durable state, and never spawn. Missing/unknown run IDs are validation/not-found failures.
- Codex argv is exact and deterministic: `codex exec --model gpt-5.6-luna -c model_reasoning_effort=\"xhigh\" --cd <cwd> --sandbox <mode> --json -` when advertised by the installed fake/real CLI. The same planner is used by durable start/run and the legacy synchronous compatibility path.
- Reasoning is explicit and capability-gated. PI advertises `reasoningEffort: false`; unsupported reasoning returns `CAPABILITY_NOT_SUPPORTED`. Codex strict workspace-only returns the same structured capability outcome and never degrades to preferred.
- Self-bootstrap edit no longer requires a preexisting taskSession; steering requires `task.start` before task-scoped repository mutation and prominently states `task.push publishes only the task branch` and `task.pr merges to the stream`.
- Canonical external handoffs are accepted only below `path.join(os.tmpdir(), 'opensaas-handoffs')`; they are copied into durable run storage with a 0600 provenance sidecar. Arbitrary tmp files remain rejected.
- No arbitrary environment is serialized: launch/state/markers/logs/summaries contain no inherited env snapshot; the detached runner inherits `process.env) in memory and passes it to the provider. The secret regression proves the provider receives the sentinel while no persisted run file contains it.
- Request identity is durable and idempotent: exclusive `open(..., 'wx')) claims the initial state; losers read/reuse a matching winner and return `IDEMPOTENCY_CONFLICT` for a fingerprint mismatch. Status/wait/logs/cancel attach only and never start a worker. `waitMs) is bounded and returns `WAIT_TIMEOUT` without losing run identity.
- Parent reconciliation only reads liveness with signal 0. The runner owns provider termination through its live child reference and token-bound cancel marker; valid exit markers are terminal truth, while unverified ownership becomes `completion_unknown`.
- Generated surfaces were produced by the active OS generators: `tool.manifest.json) is current, `src/generated/workspace.d.ts), `TOOLS.md), and shared error/type signatures include the action lifecycle contract. Runtime-bundle tests require `scripts/lib/subagent/runner.ts) and passed 20/20.
- Executable discovery passed 8/8. The focused subagent trace-persistence test passed 1/1; the full trace suite was run from the correct `packages/os) cwd with the task branch overridden and 7/8 passed, with the pre-existing `fail-open) expectation returning `NOT_FOUND) in this environment. The initial root-cwd run was correctly classified as a harness path failure, not product evidence.
- Broad `packages/os/scripts/check-syntax.js) was attempted through OS twice but the Consuelo node became temporarily unavailable during the long-running call; narrower changed-source Vitest/generator/CLI checks remained green. Strict review and canonical verify remain before push.

- 2026-08-10 04:55:59 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Workpad punctuation correction

- The public validation notes above mean: process.env is inherited only in memory; the exclusive claim is open(..., 'wx'); waitMs is bounded; and all generated-surface names and paths are ordinary path references. No environment snapshot is persisted.

- 2026-08-10 04:56:21 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-10 04:56:46 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`

- 2026-08-10 04:58:07 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

- 2026-08-10 05:01:55 apply-patch: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

## Orchestrator post-restart idempotency review
- Pushed SHA `861cd0b1080a1bc4740866a65162dd536dcc29d0` independently re-reviewed after OS recovery.
- Blocking race confirmed: `executeCodexLifecycleSubagent` stages `instruction.md` before `startDurableSubagentRun` obtains the exclusive `state.json` claim, and the fingerprint includes source path but not instruction content.
- Red test required before implementation: first start with requestId/content A, mutate the same source path to content B, retry same requestId, assert `IDEMPOTENCY_CONFLICT`, exactly one provider spawn, and winner's persisted staged instruction remains content A.

- 2026-08-11 20:40:05 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-11 20:40:06 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`

- 2026-08-11 20:41:20 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-11 20:41:20 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-11 20:41:36 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`

### Orchestrator post-restart fix + validation
- Confirmed real pre-claim staging bug on pushed SHA `861cd0b1080a1bc4740866a65162dd536dcc29d0` with a new red regression: same requestId + same source path + changed instruction contents returned reuse and could replace the winner's staged instruction.
- Fix: SHA-256 instruction content is now part of the idempotency fingerprint; run artifacts (`instruction.md` + provenance) are persisted by `startDurableSubagentRun` only after the exclusive `state.json` `wx` claim succeeds. Losing retries never write run artifacts. Artifact paths are constrained to the owned run directory.
- New focused regression green: conflict returns `IDEMPOTENCY_CONFLICT`, winner instruction remains unchanged, exactly one provider spawn.
- Lifecycle + public orchestration suites: 16/16 green (8 lifecycle + 8 public contract).
- Executable discovery: 8/8 green.
- Distribution runtime bundle: 20/20 green.
- Focused subagent trace persistence: 1/1 green when invoked from its expected `packages/os` cwd.
- `bun run typecheck`: green (`workspace script syntax checks passed`).
- `bun run generate-tool-manifest:check`: green (`generated manifests are current`).
- Standalone `runtime-bundle:verify` was not a valid invocation because it requires `--archive`; authoritative runtime-bundle test is green 20/20.
- Strict review: 0 owned / 0 pre-existing / 0 blocking.
- Canonical verify against `origin/stream/workspace-agents`: `passed:true`, `publishValid:true`, DB scan clean.
- Next: task.push only; do not call task.pr/task.merge/task.finish until orchestrator reviews GitHub checks.

- 2026-08-11 20:43:44 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Post-push Codex review adjudication
- Codex P1 `Preserve startup grace after the runner exits`: VALID on `973b7307`. `reconcileDurableSubagentRun` only preserves the second startup-grace branch when `runnerAlive`; a fast runner that exits after the initial exit-marker read but before liveness can be persisted as terminal `completion_unknown`. Red regression: a run with a published runner PID that is already dead but still inside `STARTUP_GRACE_MS` must remain nonterminal, then consume a subsequently published owned exit marker.
- Codex P2 `Reject start for providers without detached execution`: VALID on `973b7307`. Gate explicitly exempts `action === 'start'`, then PI/OpenCode/Grok execute synchronously despite `detachedExecution:false`. Red regression: `start` for each non-detached provider must return structured `CAPABILITY_NOT_SUPPORTED` / `not_supported` and must not invoke a provider.
- Codex staging immutability P1: FIXED on `973b7307` with content digest + claim-owned artifact staging and dedicated green regression.

- 2026-08-11 20:46:37 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-11 20:47:03 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-11 20:47:03 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`
- 2026-08-11 20:47:27 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-11 20:47:27 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-11 20:48:19 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

### Codex review fixes — green
- P1 fast-exit startup grace: red regression reproduced `completion_unknown` inside the 2s grace when a published runner PID was already dead. Fix preserves startup grace regardless of liveness after the initial exit-marker read; a subsequently published owned exit marker is consumed authoritatively. Focused green.
- P2 non-detached provider start: red regression reproduced `OK`/synchronous behavior for `action:start` on PI. Fix rejects `start` for every provider whose capability has `detachedExecution:false` (PI/OpenCode/Grok), returning structured `CAPABILITY_NOT_SUPPORTED` / `not_supported`, no runId/provider launch. Table-driven focused green.
- Existing concurrency regression hardened from a fixed 400ms detached-marker sleep to bounded marker polling; full parallel core run exposed the old fixed-delay flake.
- Core lifecycle + public contract: 18/18 green.
- Executable discovery: 8/8 green.
- Distribution runtime bundle: 20/20 green.
- Focused trace persistence: 1/1 green from expected packages/os cwd.
- OS syntax/typecheck: green. Generated manifest check: green.
- Strict review: 0 owned / 0 pre-existing / 0 blocking.
- Canonical verify: passed:true, publishValid:true, DB scan clean.
- Next: stamped verify + task.push --changed only. Do not task.pr/task.merge/task.finish until fresh GitHub CI is terminal and review comments are rechecked.

- 2026-08-11 20:49:39 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Codex second-review adjudication on 973b7307 / current 1bc9d0d
- P1 fingerprint every execution-affecting option: VALID/BLOCKING. Current fingerprint omits bundle, outputFormat, workspaceOnly, taskSession, and timeoutMs even though each changes prompt steering/format/session guidance or runner deadline. Add table-driven red conflicts for each field.
- P2 preserve requested bundle/output format: VALID/BLOCKING. Durable run currently does not persist these and `durableSubagentResult` hardcodes `core`/`json`; attachment audit also loses workspaceOnly/taskSession/branch. Persist durable invocation metadata and return it with backward-compatible defaults.
- P2 successful cancellation should be successful: VALID/BLOCKING. `cancel` can return `status:cancelled`, `code:OK`, `ok:false`. Extend existing cancel contract to require `ok:true`/`OK` for the cancel action.
- These are being fixed before waiting for CI; current CI on 1bc9d0d will be superseded.

- 2026-08-11 20:54:11 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-11 20:54:11 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`

- 2026-08-11 20:55:09 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`

- 2026-08-11 20:55:52 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-11 20:55:52 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

### Codex second-review fixes — green
- Execution-affecting requestId fingerprint now includes bundle, outputFormat, workspaceOnly, taskSession, timeoutMs in addition to provider/model/reasoning/policy/cwd/instruction path+digest/command. Table-driven test proves all five changed values return `IDEMPOTENCY_CONFLICT`, including two valid taskSession fixtures.
- Durable run now persists invocation metadata (bundle/outputFormat/workspaceOnly/taskSession/branch) and start/status attachment responses preserve it. Older run records remain backward-compatible via core/json/false defaults.
- Successful cancel action now returns a coherent success envelope: cancelled + OK + ok:true + exitCode 0. Non-cancel status of a cancelled run is not globally reclassified as success.
- Core lifecycle + public orchestration: 20/20 green (9 + 11).
- Executable discovery: 8/8 green. Distribution runtime bundle: 20/20 green. Focused trace persistence: 1/1 green.
- OS syntax/typecheck green; generated manifests current.
- Strict review: 0 owned / 0 pre-existing / 0 blocking.
- Canonical verify: passed:true, publishValid:true, DB scan clean.
- Next: stamped verify + explicit-file task.push onto current remote task head; no task.pr/task.merge/task.finish.

- 2026-08-11 20:57:30 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Codex third-review adjudication on 1bc9d0d / current 30ff898
- P2 edit capability enforcement: VALID/BLOCKING. Capability table marks OpenCode/Grok edit=false; OpenCode has a local refusal but Grok still executes. Make the generic capability table authoritative and reject policy=edit whenever capabilities.edit=false before provider invocation. Add table-driven OpenCode+Grok regression.
- P2 durable trace persistence: VALID/BLOCKING. Durable Codex parser parses child events but does not call recordSubagentTraceEventsSafely; old compact path did. Add durable-runtime trace persistence regression and restore persistence without duplicate rows across repeated attachments.
- P2 durable audit metadata: PARTIALLY SUPERSEDED by 30ff898. workspaceOnly/taskSession/branch are now persisted and tested. rawShellUsed remains falsely hardcoded false even though the prior synchronous Codex path reported true after invoking the external CLI. Preserve rawShellUsed in durable state; extend metadata regression.
- Current CI on 30ff will be superseded by these fixes; do not merge while these contract gaps remain.

- 2026-08-11 20:59:32 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-11 21:00:32 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`
- 2026-08-11 21:00:32 apply-patch: `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- 2026-08-11 21:00:32 apply-patch: `packages/os/tests/trace-persistence.test.ts`
- 2026-08-11 21:01:15 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-11 21:01:15 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

### Codex third-review fixes — green
- Generic edit capability gate now rejects policy=edit whenever capabilities.edit=false; table-driven OpenCode+Grok regression is green with CAPABILITY_NOT_SUPPORTED/not_supported and no provider launch.
- Durable runs now persist originating traceId and rawShellUsed. Codex durable starts persist rawShellUsed=true; start/status metadata regression preserves true alongside workspaceOnly/taskSession/branch.
- Terminal durable responses parse child events and call recordSubagentTraceEventsSafely with the originating run traceId and persisted cwd/taskSession/branch/stdout log. Persistence uses existing stable INSERT OR REPLACE IDs, so repeated terminal attachments do not duplicate child rows.
- New Bun/SQLite end-to-end durable trace fixture: run persists codex.fs.read + turn.completed under original result.traceId; subsequent status leaves the same child row count and same parent trace.
- Core lifecycle + public orchestration: 21/21 green (9 + 12).
- Relevant trace persistence tests: 2/2 green (existing parsed-event persistence + new durable runtime persistence). Full trace suite has two unrelated task-worktree-sensitive fixtures: synthetic task/os branch expectation resolves to this real task branch here, and fail-open context fixture returns NOT_FOUND in this worktree. Neither is owned by this diff; focused owned trace gates are green.
- Executable discovery: 8/8 green. Distribution runtime bundle: 20/20 green. OS typecheck/syntax green; generated manifests current.
- Strict review: 0 owned / 0 pre-existing / 0 blocking.
- Canonical verify: passed:true, publishValid:true, DB scan clean.
- Next: stamped verify + explicit-file task.push onto current remote head. No task.pr/task.merge/task.finish.

- 2026-08-11 21:02:56 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

### Codex fourth-review adjudication on 30ff / current 210ff
- P2 CLI requestId forwarding: VALID/BLOCKING. `packages/os/scripts/subagent.ts` must parse/document `--request-id` and forward `requestId`; otherwise CLI start retries derive new run IDs and duplicate agents. Add CLI-focused regression.
- P2 originating trace ID: FIXED on 210ff. Durable run persists launch traceId; terminal child trace rows use it and end-to-end test proves status does not duplicate/reparent rows.
- P2 durable runner errors: VALID/BLOCKING. `run.error` can contain artifact/runner-spawn diagnostics while durable response stderr/message stays generic/empty. Add failed-run response regression and surface run.error.
- P2 failed attachment result codes: VALID/BLOCKING. status/logs can return code OK with ok:false for failed/timed_out/completion_unknown. Make attachment transport success distinct from underlying run outcome or map deterministic non-OK codes; add regression.
- Do not merge until these are fixed, latest SHA CI is terminal-green, and Codex has reviewed latest head.

- 2026-08-11 21:04:38 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`

- 2026-08-11 21:06:09 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`
- 2026-08-11 21:06:10 apply-patch: `packages/os/tests/subagent-cli.test.ts`

- 2026-08-11 21:06:56 apply-patch: `packages/os/scripts/subagent.ts`
- 2026-08-11 21:06:56 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-11 21:07:21 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

### Codex fourth-review fixes — green
- CLI now exports a pure parse helper, guards execution with import.meta.main, documents `--request-id`, and forwards requestId into ToolInput. CLI focused test proves idempotency key forwarding without executing main on import.
- Attachment parser now uses the persisted originating run traceId, so durable summaries as well as trace rows remain correlated to launch.
- Durable responses surface `run.error` in stderr/message when logs are empty, preserving artifact/runner-spawn diagnostics.
- status/logs are successful attachment/query operations (`OK`, ok:true) even when the underlying run status is failed/timed_out/completion_unknown; underlying status and error remain in data. wait maps underlying failed/completion_unknown/cancelled to COMMAND_FAILED and timed_out to TIMEOUT; successful cancel remains OK/ok:true.
- Core lifecycle + public contract + CLI: 23/23 green (9 + 13 + 1).
- Relevant trace persistence: 2/2 green. Executable discovery 8/8. Distribution runtime bundle 20/20. OS typecheck/syntax green; generated manifests current.
- Strict review: 0 owned / 0 pre-existing / 0 blocking.
- Canonical verify: passed:true, publishValid:true, DB scan clean.
- Next: stamp + explicit-file task.push onto current remote head 210ff15; then freeze code and wait for fresh CI and Codex review on exact new SHA. No task.pr/task.merge/task.finish.

- 2026-08-11 21:08:49 append: `.task/workspace-agents/repair-subagent-orchestration-contract/workpad.md`
