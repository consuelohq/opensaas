# virtualize perpetual trace history

branch: `task/trace-site/virtualize-perpetual-trace-history`
stream: `stream/trace-site`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1409/virtualize-perpetual-trace-history
github pr: https://github.com/consuelohq/opensaas/pull/1409
started: 2026-07-11

## acceptance criteria

- [x] Add DOM windowing to the existing internal Trace Burn Intelligence trace list with `@tanstack/virtual-core`; do not add React or another UI framework.
- [x] Preserve stable trace selection, branch inspector behavior, desktop/mobile navigation, and live-feed refresh behavior.
- [x] Keep only an overscanned visible range mounted while retaining the current feed contract in memory.
- [x] Trigger a typed prefetch seam from the virtual range near the oldest loaded row; do not use an IntersectionObserver sentinel inside the virtual list.
- [x] Bound retained summary rows with deterministic selected-row preservation so future cursor pages cannot grow client memory without limit.
- [x] Keep Hono/Effect and authenticated cursor APIs out of this stream; the client seam must be compatible with the already-approved future server contract.
- [x] Add focused tests, browser/runtime validation at desktop and mobile widths, and a large-feed proof showing bounded mounted DOM.
- [x] Deploy the private Tailnet artifact and a sanitized Cloudflare Pages preview without publishing private trace data.
- [ ] Push/promote through `stream/trace-site`, monitor the stream PR in five-minute increments, and address actionable CodeRabbit feedback.

## scope exclusions

- No React island, TanStack Query, or frontend-framework migration.
- No direct browser-to-SQLite access.
- No duplicate Hono server implementation in the trace-site stream.
- No publication of private trace payloads to Cloudflare.

## plan

1. Add a pure trace-list state contract for dedupe, retention, selection preservation, and prefetch thresholds.
2. Write and run focused failing tests for that contract and for the generated virtual-list markup.
3. Add `@tanstack/virtual-core`, isolate it behind a small browser adapter, and virtualize the existing `.trxRow` list without changing the inspector contract.
4. Extend the synthetic preview to a production-like large feed and expose deterministic diagnostics for mounted count, total count, and prefetch state.
5. Run focused tests, static checks, workspace review, full verify, and browser validation.
6. Deploy v29 to the private archive and sanitized Cloudflare Pages preview; verify both routes.
7. Push and promote to `stream/trace-site`, then use the dedicated wait workflow at five-minute intervals to monitor review state and fix actionable comments.

## test-first contract

Behavior under test:

- Merging trace pages deduplicates stable identities, preserves ordering, caps retained summaries, and never evicts the selected row.
- Prefetch becomes eligible only when the rendered virtual range approaches the final retained summary and a next cursor exists.
- The standalone preview delegates row mounting to a virtual-list container rather than server-rendering every trace row.
- The browser bundle uses TanStack Virtual Core directly and contains no React adapter/runtime import.

Existing local pattern:

- `packages/workspace/tests/trace-site-inspector.test.ts` for model, generated preview, deployment, and source-contract tests.
- `packages/workspace/scripts/trace-site-inspector/browser.ts` as the source-owned vanilla TypeScript overlay bundled by Bun.

New or changed tests:

- Add trace-list state tests for merge/retention/prefetch behavior.
- Add generated preview assertions for the virtual container and large synthetic feed.
- Extend source/deployment assertions for the direct core adapter and versioned v29 assets.

Focused red command:

`bun --cwd packages/workspace test tests/trace-site-inspector.test.ts`

Expected red failure:

- The trace-list state module and virtual-list markup do not exist, and the inspector version is still v28.

## current status

- Direct TanStack Virtual Core adapter, bounded trace-list state, virtual-range prefetch seam, production row renderer, filter mirroring, and v29 assets are implemented.
- Synthetic 5,000-row browser proof passes with 31 mounted desktop rows and 28 mounted mobile rows; the generated HTML contains no server-rendered trace rows.
- A temporary copy of the real private artifact passes with 250 retained rows, 32–33 mounted rows, the production 11-column row schema, search/clear filtering, bottom scrolling, and synchronized selection/detail state.
- Strict workspace review and full publish verification pass. The private archive now loads v29 assets and the sanitized 5,000-row Cloudflare deployment is live at `https://trace-site-v29.consuelo-trace-preview.pages.dev/trace-burn-intelligence/`.
- Stream promotion and review babysitting remain.

## files changed

- `.task/trace-site/virtualize-perpetual-trace-history/workpad.md`
- `.task/tasks/trace-site/virtualize-perpetual-trace-history.json`
- `packages/workspace/bun.lock`
- `packages/workspace/package.json`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/scripts/trace-site-inspector/trace-list.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/tests/trace-site-inspector.test.ts`

## workspace-owned: files changed

- `.task/trace-site/virtualize-perpetual-trace-history/workpad.md`
- `.task/tasks/trace-site/virtualize-perpetual-trace-history.json`
- `packages/workspace/bun.lock`
- `packages/workspace/package.json`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/scripts/trace-site-inspector/trace-list.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/tests/trace-site-inspector.test.ts`

## workspace-owned: activity log

- 2026-07-11 04:41:17 fs.write: `.task/trace-site/virtualize-perpetual-trace-history/workpad.md`
- 2026-07-11 04:43:14 fs.write: `packages/workspace/scripts/trace-site-inspector/trace-list.ts`
- 2026-07-11 04:43:56 fs.write: `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- 2026-07-11 04:50:34 fs.write: `packages/workspace/scripts/trace-site-inspector/trace-list.ts`
- 2026-07-11 04:51:24 fs.write: `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- Reviewed the existing vanilla TypeScript inspector overlay, synthetic Cloudflare preview, private archive deployer, and prior task boundary decisions.

## workspace-owned: validation evidence

- Focused red test failed at the intended missing `trace-list` boundary: `trc_f0e53a1a8404`.
- Focused inspector tests pass: 9 tests, `trc_bf4efaa094e9`.
- Targeted strict TypeScript with dependency declaration checks isolated passes, and Bun browser bundle succeeds at 89.66 KB: `trc_bf4efaa094e9`.
- Synthetic Playwright proof: 5,000 retained roots / 5,002 virtual items, 31 mounted desktop rows, 28 mounted mobile rows, 11 cells per production-shaped row, no browser errors, no server-rendered rows: `trc_75f21b2eb967`.
- Temporary private-artifact Playwright proof: 250 retained rows, 32–33 mounted rows, 886 px viewport, search narrows to 99 rows, clear restores 250, bottom range reaches `217-249`, selection and detail keys match: `trc_a116049f0378`.
- 2026-07-11 04:56:03 `review.run`: passed — OK
- Full workspace verification is publish-valid with zero review findings and zero database risks: `trc_a7f24ecd39cb`.
- Private archive v29 asset install and sanitized preview build: `trc_0a5cefba7125` / corrected sanitizer-value validation `trc_338bf27d8d71`.
- Cloudflare Pages deployment: immutable `https://7fb33883.consuelo-trace-preview.pages.dev`, stable alias `https://trace-site-v29.consuelo-trace-preview.pages.dev`, trace `trc_e919d65ed5cf`.
- Deployed Cloudflare desktop validation: synthetic marker, v29 assets, 5,000 roots / 5,002 items, 29 mounted rows, selected/detail identity match, traces `trc_9383aff33f4e` and `trc_0bd960c43c49`.
- Deployed Cloudflare mobile validation: 402×874 viewport, 29 mounted rows, mobile detail open, selected/detail identity match, traces `trc_968553dc52fb` and `trc_a25dd76028a0`.
- 2026-07-11 04:56:44 `verify`: passed — OK
- 2026-07-11 04:59:14 `verify`: passed — OK

## key decisions

- Use TanStack Virtual Core directly from the existing Bun-built browser module; React is not justified for a single list.
- Use virtual range proximity for prefetch signaling rather than an IntersectionObserver sentinel that would be mounted/unmounted by virtualization.
- Keep the Hono cursor/detail API implementation in its established security/OS stream; this task supplies a stable client-side seam only.

## notes for ko

- The current private feed is still an all-at-once JSON contract. This task removes the DOM bottleneck and adds bounded client state/prefetch signaling, but it does not pretend that static JSON is already a cursor API.

## improvements noticed

- The future Hono integration should replace the preview/local feed adapter without changing the virtual list or inspector selection contracts.

## issues and recovery

- The first `code.run` search used a nonexistent `code.search` facade tool; file reads succeeded and the search was rerun with a bounded Bun read script.
- The ignored private archive is not present inside the temporary task worktree. Deployment must target the known local archive root explicitly after tracked code is validated.
- The first private-artifact browser harness opened the modal with a zero-height trace viewport. Root cause was `contain: strict` applying size containment to the production grid scroll owner. Replacing it with `contain: layout paint style` restored the original 886 px viewport while retaining layout/paint isolation.
- An extra manual leak check initially flagged the harmless synthetic schema keys `taskSession` and `rawStderr`. The build's value-oriented sanitizer remained clean and rejected the actual private markers (`/Users/`, usernames, worktree paths, real task/trace prefixes); Cloudflare was not deployed until that validation passed.
- `https://trace-burn-intelligence.localhost:1355` returned `ERR_CONNECTION_CLOSED` during the final browser check (`trc_73675bc0a4b8`). The underlying v29 archive assets were installed and browser-validated from a served copy, but the local Open Design service itself was unavailable.

---

## publish checklist

```bash
bun run task:push -- --message "feat(trace-site): virtualize perpetual trace history" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-11 04:41:17 write: `.task/trace-site/virtualize-perpetual-trace-history/workpad.md`

- 2026-07-11 04:43:14 write: `packages/workspace/scripts/trace-site-inspector/trace-list.ts`

- 2026-07-11 04:43:56 write: `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`

## workspace-owned: files read

- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/model.ts`

- 2026-07-11 04:56:31 apply-patch: `.task/trace-site/virtualize-perpetual-trace-history/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/trace-site/virtualize-perpetual-trace-history.json`, `.task/trace-site/virtualize-perpetual-trace-history/current.json`, `.task/trace-site/virtualize-perpetual-trace-history/evidence-log.json`, `.task/trace-site/virtualize-perpetual-trace-history/read-log.json`, `.task/trace-site/virtualize-perpetual-trace-history/session.json`, `.task/trace-site/virtualize-perpetual-trace-history/verify.json`, `.task/trace-site/virtualize-perpetual-trace-history/workpad.md`, `packages/workspace/bun.lock`, `packages/workspace/package.json`, `packages/workspace/scripts/trace-site-inspector/browser.ts`, `packages/workspace/scripts/trace-site-inspector/deploy.ts`, `packages/workspace/scripts/trace-site-inspector/inspector.css`, `packages/workspace/scripts/trace-site-inspector/preview.ts`, `packages/workspace/scripts/trace-site-inspector/trace-list.ts`, `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`, `packages/workspace/tests/trace-site-inspector.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
