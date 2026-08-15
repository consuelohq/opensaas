# refine skill templates docs and copy feedback

branch: `task/os/refine-skill-templates-docs-and-copy-feedback`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1866/refine-skill-templates-docs-and-copy-feedback
github pr: https://github.com/consuelohq/opensaas/pull/1866
started: 2026-08-12

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/documentation/scripts/generate-skill-template-docs.mjs`

## workspace-owned: files changed

- `packages/documentation/scripts/generate-skill-template-docs.mjs`

## workspace-owned: activity log

- 2026-08-12 01:37:37 fs.write: `.task/os/refine-skill-templates-docs-and-copy-feedback/workpad.md`
- 2026-08-12 01:40:28 fs.write: `.task/os/refine-skill-templates-docs-and-copy-feedback/workpad.md`
- 2026-08-12 01:42:33 fs.write: `packages/documentation/scripts/generate-skill-template-docs.mjs`
- 2026-08-12 01:49:03 fs.write: `.task/os/refine-skill-templates-docs-and-copy-feedback/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 01:49:28 `review.run`: passed — OK
- 2026-08-12 01:49:40 `verify`: passed — OK
- 2026-08-12 01:49:55 `verify`: passed — OK

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

- `.gitattributes`
- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/package.json`
- `packages/documentation/scripts/test-build-browser.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/content/docs/build/skills/bundled/branch.mdx`
- `packages/documentation/src/content/docs/build/skills/bundled/browser.mdx`
- `packages/documentation/src/content/docs/build/skills/bundled/research-ingest.mdx`
- `packages/documentation/src/content/docs/build/skills/bundled/task.mdx`
- `packages/documentation/src/content/docs/build/skills/install-a-skill.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/tests/build.test.ts`
- `packages/documentation/tests/foundation.test.ts`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/skills/branch/SKILL.md`
- `packages/os/skills/branch/skill.json`
- `packages/os/skills/browser/SKILL.md`
- `packages/os/skills/research-ingest/SKILL.md`
- `packages/os/skills/skills.json`
- `packages/os/skills/task/SKILL.md`
- `packages/os/skills/task/skill.json`
- `packages/os/tests/skills-registry.test.ts`

## acceptance criteria

- [x] Rename the public bundled-skill docs surface to **Skill Templates**; preserve old bundled routes with redirects if the canonical route changes.
- [x] Each skill-template page starts with the enable/remove commands, then shows the exact `skill.json` description, then the exact `SKILL.md` source word-for-word with no editorial `When to use`, `What the agent loads`, `Boundary`, or `Verify` sections.
- [x] Public skill names use `Branch` and `Task`, not `Branch Planner` or `Task Workflow`.
- [x] Skill-template docs are mechanically/provably tied to the real skill source so documentation drift is caught by tests.
- [x] The Copy page button shows successful feedback by briefly turning green and swapping its icon to a check, then restores its normal state; failure does not show success styling.
- [x] Refresh the documentation-writer guidance to the current `packages/documentation` Astro/Starlight workflow through a repository-owned skill surface if the source is available in-repo; do not preserve obsolete Mintlify/`packages/twenty-docs` instructions.
- [x] Focused docs/UI/skill tests, docs validation/build, strict review, and full verify pass before publishing to `stream/os`.

## plan

1. Lock the desired Skill Templates content/navigation and copy-success interaction in red tests.
2. Implement a deterministic skill-template docs generator or equivalent source-backed mechanism, update Branch/Task public metadata where needed, and preserve legacy routes.
3. Add transient copy success state in `PageTitle.astro` and prove it in browser regression coverage.
4. Update current documentation-writer skill guidance if a repository-owned source exists; otherwise record the external-skill boundary explicitly rather than inventing a hidden source.
5. Validate docs, inspect the diff, run strict review/full verify, and publish to `stream/os`.

## Test-first contract

- Behavior under test: Skill Templates navigation and pages mirror current skill metadata/source exactly; Copy page gives visible green/check success feedback and resets; Branch/Task public names are canonical.
- Existing patterns: `packages/documentation/tests/build.test.ts`, `tests/foundation.test.ts`, `scripts/test-foundation-browser.mjs`, `packages/os/tests/skills-registry.test.ts`.
- New/changed tests: Build docs contract checks `Skill Templates`, exact page descriptions, and exact `SKILL.md` preview; foundation source/browser tests check success-state class/icon/reset; skill registry test checks Branch/Task titles if metadata changes.
- Focused RED: run only the touched docs/skill tests after preflighting them for destructive literals.
- Expected RED: current nav says Bundled skills; pages contain editorial sections and do not include exact SKILL.md; Branch/Task titles are old; Copy page has no copied visual state.

## discovery

- Public docs source is `packages/documentation` Astro/Starlight; `README.md` and `AUTHORING.md` are current authority.
- Current skill pages are hand-authored summaries and repeat sections the user explicitly does not want.
- `PageTitle.astro` owns Copy page and currently only emits hidden `Page copied` live-region text; it has no success class or icon swap.
- Repository search found no source copy of the platform `documentation-writer` skill; only review hints reference its name. Need distinguish repo-owned skill work from external prefetched skill packaging.

- 2026-08-12 01:37:37 append: `.task/os/refine-skill-templates-docs-and-copy-feedback/workpad.md`

## issues and recovery

- 2026-08-12 01:39 UTC: primary OS facade and legacy fallback returned transport errors during read-only discovery. Recovery used a bounded 15-second wait, then immediately retried `fs.read` on `packages/os/skills/skills.json`; the read succeeded. No mutation was replayed during the outage.

- 2026-08-12 01:40:28 append: `.task/os/refine-skill-templates-docs-and-copy-feedback/workpad.md`

- 2026-08-12 01:42:33 write: `packages/documentation/scripts/generate-skill-template-docs.mjs`

## implementation notes

- Kept canonical URLs under `/build/skills/bundled/` for link stability; only the public label/title is now **Skill Templates**.
- Skill Template pages are generated by `packages/documentation/scripts/generate-skill-template-docs.mjs` from `packages/os/skills/skills.json` and each skill's authoritative `SKILL.md`.
- Per-skill page body is intentionally limited to: Enable it, remove command, exact Description, exact `SKILL.md` preview. The exact source is fenced with a delimiter longer than any backtick run in the source.
- `Branch Planner` → `Branch` and `Task Workflow` → `Task` were corrected in authoritative metadata; Branch's OpenAI display metadata was corrected too.
- Cleaned seven semantically meaningless trailing spaces in `packages/os/skills/senior-engineer/SKILL.md` so exact generated previews retain normal repository whitespace guarantees.
- Copy-page success is a 1.6s state on the split control: green background/border, chevron hidden, check icon shown, then reset. Copy failure clears success state.
- The prefetched `documentation-writer` skill available to this agent is external/read-only and still describes the legacy Mintlify tree. No repository-owned source for that skill exists in this checkout. The current repo-owned authority is now explicit in `packages/documentation/README.md` and `AUTHORING.md`; do not invent a hidden source or duplicate OS skill under the same name.

## validation evidence

- RED: documentation/foundation tests failed on missing Skill Templates label, old editorial pages, and missing copy state; skills registry failed on Branch Planner title.
- GREEN: `bun test tests/build.test.ts tests/foundation.test.ts` → 21 pass / 0 fail / 1002 assertions.
- GREEN: `bunx vitest run tests/skills-registry.test.ts` → 9 pass / 0 fail.
- GREEN: `bun scripts/test-foundation-browser.mjs` → copy Markdown + green/check/reset + responsive checks pass.
- GREEN: `bun run validate` → 121 selected pages valid.
- GREEN: `bun run build` → Astro/Starlight build complete; 124 HTML files indexed.
- GREEN: `bun scripts/test-build-browser.mjs` → 18 routes, 5 Build groups, tablet/mobile overflow 0.
- GREEN: `git diff --check` passes after cleaning authoritative Senior Engineer trailing whitespace and regenerating.

- 2026-08-12 01:49:03 append: `.task/os/refine-skill-templates-docs-and-copy-feedback/workpad.md`
