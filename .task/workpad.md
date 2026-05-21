# Rename OS docs terminology to skills

branch: `task/os/rename-os-docs-terminology-to-skills`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/412/rename-os-docs-terminology-to-skills
github pr: https://github.com/consuelohq/opensaas/pull/412
started: 2026-05-21

## acceptance criteria

- [x] Rename user-facing OS docs from runbooks to skills.
- [x] Rename top-level docs paths/navigation from `os/runbooks` to `os/skills`.
- [x] Rename OS portal docs paths/navigation from `agent-interface` to `portal`.
- [x] Remove user-facing MCP terminology from OS docs touched by this pass.
- [x] Keep runtime behavior intact.

## implementation plan

1. Start a clean task branch from `stream/os`.
2. Rename docs directories/files and update `packages/consuelo-docs/docs.json` references.
3. Update package-level OS steering/docs and runtime file lists from `runbooks.md` to `skills.md`.
4. Rename small runtime type/error labels from `Runbook*`/`RUNBOOK_*` to `Skill*`/`SKILL_*`.
5. Validate docs JSON, nav paths, Python syntax, and OS smoke calls.

## files changed

- `packages/consuelo-docs/os/runbooks/*` -> `packages/consuelo-docs/os/skills/*`
- `packages/consuelo-docs/os/agent-interface/*` -> `packages/consuelo-docs/os/portal/*`
- `packages/consuelo-docs/os/workspace-filesystem/runbook-outputs.mdx` -> `skill-outputs.mdx`
- `packages/consuelo-docs/os/runtime/scheduled-runbooks.mdx` -> `scheduled-skills.mdx`
- `packages/consuelo-docs/os/runtime/package-scripts-vs-mcp-tools.mdx` -> `package-scripts-vs-os-portal.mdx`
- `packages/os/runbooks.md` -> `packages/os/skills.md`
- `packages/os/docs/runbooks.md` -> `packages/os/docs/skills.md`
- Updated OS docs/navigation/steering text to use skills and portal wording.
- Updated small runtime type names and error codes to `Skill*`/`SKILL_*`.

## key decisions

- Use `skill` as the product/docs name for packaged OS capabilities.
- Use `script` for executable implementation behind a skill.
- Use `portal` for the public OS entrypoint concept.
- Keep low-level transport details out of user-facing OS docs.

## notes for Ko

- This PR intentionally does not delete the existing `pilot` docs section; it only updates terminology inside it where needed. The no-pilot docs cleanup should be its own focused docs pass.
- The runtime still uses `tool-manifest.json`; this pass changes the docs language to skill/capability language without renaming the manifest file.
- PR #411 was an earlier bootstrap attempt from `main`. Do not use it. PR #412 is the clean stream-based PR.

## improvements noticed

- The docs still need a deeper copy pass to replace scaffold/V1 language with the locked product language.
- A future cleanup can decide whether `tool-manifest.json` should become `skill-manifest.json`; this patch does not rename it.

## errors or blockers

- The first task bootstrap started from `main`, so I restarted cleanly with `startFrom: stream` and created PR #412.

## validation commands and results

- `python3 -m json.tool packages/consuelo-docs/docs.json >/dev/null`: passed.
- English OS nav path check against `packages/consuelo-docs/docs.json`: 49 paths, all exist.
- Public docs grep for `runbook`, `Runbook`, `RUNBOOK`: no matches in OS docs/package docs searched.
- Public docs grep for `MCP`, `mcp`, `agent-interface`, `Agent Interface`: no matches in OS docs/package docs searched.
- `git diff --check`: passed.
- `python3 -m py_compile packages/os/server.py`: passed.
- `cd packages/os && bun run smoke:steering`: passed; steering loads `skills.md` and uses OS portal/skills wording.
- `cd packages/os && bun run smoke:daily-revenue-brief`: passed; returned structured `ok: true` scaffold output with `graphqlStatus: missing_env`.
