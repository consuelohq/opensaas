# fix final task workflow Codex review findings

branch: `task/workspace-agents/fix-final-task-workflow-codex-review-findings`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1852/fix-final-task-workflow-codex-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1852
started: 2026-08-11

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

- 2026-08-11 23:55:24 fs.write: `.task/workspace-agents/fix-final-task-workflow-codex-review-findings/workpad.md`
- 2026-08-11 23:56:17 fs.write: `.task/workspace-agents/fix-final-task-workflow-codex-review-findings/workpad.md`
- 2026-08-11 23:58:07 fs.write: `.task/workspace-agents/fix-final-task-workflow-codex-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-08-11 23:58:33 `review.run`: passed — OK
- 2026-08-11 23:58:42 `verify`: passed — OK

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

## Test-first contract

- Behavior under test: the untouched JIT Test-first template must remain publish-incomplete, and `task.pr`'s Ko-approved workpad escape hatch must survive workspace facade validation/planning as well as the canonical OS facade.
- Existing local pattern: `bodyHasMeaningfulAgentContent` in mirrored task-workpad helpers; OS `TaskPrInput` already accepts `ackWorkpadIncomplete`, while the workspace compatibility schema/signature still omits it even though its manifest command maps the flag.
- New or changed tests: add a readiness regression using the exact pending Test-first template; extend workspace manifest/facade parity coverage so schema parsing and input signatures include `ackWorkpadIncomplete`, matching OS.
- Focused red command: workspace task-workpad + tool-manifest/facade schema tests, plus OS tool-manifest parity.
- Expected red failure: punctuation left by `stripMarkdownNoise` makes the untouched pending contract meaningful; workspace Zod/schema signature strips the escape-hatch field.
- No-test waiver: none.

- 2026-08-11 23:55:24 append: `.task/workspace-agents/fix-final-task-workflow-codex-review-findings/workpad.md`

- 2026-08-11 23:56:05 apply-patch: `packages/workspace/tests/tool-manifest.test.ts`
- 2026-08-11 23:56:05 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-08-11 23:56:05 apply-patch: `packages/workspace/tests/task-workpad.test.ts`
## Transport recovery wait

Wait reason: OS transport dropped during the destructive-literal preflight before running the focused red tests.
Duration: 20s
Resume action: immediately rerun the exact preflight for the three selected test files.
Expected signal: a normal code.call envelope showing no destructive literals.
Fallback: if transport is still unavailable, retry once through the authenticated OS surface; do not run tests or publish until the preflight can execute.

- 2026-08-11 23:56:17 append: `.task/workspace-agents/fix-final-task-workflow-codex-review-findings/workpad.md`

- 2026-08-11 23:57:44 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-08-11 23:57:44 apply-patch: `packages/os/scripts/lib/task-workpad.js`
- 2026-08-11 23:57:44 apply-patch: `packages/workspace/scripts/lib/task-workpad.js`
- 2026-08-11 23:57:44 apply-patch: `packages/workspace/scripts/lib/facade/schemas.ts`
## Final Codex review evidence

- P2 workpad readiness reproduced: the exact untouched Test-first template returned ready=true because punctuation survived Markdown normalization. Red test failed as expected.
- Fix: placeholder-only comparison now strips non-alphanumeric punctuation before checking the known pending scaffold tokens. Applied identically in canonical OS and workspace compatibility helpers.
- P2 task.pr facade reproduced: workspace TaskPrInput safeParse succeeded but stripped `ackWorkpadIncomplete`, while the manifest command already mapped `--ack-workpad-incomplete`. OS Zod/signature were correct but its generated declaration was stale.
- Fix: workspace Zod schema and schema signature now include `ackWorkpadIncomplete`; regenerated both workspace and OS client declarations; parity tests assert Zod preservation, signature exposure, generated type exposure, and command mapping.
- Red: workspace focused run had 2 intended failures; OS parity test initially hit a test-harness import typo, corrected before production validation.
- Green: workspace task-workpad + tool-manifest 18/18; OS tool-manifest 16/16.

- 2026-08-11 23:58:07 append: `.task/workspace-agents/fix-final-task-workflow-codex-review-findings/workpad.md`
