# DEV-1634 docs transformations on stream base

branch: `task/dialer/dev-1634-docs-transformations-on-stream-base`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2689
started: 2026-10-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-documentation/scripts/lib/docs-links.mjs`
- `packages/dialer-documentation/scripts/test-translation.mjs`
- `packages/dialer-documentation/scripts/validate-documentation.mjs`
- `packages/dialer-documentation/src/lib/markdown-pages.ts`
- `packages/dialer-documentation/src/lib/translation/provider.ts`
- `packages/dialer-documentation/src/lib/translation/text.ts`
- `packages/dialer-documentation/tests/links.test.ts`
- `packages/dialer-documentation/tests/markdown.test.ts`

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## DEV-1634 continuation — stream-based task

- The first managed DEV-1634 session was accidentally bootstrapped from `main`; that branch inherited unrelated OS changes. No source from that task was published or merged.
- This replacement task explicitly uses `startFrom=stream` to preserve stream/dialer isolation. Transfer only DEV-1634-owned documentation changes and tests, not unrelated main changes or old task metadata.
- Test-first contract: relative Markdown/HTML destinations must resolve against the source route; Starlight note/warning directives export to readable Markdown, fenced examples stay literal; malformed Google translations reject with typed 502; fenced code must not enter prose extraction.
- Existing patterns: Bun `tests/markdown.test.ts`, `scripts/test-translation.mjs`, validator and docs helpers.
- New tests: `tests/links.test.ts`, Markdown directives tests, provider malformed-response and code-fence cases in translation script.
- Focused red: `bun test packages/dialer-documentation/tests/markdown.test.ts packages/dialer-documentation/tests/links.test.ts` (trace trc_8dadeb9590ac); `bun run --cwd packages/dialer-documentation test:translation` (trace trc_1dcce455ac5a).
- Expected red was observed in previous task before implementation. Repeat green and validation against corrected stream-based source.
- No-test waiver: none. Do not merge main or deploy. Retire the superseded task PR after copying and verifying new task source.

- 2026-10-29 20:02:23 append: `.task/dialer/dev-1634-docs-transformations-on-stream-base/workpad.md`

## workspace-owned: files changed

- `packages/dialer-documentation/scripts/lib/docs-links.mjs`
- `packages/dialer-documentation/scripts/test-translation.mjs`
- `packages/dialer-documentation/scripts/validate-documentation.mjs`
- `packages/dialer-documentation/src/lib/markdown-pages.ts`
- `packages/dialer-documentation/src/lib/translation/provider.ts`
- `packages/dialer-documentation/src/lib/translation/text.ts`
- `packages/dialer-documentation/tests/links.test.ts`
- `packages/dialer-documentation/tests/markdown.test.ts`

## workspace-owned: activity log

- 2026-10-29 20:02:23 fs.write: `.task/dialer/dev-1634-docs-transformations-on-stream-base/workpad.md`
- 2026-10-29 20:02:54 write: `packages/dialer-documentation/scripts/lib/docs-links.mjs`
- 2026-10-29 20:02:54 fs.write: `packages/dialer-documentation/scripts/lib/docs-links.mjs`
- 2026-10-29 20:02:56 write: `packages/dialer-documentation/tests/links.test.ts`
- 2026-10-29 20:02:56 fs.write: `packages/dialer-documentation/tests/links.test.ts`
- 2026-10-29 20:03:14 write: `packages/dialer-documentation/src/lib/translation/text.ts`
- 2026-10-29 20:03:14 fs.write: `packages/dialer-documentation/src/lib/translation/text.ts`
- 2026-10-29 20:03:14 write: `packages/dialer-documentation/src/lib/translation/provider.ts`
- 2026-10-29 20:03:14 write: `packages/dialer-documentation/scripts/test-translation.mjs`
- 2026-10-29 20:03:14 fs.write: `packages/dialer-documentation/src/lib/translation/provider.ts`
- 2026-10-29 20:03:14 fs.write: `packages/dialer-documentation/scripts/test-translation.mjs`
- 2026-10-29 20:03:14 write: `packages/dialer-documentation/scripts/validate-documentation.mjs`
- 2026-10-29 20:03:14 fs.write: `packages/dialer-documentation/scripts/validate-documentation.mjs`
- 2026-10-29 20:03:14 write: `packages/dialer-documentation/src/lib/markdown-pages.ts`
- 2026-10-29 20:03:14 fs.write: `packages/dialer-documentation/src/lib/markdown-pages.ts`
- 2026-10-29 20:03:16 write: `packages/dialer-documentation/tests/markdown.test.ts`
- 2026-10-29 20:03:16 fs.write: `packages/dialer-documentation/tests/markdown.test.ts`
- 2026-10-29 20:03:45 apply-patch: `packages/dialer-documentation/scripts/test-translation.mjs`
- 2026-10-29 20:05:29 fs.write: `.task/dialer/dev-1634-docs-transformations-on-stream-base/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 20:04:29 `review.run`: passed — OK
- 2026-10-29 20:08:07 `verify`: passed — OK

## Corrected stream baseline and green evidence (2026-10-29)

- Re-created managed task with `startFrom=stream`: source `20d0dc8ffe0b1e5995c72a38d6220c273f6deec5`, task PR https://github.com/consuelohq/opensaas/pull/2689. Confirmed `git diff origin/stream/dialer` includes only intended Dialer documentation files; none of the unrelated OS changes from the original main-based task.
- Copied all eight changed/new files verbatim from prior paused worktree, preserved the prior red tests and original evidence, then corrected the review warning in the malformed-response fixture by using a Promise-returning fetch mock.
- Original empty-bootstrap PR #2688 was closed as superseded; no implementation from that branch was promoted. The old WIP worktree was preserved while completing this replacement.
- Corrected worktree dependencies installed via frozen Bun lockfile. Full `bun run --cwd packages/dialer-documentation test`: 11 passing / 0 failing / 103 assertions; `test:translation` passed; `validate` checked 31 pages; `DOCS_SITE_URL=https://docs-preview.example.test PUBLIC_DOCS_PREVIEW=1 bun run ... build` passed (trace trc_af563f1e63a9).
- Rendered `DOCS_TEST_PORT=44244 DOCS_SITE_URL=https://docs-preview.example.test PUBLIC_DOCS_PREVIEW=1 bun run test:browser`: 30 docs pages, 7 Chromium viewports, WebKit short landscape, metadata/translation/redirects all passed.
- Strict review: zero task-owned blockers; pre-existing Nx typecheck-target note only. Preview build uses a test fixture URL; no deployed Worker, main merge or production domain changes.

- 2026-10-29 20:05:29 append: `.task/dialer/dev-1634-docs-transformations-on-stream-base/workpad.md`

## workspace-owned: files read

- `packages/dialer-documentation/src/components/PageTitle.astro`
