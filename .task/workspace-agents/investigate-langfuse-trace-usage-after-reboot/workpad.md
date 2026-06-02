# investigate langfuse trace usage after reboot

branch: `task/workspace-agents/investigate-langfuse-trace-usage-after-reboot`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/500/investigate-langfuse-trace-usage-after-reboot
github pr: https://github.com/consuelohq/opensaas/pull/500
started: 2026-05-23

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

- 2026-05-23 06:43:22 fs.write: `.task/workspace-agents/investigate-langfuse-trace-usage-after-reboot/workpad.md`
- 2026-05-23 06:48:17 fs.write: `.task/workspace-agents/investigate-langfuse-trace-usage-after-reboot/workpad.md`
- 2026-05-23 06:56:04 fs.write: `.task/workspace-agents/investigate-langfuse-trace-usage-after-reboot/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 06:54:50 `review.run`: passed — OK
- 2026-05-23 06:55:16 `review.run`: passed — OK
- 2026-05-23 06:56:25 `verify`: passed — OK
- 2026-05-23 07:00:21 `review.run`: passed — OK
- 2026-05-23 07:02:30 `review.run`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## investigation checkpoint — initial task setup

### acceptance criteria

- Determine whether Langfuse tracing stopped or only token/cost reporting is missing after reboot.
- Inspect current workspace tracing code, local trace storage/logs, and environment loading.
- Identify whether recent workspace changes plausibly caused the issue.
- Fix only if the cause is clear and scoped; otherwise report exact next action.

### plan

1. Search/read Langfuse tracing implementation and env docs.
2. Inspect recent local traces/logs for usage/token fields.
3. Compare emitted Langfuse payload fields with Langfuse expectations.
4. Check server process env/health after reboot without exposing secrets.
5. Patch and validate if a clear wiring bug is found.

- 2026-05-23 06:43:22 append: `.task/workspace-agents/investigate-langfuse-trace-usage-after-reboot/workpad.md`

## investigation checkpoint — findings before fix

Findings:

- Langfuse remote traces are still arriving after reboot; the screenshot shows recent `status`, `github`, `mac.exec`, `task.merge`, `fs.*`, and `gh` observations.
- Local SQLite trace storage is working and has token estimates: latest rows include `inputTokens`, `outputTokens`, and `totalTokens`.
- The server currently sends Langfuse observations as `generation` and updates them with `usage_details`, but it does not set a stable model name or duplicate usage into metadata.
- The Langfuse UI cost column showing `$0.00` is expected without model pricing/cost details. Ko previously said cost details are not needed.

Plan:

- Make workspace traces more robust by setting a stable model label (`workspace-tool-estimate`) and adding the estimated usage into observation metadata as well as `usage_details`.
- Add tests that the Langfuse observation starts as `generation`, carries the model label, and updates usage details/metadata.
- Keep cost details out.

- 2026-05-23 06:48:17 append: `.task/workspace-agents/investigate-langfuse-trace-usage-after-reboot/workpad.md`

## validation checkpoint before publish

Files changed:

- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

Validation evidence:

- Local trace DB contains token estimates for recent calls (`inputTokens`, `outputTokens`, `totalTokens`).
- Langfuse traces are still arriving, so tracing did not fully stop after reboot.
- `server.py` now sets a stable `workspace-tool-estimate` model label and duplicates estimated usage into Langfuse metadata while preserving `usage_details`.
- `/Users/kokayi/Dev/opensaas/packages/workspace/.venv/bin/python3 -m py_compile packages/workspace/server.py`: passed.
- Focused Langfuse regression test: passed.
- Full `packages/workspace/tests/server_call_test.py`: passed, 32 tests.

Notes:

- Cost remains expected to be `$0.00` because no cost details/pricing are being sent by design.
- `review.run` and `verify` timed out at the caller boundary; focused syntax and server-call regression tests passed.

- 2026-05-23 06:56:04 append: `.task/workspace-agents/investigate-langfuse-trace-usage-after-reboot/workpad.md`
