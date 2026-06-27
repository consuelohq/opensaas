# Media tools docs

## Acceptance criteria
- Add a top-level `Tools` tab to Mintlify navigation.
- Add a first complete `Tools > Media` documentation section.
- Follow a Railway-style docs model: clear left navigation, concise overview pages, workflow pages, and reference pages.
- Keep generated OS agent-context docs separate from human-facing tool docs.
- Document `media.svg.convert` deeply enough that agents can use it correctly.
- Add usable reference pages for the main media workflow tools.

## Source patterns read
- `packages/consuelo-docs/docs.json`
- Discord bot overview/getting-started/capability docs
- OS overview and OS tools overview docs
- `packages/workspace/senior-engineer.md` and steering `How To Speak`
- Railway docs landing/navigation model from docs.railway.com

## No-test waiver
This is a docs/navigation task. Runtime behavior did not change. Validation is docs-appropriate: config parse, navigation target existence, changed-file frontmatter/fence checks, Mintlify validate attempt, review gate, and publish verify.

## Implementation
- Added `Tools` top-level tab after `User Guide`.
- Added `Tools > Overview`.
- Added `Tools > Media` with:
  - Getting Started
  - Capabilities
  - Workflows: Image to SVG, First Video, YouTube Clip Breakdown
  - Reference pages for the main media tools
- Added a small `Tools > Office` placeholder so the new top-level Tools layout has a stable next family target.
- Added three thin dialer placeholder pages because the existing navigation referenced them and the docs config had missing targets before this task.

## Validation
- Navigation target check: passed, no missing navigation pages.
- New/changed MDX frontmatter and fence check: passed.
- Mintlify validation: attempted with `bun run --cwd packages/consuelo-docs build`; failed on existing site-level MDX/parser drift outside this task, including translated docs and GraphQL automation pages.

## Known caveat
The full Mintlify build is not clean before this PR. This task improves the page-resolution baseline by adding the missing dialer pages and adding the Media docs, but broader docs cleanup remains needed.

## workspace-owned: validation evidence

- 2026-06-27 22:37:34 `review.run`: passed — OK
- 2026-06-27 22:37:35 `review.run`: passed — OK
- 2026-06-27 22:40:24 `verify`: failed — COMMAND_FAILED
- 2026-06-27 22:40:25 `verify`: failed — COMMAND_FAILED

## Review gate
- `review.run --base origin/stream/docs`: passed for this change with 0 issues attributed to the docs diff.
- Review reported pre-existing eslint/typecheck/test failures outside this task.
- The task remains scoped to docs navigation and Media docs.

## Files added
- `packages/consuelo-docs/tools/overview.mdx`
- `packages/consuelo-docs/tools/office.mdx`
- `packages/consuelo-docs/tools/media/getting-started.mdx`
- `packages/consuelo-docs/tools/media/capabilities.mdx`
- `packages/consuelo-docs/tools/media/workflows/*`
- `packages/consuelo-docs/tools/media/reference/*`
- Thin placeholder pages for existing missing dialer navigation entries.

## workspace-owned: test selection

- changed files: `.task/docs/media-tools-docs/current.json`, `.task/docs/media-tools-docs/session.json`, `.task/docs/media-tools-docs/workpad.md`, `.task/tasks/docs/media-tools-docs.json`, `packages/consuelo-docs/docs.json`, `packages/consuelo-docs/tools/media/capabilities.mdx`, `packages/consuelo-docs/tools/media/getting-started.mdx`, `packages/consuelo-docs/tools/media/reference/media-breakdown-plan.mdx`, `packages/consuelo-docs/tools/media/reference/media-compose.mdx`, `packages/consuelo-docs/tools/media/reference/media-export.mdx`, `packages/consuelo-docs/tools/media/reference/media-frames-extract.mdx`, `packages/consuelo-docs/tools/media/reference/media-ingest.mdx`, `packages/consuelo-docs/tools/media/reference/media-motion-track.mdx`, `packages/consuelo-docs/tools/media/reference/media-overlay-render.mdx`, `packages/consuelo-docs/tools/media/reference/media-pose-estimate.mdx`, `packages/consuelo-docs/tools/media/reference/media-probe.mdx`, `packages/consuelo-docs/tools/media/reference/media-qa.mdx`, `packages/consuelo-docs/tools/media/reference/media-scene-detect.mdx`, `packages/consuelo-docs/tools/media/reference/media-svg-convert.mdx`, `packages/consuelo-docs/tools/media/reference/media-timeline-validate.mdx`, `packages/consuelo-docs/tools/media/reference/media-transcribe.mdx`, `packages/consuelo-docs/tools/media/workflows/first-video.mdx`, `packages/consuelo-docs/tools/media/workflows/image-to-svg.mdx`, `packages/consuelo-docs/tools/media/workflows/youtube-clip-breakdown.mdx`, `packages/consuelo-docs/tools/office.mdx`, `packages/consuelo-docs/tools/overview.mdx`, `packages/consuelo-docs/user-guide/dialer/hold-mute.mdx`, `packages/consuelo-docs/user-guide/dialer/making-calls.mdx`, `packages/consuelo-docs/user-guide/dialer/transfers.mdx`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional


## Publish verify
- `verify --base origin/stream/docs`: failed closed because full repo review reused pre-existing eslint/typecheck/test failures outside this docs task.
- `verify` also noted zero selected test suites because this is a docs-only task.
- Docs-specific validation remains green: navigation resolution and changed-file frontmatter/fence checks.
- Review reported no issues attributed to this task.
