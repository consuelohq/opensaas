# bootstrap missing launchd service during runtime activation

branch: `task/os/bootstrap-missing-launchd-service-during-runtime-activation`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1917/bootstrap-missing-launchd-service-during-runtime-activation
github pr: https://github.com/consuelohq/opensaas/pull/1917
started: 2026-08-13

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Live activation failure — 2026-08-13

- 0.1.35 verified, staged, and ran both HA migrations, then activation hit a launchd race: com.consuelo.system disappeared between the adapter's loaded check and kickstart. The lifecycle engine automatically restored 0.1.34 and accepted its health.
- Added a focused red test that makes the loaded label disappear exactly once at kickstart.
- Fix bootstraps the already-installed plist and retries only when launchctl reports Could not find service; other launchctl failures remain fatal.
- Validation: 17 focused lifecycle tests pass, package syntax/typecheck passes, strict review reports zero blockers.
