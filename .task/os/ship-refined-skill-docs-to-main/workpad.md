# Ship refined skill docs to main

branch: `task/os/ship-refined-skill-docs-to-main`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1878/ship-refined-skill-docs-to-main
github pr: https://github.com/consuelohq/opensaas/pull/1878
started: 2026-08-12

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

- 2026-08-12 03:56:20 fs.write: `.task/os/ship-refined-skill-docs-to-main/workpad.md`
- 2026-08-12 03:57:37 fs.write: `.task/os/ship-refined-skill-docs-to-main/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 03:57:16 `review.run`: passed — OK
- 2026-08-12 03:57:28 `verify`: passed — OK
- 2026-08-12 03:58:03 `verify`: passed — OK

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

## discovery

- User asked to ship the docs work already merged in task PR #1866 to main, but the parent stream PR #1867 is blocked by a repeatable `Consuelo OS / native windows` acceptance failure. The failed job was rerun once and failed again at `Run native Windows platform acceptance`.
- PR #1866 contains two commits: an empty bootstrap commit `ef7d84e...` and the actual change commit `539c929...` (`feat(os): refine skill templates and copy feedback`). The change touches 40 files across documentation generation/content/tests plus a small set of OS skill registry/skill metadata files.
- Safe plan: transplant only commit `539c929245db9ef580f746a30006f87ae393bc46` onto this branch created directly from current `main`, validate the resulting docs + OS skill contracts, then merge this dedicated PR to main. Do not bypass or merge blocked stream/os PR #1867.

## Test-first contract

- No-test waiver for a new red test: this task is a transplant of an already-authored commit, not a new behavior implementation. Creating a deliberately failing test would not add signal and could change the patch being shipped.
- Acceptance evidence instead: the cherry-pick must apply without manual semantic edits; run focused documentation validation/tests and OS skill registry tests, then strict review/full verify. If the cherry-pick conflicts with the docs shell work just merged via #1874, resolve minimally and rerun the affected browser/source contracts.

- 2026-08-12 03:56:20 append: `.task/os/ship-refined-skill-docs-to-main/workpad.md`

## validation evidence

- Cherry-pick of `539c929245db9ef580f746a30006f87ae393bc46` onto current main applied cleanly with only automatic merges in docs tests/navigation; no manual conflict resolution or semantic edits were required.
- `bun run --cwd packages/documentation validate`: pass (121 selected pages).
- `bun run --cwd packages/documentation test:foundation`: 13/13 pass, 370 expectations.
- `bun run --cwd packages/documentation test:build`: 9/9 pass, 677 expectations.
- Initial root-cwd invocation of the OS registry test failed only because that test resolves `skills/skills.json` from package cwd; rerun from `packages/os` passed 9/9 with 20 expectations.
- Strict review vs `origin/main`: 0 owned issues, 0 blockers (`trc_3d5026d32903`).
- Full verify vs `origin/main`: passed, `publishValid: true`, 0 DB risks, 0 documentation opportunities (`trc_c9ec70443048`).

- 2026-08-12 03:57:37 append: `.task/os/ship-refined-skill-docs-to-main/workpad.md`
