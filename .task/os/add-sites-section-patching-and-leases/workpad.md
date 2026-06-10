# add sites section patching and leases

branch: `task/os/add-sites-section-patching-and-leases`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/865/add-sites-section-patching-and-leases
github pr: https://github.com/consuelohq/opensaas/pull/865
started: 2026-06-09

## acceptance criteria

- [x] Build on current `stream/os` PR1/PR2 Sites work, not stale branches.
- [x] Add section-level `sites patch` for existing Sites pages.
- [x] Require `--base-version` for patches, reject same-section stale patches, and auto-rebase non-overlapping section patches.
- [x] Add section leases with acquire/status/release and TTL enforcement.
- [x] Re-render typed `spec|plan|guide` pages through the canonical reader shell before patch publish.
- [x] Update Sites docs/skill/data model.
- [x] Add focused CLI tests.

## plan

1. Read PR1/PR2 Sites registry/render code.
2. Add failing test for patching and leases.
3. Implement lease registry and patch preparation in `sites.ts`.
4. Add `sites patch` and `sites lease` CLI subcommands.
5. Update docs and run focused validation.

## current status

- Implemented PR3 patching + leases on top of current `stream/os`.
- Focused tests and syntax checks are passing.
- Ready for review/verify/push.

## files changed

- `packages/os/data-model.md`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/tests/sites-cli.test.ts`

## workspace-owned: files changed

- `packages/os/data-model.md`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/tests/sites-cli.test.ts`

## workspace-owned: activity log

- 2026-06-09 07:41:29 fs.write: `.task/os/add-sites-section-patching-and-leases/workpad.md`
- 2026-06-09: added `sites patch` and `sites lease acquire|status|release` in `os.ts`.
- 2026-06-09: added red test covering section patching, non-overlap auto-rebase, same-section conflict, and leases.
- 2026-06-09: implemented lease registry and patch preparation in `sites.ts`.
- 2026-06-09: read PR1/PR2 Sites code and current OS Sites docs.
- 2026-06-09: updated scripts, skill, and data model docs.

## workspace-owned: validation evidence

- Red test failed before implementation: new PR3 test returned `ok:false` for `sites patch`.
- Green test passed: `bun --cwd packages/os test tests/sites-cli.test.ts` — 4 tests passed.
- Syntax passed: `node --check packages/os/scripts/lib/sites.ts`.
- Syntax passed: `node --check packages/os/scripts/os.ts`.
- `checkFiles` passed for touched TS/test files.
- 2026-06-09 07:42:11 `review.run`: passed — OK
- 2026-06-09 07:42:30 `verify`: passed — OK

## key decisions

- `sites patch` edits `content.json` from the current version source, re-renders typed reader pages, then publishes through the existing Sites page registry.
- Non-overlapping stale section patches auto-rebase onto the current page version.
- Same-section stale patches reject with `SECTION_CONFLICT`.
- Active leases are scoped to `pageId#sectionId`, enforced by default, and can be released or explicitly overridden with `--force-publish`.

## notes for ko

- This is PR3 only. It does not pull in unrelated restore work.
- `trace-burn-intelligence` remains the intended playground path, but this PR adds the generic mechanism first through tests.

## improvements noticed

- The current PR1/PR2 Sites structure made this clean: page versions already track `changedSectionIds`, so PR3 could layer merge checks on top.

## issues and recovery

- `code.run` is still broken in this workspace, so file edits used task-scoped `fs`/`task.call` instead.
- A line-number patch briefly inserted helpers in the wrong place; recovered by resetting `sites.ts` from `origin/stream/os` and applying string-based replacements.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add sites section patching and leases" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/data-model.md`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/tests/sites-cli.test.ts`

- 2026-06-09 07:41:29 write: `.task/os/add-sites-section-patching-and-leases/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/add-sites-section-patching-and-leases/current.json`, `.task/os/add-sites-section-patching-and-leases/evidence-log.json`, `.task/os/add-sites-section-patching-and-leases/read-log.json`, `.task/os/add-sites-section-patching-and-leases/session.json`, `.task/os/add-sites-section-patching-and-leases/workpad.md`, `.task/tasks/os/add-sites-section-patching-and-leases.json`, `packages/os/SCRIPTS.md`, `packages/os/data-model.md`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/os.ts`, `packages/os/skills/sites/SKILL.md`, `packages/os/tests/sites-cli.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
