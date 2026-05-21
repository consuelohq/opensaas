# add local install wizard and cli front door

branch: `task/os/add-local-install-wizard-and-cli-front-door`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/443/add-local-install-wizard-and-cli-front-door
github pr: https://github.com/consuelohq/opensaas/pull/443
started: 2026-05-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-21 20:39:11 write: `packages/os/scripts/lib/cli-ui.ts`
- 2026-05-21 20:40:15 write: `packages/os/scripts/lib/install-state.ts`
- 2026-05-21 20:40:41 write: `packages/os/scripts/install.ts`
- 2026-05-21 20:40:52 write: `packages/os/scripts/doctor.ts`
- 2026-05-21 20:41:11 write: `packages/os/package.json`
- 2026-05-21 20:41:18 write: `packages/os/skills/daily-revenue-brief/skill.json`
- 2026-05-21 20:41:29 write: `packages/os/scripts/lib/skills.ts`
- 2026-05-21 20:42:07 write: `packages/os/setup.sh`
- 2026-05-21 20:42:22 write: `packages/cli/src/commands/os.ts`
- 2026-05-21 20:42:51 write: `packages/os/tests/install-state.test.ts`
- 2026-05-21 20:43:08 append: `packages/os/SCRIPTS.md`
- 2026-05-21 20:44:36 write: `packages/cli/src/commands/os.ts`
- 2026-05-21 20:46:55 patch lines 270-270: `packages/os/scripts/lib/install-state.ts`