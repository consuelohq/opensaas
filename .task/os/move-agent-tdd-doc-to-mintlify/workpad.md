# move-agent-tdd-doc-to-mintlify

branch: `task/os/move-agent-tdd-doc-to-mintlify`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/860/move-agent-tdd-doc-to-mintlify
github pr: https://github.com/consuelohq/opensaas/pull/860
started: 2026-06-09

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-docs/navigation/base-structure.json`
- `packages/consuelo-docs/os/agent-context/test-driven-agent-work.mdx`
- `packages/os/docs/test-driven-agent-work.md` (deleted)
- `packages/os/tests/docs-agent-tdd.test.js` (deleted)

## workspace-owned: files changed

- `packages/consuelo-docs/navigation/base-structure.json`
- `packages/consuelo-docs/os/agent-context/test-driven-agent-work.mdx`
- `packages/os/docs/test-driven-agent-work.md` (deleted)
- `packages/os/tests/docs-agent-tdd.test.js` (deleted)

## workspace-owned: activity log

- 2026-06-09 04:34:48 fs.write: `packages/consuelo-docs/os/agent-context/test-driven-agent-work.mdx`
- 2026-06-09 04:35:46 fs.patch: `packages/consuelo-docs/navigation/base-structure.json`
- 2026-06-09 04:38:26 fs.trash: `packages/os/docs/test-driven-agent-work.md`
- 2026-06-09 04:38:34 fs.trash: `packages/os/tests/docs-agent-tdd.test.js`
- 2026-06-09 04:46:31 fs.write: `.task/os/move-agent-tdd-doc-to-mintlify/workpad.md`
- 2026-06-09 04:47:37 fs.write: `.task/os/move-agent-tdd-doc-to-mintlify/workpad.md`

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

## workspace-owned: files read

- `packages/consuelo-docs/navigation/base-structure.json`
- `packages/consuelo-docs/navigation/navigation.template.json`
- `packages/consuelo-docs/navigation/supported-languages.ts`
- `packages/consuelo-docs/scripts/generate-docs-json.ts`
- `packages/consuelo-docs/scripts/generate-documentation-paths.ts`
- `packages/consuelo-docs/scripts/validate-os-docs.ts`
- `packages/os/README.md`
- `packages/os/docs/test-driven-agent-work.md`
- `packages/twenty-shared/src/constants/DocumentationPaths.ts`

## final correction

- Moved the doc to `packages/consuelo-docs/os/agent-context/test-driven-agent-work.mdx` so it is a user-facing Mintlify page.
- Added localized fallback pages under `packages/consuelo-docs/l/*/os/agent-context/test-driven-agent-work.mdx`.
- Added `os/agent-context/test-driven-agent-work` to `packages/consuelo-docs/navigation/base-structure.json` and regenerated `docs.json`.
- Regenerated `packages/twenty-shared/src/constants/DocumentationPaths.ts`.
- Deleted the misplaced `packages/os/docs/test-driven-agent-work.md` and `packages/os/tests/docs-agent-tdd.test.js`.
- Removed the old `packages/os/README.md` link.
- Moved assertions into `packages/consuelo-docs/scripts/validate-os-docs.ts`.

## final validation

- `bun packages/consuelo-docs/scripts/generate-docs-json.ts` passed.
- `bun packages/consuelo-docs/scripts/generate-documentation-paths.ts` passed.
- `bun packages/consuelo-docs/scripts/validate-os-docs.ts` passed.
- `git diff --check` passed.
- Route search confirmed `os/agent-context/test-driven-agent-work` in `base-structure.json` and generated `docs.json`.
- Package search confirmed no remaining `docs/test-driven-agent-work.md` references.

## yellow

- `bun run --cwd packages/consuelo-docs build` fails inside the Mintlify CLI with `Cannot read properties of null (reading 'useState')` from `@mintlify/previewing`. OS docs validation passes, so this appears to be a Mintlify CLI/runtime issue rather than a route/content failure.

- 2026-06-09 04:46:31 append: `.task/os/move-agent-tdd-doc-to-mintlify/workpad.md`

## review update

- `bun run review` reports `YOUR CHANGES: ✓ clean`.
- Review exits non-zero because of a pre-existing stream typecheck failure in `scripts/generateBarrels.ts` (`visit` implicit return type). This task did not introduce that failure.

- 2026-06-09 04:47:37 append: `.task/os/move-agent-tdd-doc-to-mintlify/workpad.md`
