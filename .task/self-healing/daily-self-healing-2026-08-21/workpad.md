# daily self-healing 2026-08-21

branch: `task/self-healing/daily-self-healing-2026-08-21`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2171/daily-self-healing-2026-08-21
github pr: https://github.com/consuelohq/opensaas/pull/2171
started: 2026-08-22

## acceptance criteria

- [x] Run the canonical 24-hour self-healing monitor (or current-source equivalent when the installed facade is drifted) and classify the strongest recent failures by governing contract.
- [x] Check current main, `stream/self-healing`, recent OS development, and relevant PR history so already-fixed/runtime-drift failures are not duplicated.
- [x] Fix only one to four coherent, high-confidence OS/tooling defects when evidence supports a bounded source correction; otherwise record a truthful no-source-change result.
- [x] For any source change, capture a focused RED regression first, implement the root-cause correction, and pass focused GREEN plus strict review/full verify against `origin/stream/self-healing`.
- [ ] Push the daily task, promote it only into `stream/self-healing`, preserve the human-only stream-to-main boundary, and publish the normalized report plus this generated workpad to Daily Schedules.

## plan

1. Run the current-source monitor because the installed `monitor.errors` facade currently reports `Script not found`, then rank only actionable groups.
2. Reconstruct contracts for the strongest candidates using current task/stream source, traces, current authoritative OS work, and PR history; treat installed/source drift and healthy policy/caller failures as non-defects.
3. If a bounded source defect remains, write/run its focused regression RED before production edits, implement the smallest root-cause fix, inspect the diff, and run focused GREEN.
4. Update this workpad with classifications and evidence, then run strict review/full verify against `origin/stream/self-healing`, push, promote task -> stream, and publish Daily Schedules. Never merge the stream -> main review PR.

## current status

- Task started from synchronized `stream/self-healing`; task PR is #2171.
- Installed/runtime drift is already confirmed for `monitor.errors`, the typed GitHub facade, `stream.sync --repo`, and canonical `session.start`; current stream source already contains prior fixes for the first three, so they must not be duplicated merely because the installed runtime is stale.
- Hosted install/onboarding telemetry was not discoverable from the current typed tool surface; continue with local dogfood traces and repository evidence unless a normalized user-impact surface is found.
- Current-source 24-hour monitor produced 14 groups: 2 caller-input, 2 defect-candidate, 8 transient, 2 unknown, 2 actionable. The two monitor-actionable groups (`github/COMMAND_FAILED` and `stream.sync/COMMAND_FAILED`) are already fixed in current `stream/self-healing` and are installed/source drift, not new source work.
- A direct canonical `session.start` attempt exposed the selected source defect: documented top-level facade `timeout` is merged into typed input, but common facade request schemas do not declare it. Non-strict schemas silently strip the execution bound, while strict `SessionStartInput` rejects the call entirely. The same omission exists in the workspace facade mirror.
- Focused RED: `packages/os/tests/session-start-foundation.test.ts` failed 1/10 when a valid task constructor included `timeout: 120000` (`trc_e143d75e0dc0`). Production fix now adds `timeout` to shared request fields in both OS/workspace facade schemas. Focused GREEN passes 14/14 across OS session-start and workspace compatibility tests (`trc_18074af2fd40`).
- Strict review passed with 0 blocking issues (`trc_8c6313cf50aa`). Full verify against `origin/stream/self-healing` is publish-valid with DB guard 0 risks / 0 findings (`trc_f59e0c042457`). Selected verification suites all passed, including 106 workspace facade input contracts, 22 workspace manifest/session contracts, 213 lifecycle/handoff contracts, 49 OS work-session filesystem contracts, and focused facade snapshot/compatibility suites.

## files changed

- `packages/os/scripts/lib/facade/schemas.ts` — retain the documented common facade `timeout` field through runtime schema validation.
- `packages/os/tests/session-start-foundation.test.ts` — regression for strict canonical `session.start` accepting and retaining facade timeout.
- `packages/workspace/scripts/lib/facade/schemas.ts` — mirror the common request-field invariant in workspace tooling.
- `packages/workspace/tests/session-start-compatibility.test.ts` — mirrored compatibility regression.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-22 01:59:52 `review.run`: passed — OK
- 2026-08-22 02:00:12 `verify`: passed — OK

## key decisions

- `stream/self-healing` is the only promotion target. `stream/self-healing -> main` remains human-only.
- Runtime/source drift is evidence to record, not a reason to manufacture another source patch when the current source contract is already correct.
- Selected source defect: documented facade execution `timeout` is intentionally merged into typed tool input, but the shared request schema omitted it. This is not already fixed in current `stream/os` (the relevant gateway/executor/schema paths match this task source), and it directly breaks canonical generated `session.start` while causing other non-strict tool schemas to drop the execution bound.
- Preserve the existing transport/executor design: accept and retain `timeout` in shared request fields rather than creating a second timeout channel or weakening strict `session.start` validation.

## notes for ko

- The installed runtime remains behind current source for several already-fixed self-healing surfaces (`monitor.errors`, GitHub CLI resolution, and `stream.sync --repo`). This run did not run install/update/restart or otherwise cross the human lifecycle boundary.

## improvements noticed

- Parallel task-scoped file reads exposed a separate evidence-recording race: `.task/.../read-log.json` became temporarily binary/corrupt and evidence events were lost while concurrent `task-fs` processes performed read-modify-write updates. The generated workpad itself remained usable and verify passed. This was recorded but intentionally not expanded into a second unrelated source change after the selected task/facade fix was validated; it is a high-confidence candidate for a future self-healing run.

## issues and recovery

- Installed `monitor.errors` failed with `Script not found "monitor:errors"` (`trc_1368dcebb9b8`); the current task source contains the script and will be used as the permitted equivalent monitor path.
- Typed GitHub `pr.list` currently recurses through the stale `gh` wrapper and fails JSON parsing (`trc_2f327e0cff6d`); current self-healing source already has the external-CLI resolution fix and its focused tests pass.
- `stream.sync` with the manifest-supported `repo` field failed `unknown flag: --repo` (`trc_517495c1605d`); retry without the compatibility field succeeded and proved the current stream already contains/passes the repo-option regression coverage.
- Canonical `session.start({kind:"task"})` failed validation because the runtime injected/rejected a `timeout` key (`trc_7c6097643a6a`); compatibility `task.start` successfully created this task. Investigate recurrence/current source before deciding whether this is a new source defect or installed facade drift.
- An initial hypothesis treated the outer timeout as separate executor metadata. A RED experiment disproved that interpretation: the existing MCP gateway contract deliberately merges timeout into typed input, and the executor already reads `input.timeout`. The experimental assertions were reverted. That broad facade test also touched a snapshot during execution; the tracked snapshot was restored immediately, leaving no intended snapshot diff.

## Test-first contract

- Behavior under test: top-level `os.call.timeout` is a documented common facade field that is merged into tool input before schema validation. Shared schemas must accept and retain it so the executor can enforce the requested bound and strict `session.start` does not reject an otherwise-valid constructor.
- Governing invariant: generated task guidance emits `os.call({ tool, input, taskSession, timeout })`; `facadeToolInput` merges that timeout into the typed request; `executeTool` reads `input.timeout` through `getTimeoutMs`. Therefore `timeout` belongs in the shared facade request fields. Strictness must remain intact for actual unknown keys.
- Existing local pattern: OS/workspace schemas share `requestFields`; `packages/os/tests/session-start-foundation.test.ts` owns strict constructor validation and `packages/workspace/tests/session-start-compatibility.test.ts` owns the mirrored compatibility surface.
- New or changed tests: OS strict `SessionStartInput` must parse and retain `timeout: 120000`; the workspace mirror must do the same.
- Focused red command: `bunx vitest run packages/os/tests/session-start-foundation.test.ts` after destructive-literal preflight.
- Expected red failure: before production edits, the strict constructor rejected the documented timeout (`trc_e143d75e0dc0`: 1 failed, 9 passed).
- Focused green command: `bunx vitest run packages/os/tests/session-start-foundation.test.ts packages/workspace/tests/session-start-compatibility.test.ts` (`trc_18074af2fd40`: 14/14 passed).
- No-test waiver: not applicable; this is a reproduced contract defect with focused coverage.

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/hooks/task/guidance.js`
- `packages/os/scripts/lib/code-call/schema.ts`
- `packages/os/scripts/lib/facade/batch.ts`
- `packages/os/scripts/lib/facade/client.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/monitor-errors-report.ts`
- `packages/os/scripts/monitor-errors.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/call-service.ts`
- `packages/os/test-selection.rules.json`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/mcp-openai-session-receipt.test.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/workspace/hooks/task/guidance.js`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/state/evidence-log.js`
- `packages/workspace/scripts/lib/state/explore-state.js`
- `packages/workspace/scripts/lib/task-registry.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/session-start-compatibility.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

- 2026-08-22 02:00:30 apply-patch: `.task/self-healing/daily-self-healing-2026-08-21/workpad.md`