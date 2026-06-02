# prune non os changes from stream os

branch: `task/os/prune-non-os-changes-from-stream-os`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/701/prune-non-os-changes-from-stream-os
github pr: https://github.com/consuelohq/opensaas/pull/701
started: 2026-06-02

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

- 2026-06-02 19:02:27 fs.write: `.task/os/prune-non-os-changes-from-stream-os/workpad.md`
- 2026-06-02 19:05:10 fs.write: `.task/os/prune-non-os-changes-from-stream-os/workpad.md`

## workspace-owned: validation evidence

- none yet

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```


## prune plan

Goal: reduce `stream/os -> main` to the OS shipment only, without losing recoverability.

Safety:
- Created remote backup branch before editing: `backup/os-stream-pre-prune-20260602` pointing at the pre-prune `origin/stream/os` tip.
- This task is additive/reverting; it does not delete the backup or old stream history.

Acceptance criteria:
- Reset clearly non-OS paths in `stream/os` back to `origin/main`.
- Keep hosted installer route and OS package/docs work required for deploy/dogfood.
- Show final `origin/main...HEAD` file list/count before promotion.
- Validate OS bootstrap/help/dry-run and server route files remain present.
- Do not merge `stream/os` to `main`; Ko will do that manually.

Keep policy:
- `packages/os/**`
- OS docs/navigation under `packages/consuelo-docs/**` that are part of OS onboarding/docs.
- Hosted installer route/controller/module files needed for `GET /os`.
- CLI OS entrypoint if present and intentionally tied to local OS install/developer UX.

Reset policy:
- `packages/workspace/**`
- `packages/consuelo-design/**` and `areas/consuelo-design/**`
- `agent-browser.json`
- `packages/twenty-front/**`
- unrelated `packages/twenty-server/**` GraphQL/session/dialer files; keep only OS route/module files.
- unrelated task metadata from non-OS areas.
- root `.task/evidence-log.json`, `.task/read-log.json`, `.task/explore-state.json` unless necessary.

Test-first contract:
- Behavior under test: pruning should not break the OS bootstrap installer or hosted route registration.
- Red/baseline: current `git diff --name-only origin/main...origin/stream/os` has 413 files and includes `packages/workspace/**` source files.
- Expected green: final diff should no longer include workspace/design/front/dialer/session/GraphQL unrelated paths, and OS bootstrap validation should still pass.
- No new unit test planned unless route/module edits reveal a changed behavior; this is path pruning/revert cleanup with focused smoke validation.

- 2026-06-02 19:02:27 append: `.task/os/prune-non-os-changes-from-stream-os/workpad.md`


## pruning result

Created backup branch before pruning:

- `backup/os-stream-pre-prune-20260602`

Pruned paths by resetting them to `origin/main` or removing stream-only files:

- `packages/workspace/**`
- `packages/consuelo-design/**`
- `areas/consuelo-design/**`
- `agent-browser.json`
- `packages/twenty-front/**`
- `packages/twenty-shared/**`
- unrelated `packages/twenty-server/**` GraphQL/session/dialer files
- broad historical `.task/os/**` and `.task/tasks/os/**` metadata, preserving this cleanup task metadata only
- unrelated `.task/tasks/dialer/**` and `.task/tasks/workspace-agents/**` by restoring main state so they do not appear in the final stream PR diff

Final PR-equivalent diff after local cleanup commit:

```text
248 files total
218 packages/os
22 packages/consuelo-docs
3 .task/os
2 packages/twenty-server
2 packages/cli
1 .task/tasks
```

Disallowed-path guard passed: no `packages/workspace`, `packages/consuelo-design`, `areas/consuelo-design`, `packages/twenty-front`, `packages/twenty-shared`, `agent-browser.json`, unrelated GraphQL/session/dialer server files remain in `origin/main...HEAD`.

Validation:

```bash
git diff --name-only origin/main...HEAD
git diff --name-only origin/main...HEAD | category count
# 248 total, categories listed above
bad-path grep guard # no disallowed paths
bash -n packages/os/scripts/bootstrap.sh
bash packages/os/scripts/bootstrap.sh --help
bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json
node -e 'JSON.parse(fs.readFileSync("packages/consuelo-docs/docs.json","utf8"))'
git diff --check
```

Notes:

- The previous broad stream state is recoverable from `backup/os-stream-pre-prune-20260602`.
- The cleanup intentionally removes old OS task metadata from the final PR for reviewability. Runtime/source OS work remains in `packages/os`, `packages/consuelo-docs`, the OS CLI files, and the hosted route/module files.

- 2026-06-02 19:05:09 append: `.task/os/prune-non-os-changes-from-stream-os/workpad.md`
