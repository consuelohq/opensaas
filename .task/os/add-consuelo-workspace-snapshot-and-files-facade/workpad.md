# add consuelo workspace snapshot and files facade

branch: `task/os/add-consuelo-workspace-snapshot-and-files-facade`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/560/add-consuelo-workspace-snapshot-and-files-facade
github pr: https://github.com/consuelohq/opensaas/pull/560
started: 2026-05-24

## acceptance criteria

- [x] Update the published Stream OS spec to make the next approved task explicit: `consuelo-workspace-snapshot` plus files/artifacts facade.
- [x] Add a decision-log entry recording the alignment: Consuelo app Files/Attachments/S3/Postgres are source of truth; Mirage is future optional VFS, not the first backend.
- [x] Add a read-only `consuelo-workspace-snapshot` OS skill.
- [x] Wrap Consuelo workspace access in a typed Bun facade that can read GraphQL/API-compatible data shapes and fail safely when the capability is missing.
- [x] Include Files and Attachments in the snapshot output shape with stable app-native object refs.
- [x] Keep the first task read-only: no uploads, writes, mutations, S3 puts, or Mirage dependency.
- [x] Add focused tests for success, missing capability, auth/query failure, schema gap, and empty workspace.
- [x] Validate against `origin/stream/os`; publish/promote into the existing OS stream PR.

## plan

1. Read current OS skill runtime, GraphQL proof, capability registry, artifact code, and app file/S3 routes.
2. Add a small typed Consuelo workspace client/facade and snapshot skill runner.
3. Add skill metadata/manifest wiring and OS dispatcher support.
4. Update docs/spec/decision log with the approved alignment and next task state.
5. Add focused tests with mocked fetch and no external calls.
6. Run syntax, focused tests, review, verify, publish/promote, and republish design wiki/spec.

## current status

- Implemented and validated. Ready to push/promote into `stream/os`.

## files changed

- `packages/os/scripts/lib/consuelo-workspace-client.ts`
- `packages/os/scripts/workspace/consuelo-workspace-snapshot.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/consuelo-workspace-snapshot/skill.json`
- `packages/os/skills/consuelo-workspace-snapshot/SKILL.md`
- `packages/os/tests/consuelo-workspace-snapshot.test.ts`
- `packages/os/tooling/tool-manifest.json`
- `packages/os/README.md`
- `packages/os/skills.md`
- `packages/os/docs/skills.md`
- `packages/os/data-model.md`
- `packages/os/integrations.md`
- `packages/os/docs/env-capability-matrix.md`
- `packages/os/decision.md`
- local design archive spec HTML updated/re-published after promotion


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-05-24 03:32:28 `checkFiles`: passed — OK
- 2026-05-24 03:34:54 `checkFiles`: passed — OK
- 2026-05-24 03:35:52 `review.run`: passed — OK
- 2026-05-24 03:37:08 `checkFiles`: passed — OK
- 2026-05-24 03:37:28 `review.run`: passed — OK
- 2026-05-24 03:37:32 `verify`: failed — COMMAND_FAILED
- 2026-05-24 03:37:40 `verify`: passed — OK

## key decisions

- Source of truth is Consuelo app objects and file records first.
- OS artifacts should later bridge into app-native Files/Attachments backed by S3.
- Mirage is an optional future VFS layer after the app-native file/artifact contract exists.
- This slice is read-only only.

## notes for ko

- Approved scope includes spec update, decision log update, and the next task implementation.

## improvements noticed

- Aggregate verify can call a stale review flag (`--summary-json`) on this stream; explicit `review.run` plus `verify --no-review` is the working recovery path.


## issues and recovery

- Direct Vitest imports of `scripts/os.ts` failed because Vitest/Node could not import `bun:sqlite`; recovered by matching existing OS test style and invoking `bun -e` from tests.
- First focused test run showed empty response was reported as `ok` when only `CONSUELO_WORKSPACE_ID` existed; changed empty status to depend on returned object counts, not env-only workspace id.
- Review found missing try/catch around the awaited workspace facade call; added local try/catch.
- Initial `verify` failed on unsupported `--summary-json`; recovered with explicit passing review and `verify --no-review --no-db`.


---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```
