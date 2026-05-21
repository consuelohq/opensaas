# Remove misplaced OS v1 and pilot docs

branch: `task/os/remove-misplaced-os-v1-package-doc`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/415/remove-misplaced-os-v1-package-doc
github pr: https://github.com/consuelohq/opensaas/pull/415
started: 2026-05-21

## acceptance criteria

- [x] Remove `packages/os/docs/consuelo-os-v1.md` because package-local docs are not the product docs home.
- [x] Remove `packages/consuelo-docs/os/pilot/*` because OS docs should not have pilot framing.
- [x] Remove pilot nav entries from `packages/consuelo-docs/docs.json`.
- [x] Remove remaining pilot wording from the OS package docs touched here.
- [x] Keep docs navigation valid.

## implementation plan

1. Start a task from `stream/os`.
2. Delete the misplaced package-local V1 doc.
3. Delete the public OS pilot docs folder.
4. Prune Pilot nav groups and paths from docs navigation.
5. Clean the package env matrix so it no longer has a pilot column or pilot-dependent statuses.
6. Validate docs JSON, nav paths, grep checks, and whitespace.

## files changed

- Deleted `packages/os/docs/consuelo-os-v1.md`.
- Deleted `packages/consuelo-docs/os/pilot/demo-flow.mdx`.
- Deleted `packages/consuelo-docs/os/pilot/insurance-revenue-workspace.mdx`.
- Deleted `packages/consuelo-docs/os/pilot/setup-checklist.mdx`.
- Deleted `packages/consuelo-docs/os/pilot/success-criteria.mdx`.
- Updated `packages/consuelo-docs/docs.json` to remove Pilot groups and `os/pilot/*` paths.
- Updated `packages/os/docs/env-capability-matrix.md` to remove the pilot column and pilot statuses.

## key decisions

- Product docs should live under `packages/consuelo-docs/os`, not package-local `packages/os/docs/consuelo-os-v1.md`.
- OS docs should not frame the product around pilots.
- This cleanup removes confusing docs surfaces without replacing them with new product docs yet.

## validation commands and results

- `python3 -m json.tool packages/consuelo-docs/docs.json >/dev/null`: passed.
- English OS nav path check: 45 paths, all exist.
- Grep for `consuelo-os-v1`, `os/pilot`, `pilot/`, `Pilot`, `pilot`: no matches in searched OS docs/package docs/nav.
- `git diff --check`: passed.
- `workspace verify --base origin/stream/os --no-db`: timed out twice after targeted validation passed.
