
## acceptance criteria

- [ ] Change only `packages/documentation/**` plus workspace-owned task metadata.
- [ ] Start from the latest `stream/documentation` state, including the merged Start and Connect work.
- [ ] Write and verify the complete Build with OS area: Overview; Tools (How tools work, Workspace, Browser, Office, Media); Skills (How skills work, Install a skill, Create a skill, Skill structure); Steering (How steering works, Workspace steering, Project steering); Workflows; Shared memory and context; Files and artifacts; Approvals.
- [ ] Verify every material claim against current source, tests, generated manifests/configuration, and real runtime behavior where practical; archived reports are directional only.
- [ ] Explain the distinctions between tools, skills, scripts, workflows, steering, context, memory, files, artifacts, and approvals in user language.
- [ ] Use the canonical product term `scripts`; do not revive `runbooks` except when mapping legacy terminology.
- [ ] Add a Build with OS claim/evidence ledger with current code/test/runtime evidence.
- [ ] Delete directly superseded legacy OS/tool/skill/steering/workflow/context/artifact/approval pages only after replacements exist; add redirects and update surviving links.
- [ ] Expand the Build with OS section-local navigation in the approved order and add focused contract/browser regression coverage.
- [ ] Run relevant OS, tool, skill, steering, workflow, artifact, approval, documentation, build, search, browser, review, package-boundary, and full workspace verification gates.
- [ ] Push the task branch, merge it into `stream/documentation`, refresh the stream PR, verify the merged stream, then finish and clean up the task.

## test-first contract

1. Inventory the current Build with OS scaffold, legacy pages, tool facade and manifests, skill runtime and manifests, steering precedence, workflows/workpads, context and memory, files and artifacts, and approval enforcement.
2. Add focused failing documentation contract tests for the required route set, navigation order, evidence ledger, page contracts, terminology, and removal of placeholder or speculative copy.
3. Record the red result before substantive documentation edits.
4. Write only claims supported by source, focused tests, generated output, and runtime checks.
5. Run focused implementation tests plus the full documentation and workspace release gates before publish.

## discovery

- Direct repository exploration and structured source/test scans are in progress.
- Task bootstrap selected `main`; verify and correct the branch base to the latest `origin/stream/documentation` before production edits.

## current status

- Task started. Discovery and branch-base correction are in progress.

## red test evidence

- Red: `bun test tests/build.test.ts` — 0 passed, 7 failed before implementation.
- Failures prove the Build navigation, 16 missing detail pages, evidence metadata, claim ledger, verified support-boundary copy, and legacy-page replacement are not implemented yet.

## workspace-owned: validation evidence

- 2026-07-13 17:02:52 `review.run`: passed — OK
- 2026-07-13 17:02:52 `review.run`: passed — OK
- 2026-07-13 17:02:53 `review.run`: passed — OK
- 2026-07-13 17:02:53 `review.run`: passed — OK
- 2026-07-13 17:02:53 `review.run`: passed — OK
- 2026-07-13 17:02:53 `review.run`: passed — OK
- 2026-07-13 17:05:16 `verify`: passed — OK
- 2026-07-13 17:07:17 `verify`: passed — OK

## implementation complete

- Added all 17 approved Build with OS pages and the full nested section-local navigation.
- Added a checked-in Build claim ledger grounded in current source, manifests, focused tests, and runtime contracts.
- Replaced 12 directly superseded legacy pages, retargeted legacy redirects, and updated surviving internal links.
- Added Build contract and browser regression suites.
- Fixed normalized Markdown output so an H1 inside a fenced code sample does not suppress the page title; added a focused foundation regression test.

## green verification

- Build contract: 7 passed, 292 assertions.
- Foundation contract: 10 passed, 184 assertions.
- Start contract: 6 passed, 130 assertions.
- Connect contract: 8 passed, 309 assertions.
- Documentation validation: 65 selected pages passed.
- Browser regressions: foundation, Connect, and Build passed; 17 Build HTML routes and 17 Markdown routes verified; zero tablet or mobile overflow.
- Focused current OS verification: 83 passed, 960 assertions across 14 source-aligned suites.
- Workspace context trace verification: 3 passed, 16 assertions.
- Production build passed; Pagefind indexed 69 HTML files.
- Translation, package-boundary, link/redirect, terminology, placeholder, and git diff checks passed.
- Changed files are limited to `packages/documentation/**` and workspace-owned task metadata.

## review status

- The strict workspace review runner was invoked twice and timed out both times without returning findings. It was not retried further.
- Final local contract, browser, build, focused implementation, package-boundary, and diff checks are green.
- GitHub checks and normalized review feedback will be inspected after the task branch is pushed.

## known unrelated test drift

- Two existing task-hook contract expectations describe an older blocking hook shape while the current runtime returns advisory guidance. This task does not change OS runtime or those tests, and no public claim relies on that stale suite.
- The broad facade snapshot suite is missing current snapshots in this checkout under CI. Public claims rely on current generated manifests, source, and passing focused tool/search tests instead.

## next lifecycle steps

1. Run the full task safety gate.
2. Push the task branch and inspect task PR checks/reviews.
3. Merge the task PR into `stream/documentation` and refresh stream PR #1448.
4. Verify the merged stream from an isolated worktree.
5. Finish and clean up the task.

## workspace-owned: test selection

- changed files: `.task/documentation/write-build-with-os-documentation/current.json`, `.task/documentation/write-build-with-os-documentation/session.json`, `.task/documentation/write-build-with-os-documentation/verify.json`, `.task/documentation/write-build-with-os-documentation/workpad.md`, `.task/tasks/documentation/write-build-with-os-documentation.json`, `packages/documentation/evidence/build-claims.md`, `packages/documentation/package.json`, `packages/documentation/scripts/test-build-browser.mjs`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/content/docs/build/approvals.mdx`, `packages/documentation/src/content/docs/build/files-and-artifacts.mdx`, `packages/documentation/src/content/docs/build/index.mdx`, `packages/documentation/src/content/docs/build/shared-memory-and-context.mdx`, `packages/documentation/src/content/docs/build/skills/create-a-skill.mdx`, `packages/documentation/src/content/docs/build/skills/how-skills-work.mdx`, `packages/documentation/src/content/docs/build/skills/install-a-skill.mdx`, `packages/documentation/src/content/docs/build/skills/skill-structure.mdx`, `packages/documentation/src/content/docs/build/steering/how-steering-works.mdx`, `packages/documentation/src/content/docs/build/steering/project-steering.mdx`, `packages/documentation/src/content/docs/build/steering/workspace-steering.mdx`, `packages/documentation/src/content/docs/build/tools/browser.mdx`, `packages/documentation/src/content/docs/build/tools/how-tools-work.mdx`, `packages/documentation/src/content/docs/build/tools/media.mdx`, `packages/documentation/src/content/docs/build/tools/office.mdx`, `packages/documentation/src/content/docs/build/tools/workspace.mdx`, `packages/documentation/src/content/docs/build/workflows.mdx`, `packages/documentation/src/content/docs/developers/agent/tool-system.mdx`, `packages/documentation/src/content/docs/developers/introduction.mdx`, `packages/documentation/src/content/docs/os/concepts/approvals.mdx`, `packages/documentation/src/content/docs/os/concepts/configuration.mdx`, `packages/documentation/src/content/docs/os/concepts/context-and-memory.mdx`, `packages/documentation/src/content/docs/os/concepts/data-model-and-graphql.mdx`, `packages/documentation/src/content/docs/os/concepts/files-and-artifacts.mdx`, `packages/documentation/src/content/docs/os/concepts/observability.mdx`, `packages/documentation/src/content/docs/os/concepts/portal.mdx`, `packages/documentation/src/content/docs/os/concepts/scripts.mdx`, `packages/documentation/src/content/docs/os/concepts/skills.mdx`, `packages/documentation/src/content/docs/os/glossary.mdx`, `packages/documentation/src/content/docs/os/tools/browser-tools.mdx`, `packages/documentation/src/content/docs/os/tools/overview.mdx`, `packages/documentation/src/content/docs/os/tools/subagents.mdx`, `packages/documentation/src/content/docs/tools/media/getting-started.mdx`, `packages/documentation/src/content/docs/tools/office.mdx`, `packages/documentation/src/content/docs/tools/overview.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/configure-your-workspace.mdx`, `packages/documentation/src/lib/docs-navigation.ts`, `packages/documentation/src/lib/legacy-redirects.mjs`, `packages/documentation/src/lib/markdown-pages.ts`, `packages/documentation/tests/build.test.ts`, `packages/documentation/tests/foundation.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## full safety gate

- `workspace verify` completed with `publishValid: true`.
- Review checks passed: static rules, ESLint, typecheck gate, and spec compliance.
- Review summary: 0 findings from these changes, 0 related pre-existing findings, 0 blocking issues.
- The only reported pre-existing note is that this Nx workspace has no project exposing a `typecheck` target; documentation-specific builds and tests were run directly and passed.
- The verify selector did not auto-select a suite for these documentation paths, so the focused documentation, browser, build, and implementation suites recorded above remain the explicit test evidence.
