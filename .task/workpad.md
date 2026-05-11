# add Consuelo OS documentation scaffold

branch: `task/os/add-consuelo-os-documentation-scaffold`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/363
started: 2026-05-11

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

## OS docs scaffold pass

- Added OS top-level docs tab between User Guide and Developers in `packages/consuelo-docs/navigation/base-structure.json`.
- Regenerated `packages/consuelo-docs/docs.json` using `bun ./scripts/generate-docs-json.ts`.
- Added first-pass structured OS docs under `packages/consuelo-docs/os`.
- Scope is alignment docs, not polished marketing copy.
- Existing User Guide and Developers docs were left intact.

Validation:
- JSON parse passed for `base-structure.json` and `docs.json`.
- `bun run lint` passed.
- `bun run build` is not supported by current Mintlify CLI command list and exits with unknown command.
- `bunx mintlify validate` currently fails on pre-existing docs/Mintlify issues outside the new OS pages, including existing Arabic/localized MDX parse errors and existing user-guide/graphql/dialer parse errors.
