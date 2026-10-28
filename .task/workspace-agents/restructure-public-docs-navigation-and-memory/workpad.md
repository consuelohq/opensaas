# restructure public docs navigation and memory

branch: `task/workspace-agents/restructure-public-docs-navigation-and-memory`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1858/restructure-public-docs-navigation-and-memory
github pr: https://github.com/consuelohq/opensaas/pull/1858
started: 2026-08-12

## acceptance criteria

- [x] Global docs navigation is exactly: Start, Connect, Tools, Skills, Steering, Memory, Observe, Secure, Reference. `Build with OS` and `Sites` are not top-level sections.
- [x] Existing Build-era detail pages remain reachable so this layout change does not discard content or force a route migration while the separate skills-doc agent is adding pages.
- [x] Tools is a top-level section with a `Tool List` page generated from the current canonical OS tool manifest, alphabetized, with one static heading per tool so Starlight's `On this page` TOC can list every tool.
- [x] Skills and Steering are top-level sections without rewriting their existing detail docs; this task must minimize overlap with PR #1856, which is adding skill documentation.
- [x] Memory is a top-level section with current docs for workpads, handoffs, and streams/stream context, grounded in current OS implementation.
- [x] Workflows and Sites remain discoverable under Tools; durable files/artifacts remain discoverable under Memory; approvals route through Secure.
- [x] The selected sidebar page uses a neutral gray treatment with no blue active-state accent bar. Keyboard `:focus-visible` remains accessible.
- [x] Navigation, static docs validation, focused package tests, build, and browser regression checks pass.

## plan

1. Verify the current navigation/CSS contracts, canonical tool manifest, and memory implementation before editing.
2. Change tests first for the new nine-section navigation, neutral active-state styling, Tool List contract, and Memory docs contract; run the focused test suite red after destructive-literal preflight.
3. Refactor the navigation registry without physically moving existing Build-era detail pages. Add top-level landing pages and route-to-section lookup so old detail URLs get the correct Tools/Skills/Steering/Memory sidebar and breadcrumbs.
4. Generate the static alphabetical Tool List from `packages/os/manifests/generated/tool.manifest.json`.
5. Add current Memory pages for workpads, handoffs, and stream context; update Build-era overview/memory links only where needed to stop presenting Build as the primary information architecture.
6. Run focused tests, `validate`, build, and browser checks; inspect the diff; then run workspace review/verify and publish through the task lifecycle.

## current status

- Implementation and focused validation are complete. The new nine-section registry, neutral active state, promoted landing pages, 154-tool alphabetical Tool List, and Memory docs are all in the task worktree.
- Concurrent skills work is open as PR #1856 (`task/os/document-os-skills-and-enforce-docs-review-opportunities`). It now changes 51 files, including the Build tools/skills navigation, validator selection list, Build tests, and the legacy shared-memory page. This task deliberately avoids editing that agent's Build skills pages. Promoted Tools/Skills/Steering navigation is derived from the existing Build groups so its Artifacts and Bundled Skills additions can flow through without another layout rewrite.
- Conflict mitigation for PR #1856: restored `tests/build.test.ts` and `build/shared-memory-and-context.mdx` to their base versions; moved this task's contract into `tests/navigation-memory.test.ts`; moved the current saved-memory doc into `memory/saved-memory-and-traces.mdx`; and trimmed validator edits to the non-overlapping top-level navigation assertion hunk.
- Local task worktrees symlink `packages/documentation/node_modules` back to the main checkout. Astro 7/Vite mixes the real dependency path with the task-worktree path and fails with `No cached compile metadata found`. A clean temporary copy with a real local install builds and passes the browser suite, proving the code rather than the worktree dependency symlink.

## files changed

- `packages/documentation/src/content/docs/build/index.mdx`
- `packages/documentation/src/content/docs/build/shared-memory-and-context.mdx`
- `packages/documentation/src/content/docs/memory/handoffs.mdx`
- `packages/documentation/src/content/docs/memory/index.mdx`
- `packages/documentation/src/content/docs/memory/streams.mdx`
- `packages/documentation/src/content/docs/memory/workpads.mdx`
- `packages/documentation/src/content/docs/skills/index.mdx`
- `packages/documentation/src/content/docs/steering/index.mdx`
- `packages/documentation/src/content/docs/tools/index.mdx`

## workspace-owned: files changed

- `packages/documentation/src/content/docs/build/index.mdx`
- `packages/documentation/src/content/docs/build/shared-memory-and-context.mdx`
- `packages/documentation/src/content/docs/memory/handoffs.mdx`
- `packages/documentation/src/content/docs/memory/index.mdx`
- `packages/documentation/src/content/docs/memory/streams.mdx`
- `packages/documentation/src/content/docs/memory/workpads.mdx`
- `packages/documentation/src/content/docs/skills/index.mdx`
- `packages/documentation/src/content/docs/steering/index.mdx`
- `packages/documentation/src/content/docs/tools/index.mdx`

## workspace-owned: activity log

- 2026-08-12 00:23:52 fs.write: `packages/documentation/src/content/docs/tools/index.mdx`
- 2026-08-12 00:23:52 fs.write: `packages/documentation/src/content/docs/skills/index.mdx`
- 2026-08-12 00:23:53 fs.write: `packages/documentation/src/content/docs/steering/index.mdx`
- 2026-08-12 00:23:54 fs.write: `packages/documentation/src/content/docs/memory/index.mdx`
- 2026-08-12 00:23:54 fs.write: `packages/documentation/src/content/docs/memory/workpads.mdx`
- 2026-08-12 00:23:55 fs.write: `packages/documentation/src/content/docs/memory/handoffs.mdx`
- 2026-08-12 00:23:55 fs.write: `packages/documentation/src/content/docs/memory/streams.mdx`
- 2026-08-12 00:25:40 fs.write: `packages/documentation/src/content/docs/build/index.mdx`
- 2026-08-12 00:25:41 fs.write: `packages/documentation/src/content/docs/build/shared-memory-and-context.mdx`

## workspace-owned: validation evidence

- TDD red: `bun test packages/documentation/tests/foundation.test.ts packages/documentation/tests/build.test.ts` failed 11 tests before implementation as expected (old seven-section IA, old accent bar, and missing new routes); trace `trc_0fcd2a2c00a8`.
- Focused green after conflict isolation: `bun test packages/documentation/tests/foundation.test.ts packages/documentation/tests/navigation-memory.test.ts` passed 20/20 tests with 472 expectations; trace `trc_74d175281c22`.
- Static docs validation: `bun run validate` passed with 109 curated pages; trace `trc_17598113a4d8`.
- Direct task-worktree build/browser attempts reproduced the Astro/Vite symlink-only compile metadata failure; traces `trc_c0caa8ba49ac`, `trc_fbcf4075b4d3`, and `trc_fd711f6b9193`.
- Latest clean-copy production build and browser regression passed together with a real package-local `node_modules`; build generated 121 HTML files and all new Tools/Skills/Steering/Memory routes. Browser proof: 9 global links, neutral active selection/no box shadow, promoted Tools breadcrumb, every canonical tool present in the right-side TOC, and zero tablet/mobile overflow; trace `trc_d348b0271e3d`.
- User-facing docs scan found zero remaining `Build with OS` strings; trace `trc_6a4f1f940f0f`.
- Workspace review passed with 0 issues from this task and 0 blocking findings; one unrelated pre-existing project-level typecheck configuration notice remains (`no projects with 'typecheck' target found`); trace `trc_bbe83940f7ba`.
- Full task safety verification passed and marked the task publish-valid; trace `trc_2d81b514cb90`.
- 2026-08-12 00:34:30 `review.run`: passed — OK
- 2026-08-12 00:34:42 `verify`: passed — OK
- 2026-08-12 00:34:57 `verify`: passed — OK

## key decisions

- Preserve existing Build-era detail routes for compatibility and parallel-agent safety. Promote them into new top-level sections through the navigation model instead of bulk-moving files.
- Add new canonical landing pages at `/tools/`, `/skills/`, `/steering/`, and `/memory/`; keep detail routes such as `/build/tools/how-tools-work/` until a separate route-migration task is justified.
- Treat the generated OS tool manifest as the Tool List source of truth. Static MDX headings are required so Starlight can populate the right-side page TOC.

## notes for ko

- The explicit top-level list omits Sites. This task keeps all Sites docs but nests them under Tools rather than deleting them.
- The existing Secure section already has an Approvals page, so the Build-era approvals page will not remain a primary navigation item.

## improvements noticed

- The current docs tests hard-code the old seven-section information architecture in several places; this task will update those contracts together to prevent stale navigation assertions.

## issues and recovery

- `explore` was noisy for documentation navigation, so direct package reads and a bounded repo scanner were used as the source of truth.
- An initial `fs.write` overwrite attempt was rejected by the facade, then the expected file-exists guard fired. Switched to anchored `fs.apply_patch` for the existing workpad.
- `task.call` and a few `code.call`/`fs.read` requests intermittently returned transport/network errors. Retried only when needed and used the same typed facade; no filesystem bypass was used.
- Astro build and browser checks fail only inside the task worktree because `packages/documentation/node_modules` is a symlink to `/Users/kokayi/Dev/opensaas/packages/documentation/node_modules`. Reproduced the path mismatch, then validated from a clean temporary package copy with its own `bun install --frozen-lockfile`; both production build and browser suite pass there.

## Test-first contract

- Behavior under test: the docs registry exposes exactly nine top-level sections in Ko's order; Build-era detail routes resolve to their promoted section; the active sidebar item has no accent-color inset bar; Tool List headings exactly match the current canonical tool manifest in alphabetical order; Memory pages cover workpads, handoffs, and `stream.context` with current source evidence.
- Existing local pattern: `tests/foundation.test.ts` owns navigation/CSS contracts, `tests/build.test.ts` owns Build-era content contracts, and the browser foundation test proves real Starlight sidebar/TOC behavior.
- New or changed tests: update foundation navigation/CSS expectations; update the Build-era test into promoted-section compatibility checks; add exact manifest-vs-Tool-List heading assertions and Memory page assertions; update the foundation browser script for nine global sections, neutral active styling, promoted breadcrumbs, and Tool List TOC visibility.
- Focused red command: `bun test tests/foundation.test.ts tests/build.test.ts` from `packages/documentation` after destructive-literal preflight.
- Expected red failure: the current app still exposes seven top-level sections including Build/Sites, maps `/build/tools/*` breadcrumbs to Build, has an accent-color active-state box shadow, and has no `/tools/tool-list/` or `/memory/*` pages.
- No-test waiver: none.
- Red evidence: trace `trc_0fcd2a2c00a8` (9 pass, 11 expected failures before implementation).
- Green evidence: trace `trc_74d175281c22` (20 pass, 0 fail after implementation and conflict isolation).
- Post evidence: `trc_17598113a4d8` (validator), `trc_d348b0271e3d` (clean production build + browser regression), `trc_bbe83940f7ba` (review), and `trc_2d81b514cb90` (full verify).

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/package.json`
- `packages/documentation/scripts/lib/documentation-browser-test.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/components/SiteFooter.astro`
- `packages/documentation/src/content/docs/build/index.mdx`
- `packages/documentation/src/content/docs/build/shared-memory-and-context.mdx`
- `packages/documentation/src/content/docs/build/tools/how-tools-work.mdx`
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/src/content/docs/reference/tools.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/build.test.ts`
- `packages/documentation/tests/foundation.test.ts`
- `packages/documentation/tests/reference.test.ts`
- `packages/os/scripts/lib/stream-memory.js`
- `packages/os/scripts/lib/streams/context-runtime.ts`
- `packages/os/scripts/lib/task-workpad.js`
- `packages/os/scripts/memory.js`
- `packages/os/scripts/stream-context.js`
- `packages/os/scripts/task-push.js`
- `packages/os/skills/handoff/SKILL.md`
- `packages/os/tools/memory/handler.ts`
- `packages/os/tools/memory/manifest.ts`
- `packages/os/tools/memory/schema.ts`
- `packages/os/tools/stream/handler.ts`
- `packages/os/tools/stream/manifest.ts`
- `packages/os/tools/stream/schema.ts`

- 2026-08-12 00:30:47 apply-patch: `.task/workspace-agents/restructure-public-docs-navigation-and-memory/workpad.md`
- 2026-08-12 00:32:04 apply-patch: `packages/documentation/src/lib/docs-navigation.ts`
- 2026-08-12 00:32:04 apply-patch: `packages/documentation/src/content/docs/memory/index.mdx`
- 2026-08-12 00:32:04 apply-patch: `packages/documentation/tests/navigation-memory.test.ts`
- 2026-08-12 00:32:04 apply-patch: `packages/documentation/scripts/validate-documentation.mjs`
- 2026-08-12 00:33:54 apply-patch: `packages/documentation/src/lib/docs-navigation.ts`

- 2026-08-12 00:34:03 apply-patch: `.task/workspace-agents/restructure-public-docs-navigation-and-memory/workpad.md`

- 2026-08-12 00:34:52 apply-patch: `.task/workspace-agents/restructure-public-docs-navigation-and-memory/workpad.md`
