# add typed reader rendering to os sites clean

branch: `task/os/add-typed-reader-rendering-to-os-sites-clean`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/864/add-typed-reader-rendering-to-os-sites-clean
github pr: https://github.com/consuelohq/opensaas/pull/864
started: 2026-06-09

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

- 2026-06-09 06:43:27 `review.run`: passed — OK
- 2026-06-09 06:43:42 `verify`: passed — OK

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

# PR 2: typed reader rendering in OS Sites

## Scope

- Started clean from stream/os after PR 1 landed.
- Adds Sites support for rendering typed spec|plan|guide pages through the canonical Consuelo reader shell.
- Does not include unrelated restore/diff-cockpit/main cleanup.

## Implementation

- Added `sites render --template <spec|plan|guide> --input <content.json> --out <index.html>`.
- Delegates to root `wiki:render` so OS Sites does not fork or duplicate reader-shell rendering.
- Keeps `sites publish` as the versioned/stale-guarded publish step from PR 1.
- Updated Sites skill and SCRIPTS docs.

## Validation

- `cd packages/os && bun test tests/sites-cli.test.ts` passed: 3 tests, 54 assertions.
- `check-files` passed for `packages/os/scripts/os.ts` and `packages/os/tests/sites-cli.test.ts`.

## workspace-owned: test selection

- changed files: `.task/os/add-typed-reader-rendering-to-os-sites-clean/current.json`, `.task/os/add-typed-reader-rendering-to-os-sites-clean/session.json`, `.task/os/add-typed-reader-rendering-to-os-sites-clean/workpad.md`, `.task/tasks/os/add-typed-reader-rendering-to-os-sites-clean.json`, `packages/os/SCRIPTS.md`, `packages/os/scripts/os.ts`, `packages/os/skills/sites/SKILL.md`, `packages/os/tests/sites-cli.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
