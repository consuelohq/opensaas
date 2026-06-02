# restore workspace research ingest script

branch: `task/workspace-repair/restore-workspace-research-ingest-script`
stream: `stream/workspace-repair`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/712/restore-workspace-research-ingest-script
github pr: https://github.com/consuelohq/opensaas/pull/712
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

- none yet

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
bun run task:push -- --message "type(workspace-repair): description" --changed
bun run task:pr
bun run task:finish
```

## Incident note

After PR #707 restored workspace helper libraries, a broader script target audit still found one missing root script entrypoint on `origin/main`:

- `research:ingest -> packages/workspace/scripts/research-ingest.js`

Root cause is the same OS stream merge pattern: `b6233b465e Stream/os (#362)` deleted the workspace copy and added an OS copy at `packages/os/scripts/research-ingest.js`. This task restores the workspace-owned entrypoint from `origin/stream/workspace-agents`.

## Intended files

- `packages/workspace/scripts/research-ingest.js`
- task metadata/workpad for this repair

## Audit correction

An initial local audit falsely flagged root `trace:*` scripts because it incorrectly resolved root `scripts/operator/*` paths under `packages/workspace`. Correct resolution is:

- root `package.json` relative `scripts/*` => repo-root `scripts/*`
- `packages/workspace/package.json` relative `scripts/*` => `packages/workspace/scripts/*`

After correcting that resolution, the full script target audit checks 104 script targets and reports zero missing. The only real missing target was `packages/workspace/scripts/research-ingest.js`.

## Validation

- Corrected script target audit: 104 targets, 0 missing.
- `bun run research:ingest -- --help`: passed.
- `git diff --check`: passed.
