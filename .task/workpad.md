# remove decision process from steering bootstrap

branch: `task/workspace-agents/remove-decision-process-from-steering-bootstrap`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/424/remove-decision-process-from-steering-bootstrap
github pr: https://github.com/consuelohq/opensaas/pull/424
started: 2026-05-21

## acceptance criteria

- [x] Stop `get_steering` from appending `packages/workspace/decision.md`.
- [x] Keep `packages/workspace/decision.md` available as the owning decision-engine doctrine file.
- [x] Use task-scoped workspace tools and inspect why prior repo reads fell back to `mac.exec`.
- [x] Validate Python syntax for the touched server file.

## plan

1. Start a task from `main` under `workspace-agents` and pin it for fallback compatibility.
2. Read repo standards and the current `packages/workspace/server.py` steering assembly.
3. Remove the `decision.md` append from `_read_steering`.
4. Validate syntax, inspect diff, and record task/pin observations.

## files changed

- `packages/workspace/server.py`
- `.task/workpad.md`

## key decisions

- `DECISION_PROCESS_FILE` can remain defined for now. The behavior change is in `_read_steering`, where the file was read and appended.
- A code comment was left at the former append site because the current `fs.patch` facade rejects empty replacement content. The comment makes the new behavior explicit and keeps the patch transport safe.
- No docs update was required because existing docs already say decision-engine doctrine lives in `packages/workspace/decision.md`; this task changes bootstrap payload size, not the doctrine owner.

## notes for Ko

- Earlier `fs.search` failed with `TASK_SESSION_REQUIRED` because no task had been started yet in that investigation path. That failure pushed the workflow into `mac.exec` for read-only repo inspection.
- After `task.start` returned `taskSession` `tsk_ab2d94223cc4`, `task.pin` succeeded and task-scoped `fs.read`, `fs.patch`, `task.exec`, and `task.current` worked correctly.
- Current pinned task state resolves to `task/workspace-agents/remove-decision-process-from-steering-bootstrap`.
- The likely workflow issue is not a failed pin in this task. The issue is that task-scoped tools reject without `taskSession`, while investigation-only work before `task.start` has no safe branch-scoped read path except root/mac fallback.

## improvements noticed

- `fs.patch` should support deleting a line range with empty replacement content. It currently rejects empty inline content and `tmp.write` also rejects empty content.
- There should be a read-only repo `fs.search`/`fs.read` path for investigation before task creation, or the facade should allow task-scoped tools to fall back safely only after an explicit `task.current`/pin check.
- The task workflow docs correctly say to start/pin before task-scoped file work, but the tool error can nudge agents toward `mac.exec` instead of telling them to start or pin a task.
- `fs.write` overwrite failures echo the full attempted payload to stderr, which makes long workpad writes noisy.

## errors i ran into

- `fs.patch` with `content: ""` failed validation: `provide exactly one of content or contentFile`.
- `tmp` with empty content failed validation: `Too small: expected string to have >=1 characters`.
- Before this task was started, `fs.search` failed with `TASK_SESSION_REQUIRED`.
- `fs.write .task/workpad.md` failed until `force: true` was supplied.

## validation commands and results

- `fs.read packages/workspace/server.py --from 281 --to 294` through task session — confirmed `decision.md` append was removed.
- `task.exec python3 -m py_compile packages/workspace/server.py` — passed.
- `task.exec git diff -- packages/workspace/server.py` — confirmed only the intended steering bootstrap change.
- `task.current` — resolved to `task/workspace-agents/remove-decision-process-from-steering-bootstrap`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): stop injecting decision process into steering" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-21 06:03:12 write: `.task/workpad.md`
- 2026-05-21 06:58:14 patch lines 496-496: `packages/workspace/STEERING.md`
- 2026-05-21 06:58:20 patch lines 123-123: `packages/workspace/README.md`
- 2026-05-21 06:58:32 patch lines 19-30: `packages/workspace/SCRIPTS.md`
- 2026-05-21 06:58:52 patch lines 27-27: `packages/workspace/SCRIPTS.md`
- 2026-05-21 06:59:19 patch lines 513-513: `packages/workspace/tests/facade/facade.test.ts`
- 2026-05-21 07:00:50 patch lines 48-48: `packages/workspace/SCRIPTS.md`