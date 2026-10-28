# Document OS skills and enforce docs review opportunities

branch: `task/os/document-os-skills-and-enforce-docs-review-opportunities`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1856/document-os-skills-and-enforce-docs-review-opportunities
github pr: https://github.com/consuelohq/opensaas/pull/1856
started: 2026-08-12

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/scripts/lib/review-documentation.js`
- `packages/workspace/tests/review-documentation-opportunity.test.js`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/review-documentation.js`
- `packages/workspace/tests/review-documentation-opportunity.test.js`

## workspace-owned: activity log

- 2026-08-12 00:07:12 fs.write: `.task/os/document-os-skills-and-enforce-docs-review-opportunities/workpad.md`
- 2026-08-12 00:09:43 fs.write: `.task/os/document-os-skills-and-enforce-docs-review-opportunities/workpad.md`
- 2026-08-12 00:10:40 fs.write: `packages/workspace/tests/review-documentation-opportunity.test.js`
- 2026-08-12 00:11:28 fs.write: `packages/workspace/scripts/lib/review-documentation.js`

## workspace-owned: validation evidence

- 2026-08-12 00:21:19 `review.run`: passed — OK
- 2026-08-12 00:23:45 `review.run`: passed — OK
- 2026-08-12 00:23:58 `verify`: passed — OK
- 2026-08-12 00:25:04 `verify`: passed — OK

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

- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/evidence/build-claims.md`
- `packages/documentation/evidence/reference-claims.md`
- `packages/documentation/package.json`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/content/docs/build/files-and-artifacts.mdx`
- `packages/documentation/src/content/docs/build/skills/create-a-skill.mdx`
- `packages/documentation/src/content/docs/build/skills/how-skills-work.mdx`
- `packages/documentation/src/content/docs/build/skills/install-a-skill.mdx`
- `packages/documentation/src/content/docs/build/skills/skill-structure.mdx`
- `packages/documentation/src/content/docs/build/tools/office.mdx`
- `packages/documentation/src/content/docs/build/workflows.mdx`
- `packages/documentation/src/content/docs/reference/cli.mdx`
- `packages/documentation/src/content/docs/reference/index.mdx`
- `packages/documentation/src/content/docs/reference/skills-and-manifests.mdx`
- `packages/documentation/src/content/docs/reference/tools.mdx`
- `packages/documentation/src/lib/docs-navigation.test.ts`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/lib/legacy-redirects.mjs`
- `packages/documentation/tests/build.test.ts`
- `packages/documentation/tests/reference.test.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/skill-selection.ts`
- `packages/os/skills/artifacts/skill.json`
- `packages/os/skills/branch/skill.json`
- `packages/os/skills/browser/skill.json`
- `packages/os/skills/debugger/skill.json`
- `packages/os/tests/facade/facade.test.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/review.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/review-run-state.test.js`

## discovery

- Current production docs path and navigation: pending repository read.
- Current review documentation-gap detection: pending repository read.
- Bundled skill inventory: pending repository read.
- Documentation-writer skill may be stale versus current Astro/Starlight docs; follow repository README/source of truth.


- 2026-08-12 00:07:12 append: `.task/os/document-os-skills-and-enforce-docs-review-opportunities/workpad.md`

## acceptance criteria

- [x] Public docs describe the current managed skill selection/storage model and the `consuelo add skill` / `consuelo remove skill` CLI.
- [x] Build with OS > Skills ends with a Bundled skills group containing one page for every current bundled OS skill, plus an overview.
- [x] Bundled-skill docs are source-backed by current `skill.json` / `SKILL.md`, concise, and navigable.
- [x] `review.run` detects high-confidence documentation opportunities from changed public product surfaces even when no TS/JS docs file is in its normal static-review set.
- [x] Documentation opportunities are non-blocking, include exact target docs and a documentation-writer suggested action, and disappear when mapped docs are changed.
- [x] Docs validation/build and workspace review/verify pass.

## plan

1. Add red documentation hierarchy/content tests and a pure review-documentation opportunity test.
2. Implement a small path-to-doc-impact helper and wire it into `review.run` summary/human output without changing blocking semantics.
3. Rewrite stale skill lifecycle + CLI reference pages and add Bundled skills overview + 11 skill pages at the bottom of the existing Skills nav group.
4. Update claim ledgers, validate Starlight docs, then run strict review + full verify and publish to `stream/os`.

## Test-first contract

- Behavior under test: current skill docs/navigation and non-blocking review documentation-impact detection.
- Existing patterns: `packages/documentation/tests/build.test.ts`, `reference.test.ts`, and pure CommonJS helpers under `packages/workspace/scripts/lib` with Vitest coverage.
- New/changed tests: Build/reference docs contracts plus `packages/workspace/tests/review-documentation-opportunity.test.js`.
- Focused RED: docs Build/reference tests and the new workspace review-documentation test before implementation.
- Expected RED: missing bundled skill pages/navigation, stale CLI/storage assertions, and missing review-documentation helper.

## key decisions

- Public docs source of truth is `packages/documentation` Astro/Starlight; the installed documentation-writer skill still references legacy Mintlify paths and is stale relative to repo truth.
- `review.run` currently has no documentation-impact rule and filters its normal changed-file set to JS/TS only. Documentation opportunity detection must use the full changed repo-file set separately from static code checks.
- Documentation opportunities will be non-blocking and high-confidence/targeted rather than a noisy requirement on every internal refactor.
- Existing custom skills under the legacy hidden `<CONSUELO_HOME>/skills` tree are preserved as `legacyCustom` for explicit migration; current managed bundled skills are materialized under `~/Consuelo/Skills`.


- 2026-08-12 00:09:43 append: `.task/os/document-os-skills-and-enforce-docs-review-opportunities/workpad.md`

- 2026-08-12 00:10:40 write: `packages/workspace/tests/review-documentation-opportunity.test.js`

- 2026-08-12 00:11:28 write: `packages/workspace/scripts/lib/review-documentation.js`

## contract correction

- The original Build regression still asserted the removed `app-visible` cloud-artifact wording. Current source uses the Artifacts/Sites delivery adapter, so the test now protects the current `Sites` publishing boundary instead.
- The bundled overview page is not itself a registry skill; the exact registry/page test excludes only `bundled/index.mdx` and still requires one page per actual skill.


## issues and recovery

- Astro build caught unquoted YAML punctuation in the generated Research Ingest description. Fixed all bundled-skill `description` frontmatter values with safe JSON/YAML quoting rather than patching only one page.

## current status

- Implementation complete and publish-valid.
- Bundled Skills docs now cover all 11 registry skills in a final nested navigation group.
- Skill lifecycle, CLI, Artifacts, workflow, and stale evidence-path docs were reconciled to current repository truth.
- `review.run` now computes non-blocking documentation opportunities from the full changed-file set and both facade compactors preserve them for agent-facing JSON.

## validation evidence

- RED: documentation contract failed on missing bundled pages/navigation and stale CLI/storage semantics.
- RED: review documentation-opportunity test failed because the helper did not exist.
- GREEN: `packages/documentation` Build + Reference contracts: 17/17 tests, 699 assertions.
- GREEN: review documentation-opportunity helper: 4/4 tests, 7 assertions.
- RED→GREEN: workspace + OS facade compaction regression: 2 focused tests, 17 assertions; before fix the docs count/check disappeared, after fix both preserve it.
- GREEN: `bun run validate` in `packages/documentation` selected 121 pages successfully.
- GREEN: full Astro/Starlight `bun run build`; Pagefind indexed 124 HTML files and all 11 bundled skill pages rendered.
- GREEN: `git diff --check`.
- GREEN: strict `review.run --mine --no-tests` returned 0 owned/blocking findings.
- GREEN: full `verify --base origin/stream/os` returned `passed: true`, `publishValid: true`; nested review reports `documentation_opportunities` in `checksRun` and 0 outstanding opportunities.

## implementation notes

- The task worktree initially symlinked `packages/documentation/node_modules` to the main checkout. Astro/Vite produced a mixed-realpath compilation failure, so dependencies were materialized locally in the disposable worktree with internal symlinks preserved before the real build. No tracked dependency files changed.
- Once the real build ran, it caught two genuine MDX issues (unquoted YAML punctuation and a raw `<area>` placeholder); both were fixed and the final build passed.
- Existing docs had substantive drift beyond Skills: the active manifest has `artifacts.*` rather than `office.*`, and `packages/workspace/tooling/workflows.json` currently registers only the task workflow. The docs now reflect that, and historical Office URLs redirect to Artifacts.
- The installed documentation-writer ChatGPT skill still describes legacy Mintlify/twenty-docs paths. That skill is outside this repo task. `review.run` therefore explicitly tells agents to invoke the documentation-writer workflow while treating `packages/documentation/README.md` and `AUTHORING.md` (Astro/Starlight) as repository truth.
