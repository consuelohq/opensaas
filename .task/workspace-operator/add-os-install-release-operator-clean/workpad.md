# add os install release operator clean

branch: `task/workspace-operator/add-os-install-release-operator-clean`
stream: `stream/workspace-operator`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/709/add-os-install-release-operator-clean
github pr: https://github.com/consuelohq/opensaas/pull/709
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
bun run task:push -- --message "type(workspace-operator): description" --changed
bun run task:pr
bun run task:finish
```

## Clean restart note

This task was restarted cleanly after closing messy PR #708.

Reason: the earlier release operator work was created in a manual worktree while workspace task tooling was broken, then promoted through `stream/os`, which produced a broad stream PR and incomplete task metadata. This clean task starts from a dedicated stream branch based on current `main` and carries only the private operator release script work.

## Files intentionally carried forward

- `package.json` — root `os:release-install` alias.
- `packages/workspace/package.json` — workspace package `os:release-install` alias.
- `packages/workspace/SCRIPTS.md` — operator release documentation.
- `packages/workspace/scripts/os-release-install.ts` — Cloudflare Worker release script for the public installer.

## Ownership decision

The release script stays under `packages/workspace/scripts` because it is Ko/operator-only release automation. The public install source remains `packages/os/scripts/bootstrap.sh`.
