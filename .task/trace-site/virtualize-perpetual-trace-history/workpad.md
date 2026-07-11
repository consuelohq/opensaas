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

- `packages/workspace/bun.lock`
- `packages/workspace/package.json`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/tests/trace-site-inspector.test.ts`
- `packages/workspace/scripts/trace-site-inspector/trace-list.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`


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
- CodeRabbit completed its first stream review after approximately 24 minutes and posted four actionable findings plus five nitpicks: `trc_3eacb1bd7872` / `trc_9a78a8e58342`.
- Review-fix red tests failed for non-contiguous selected retention, ineffective script escaping, and literal `\\n` Cloudflare files: `trc_52513b592ef7`.
- Review-fix focused suite now passes 13 tests, including a permanent Chromium contract for bounded mounting, six inspector tabs, range-prefetch, mobile Back, and detail clearing: `trc_c5520af8875e`.
- Reviewed browser modules pass strict TypeScript and produce a 90.46 KB Bun browser bundle: `trc_d730ed6ea719`.
- Reviewed temporary private-artifact proof: 250 roots, 32–33 mounted rows, 99-row search result, bottom selection/detail identity, visible mobile Back, explicit deselection, and empty detail panel with zero browser errors: `trc_4d9245dbaa62`.
- Reviewed strict workspace review and full verification pass with zero findings and a publish-valid stamp: `trc_ca6176bbe372` / `trc_670a0ee77fca`.
- Reviewed private v29 archive install and corrected Cloudflare payload build: 90,458-byte bundle, valid line-based `_headers`, newline-terminated feed, 5,000 synthetic roots, trace `trc_e1568ed4b32b`.
- Reviewed Cloudflare deployment: immutable `https://76de2a48.consuelo-trace-preview.pages.dev`, stable alias `https://trace-site-v29.consuelo-trace-preview.pages.dev`, deployment log `trc_3621daaa02b2`.
- Live reviewed desktop proof: 5,000 roots / 5,002 items, 29 mounted rows, v29 bundle, selected/detail identity match, traces `trc_d16b4290093a` and `trc_1e5bed7f9393`.
- Live reviewed mobile Back proof: 402×874 viewport, 29 mounted rows; Back changes selection from `demo-record-005` to explicit empty, removes `.tiInspector`, and leaves zero inspector children, traces `trc_42850c5b400b` and `trc_871c762ab692`.
- Live Cloudflare response headers: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, trace `trc_6094ef69ad05`.
- 2026-07-11 04:56:44 `verify`: passed — OK
- 2026-07-11 04:59:14 `verify`: passed — OK
- 2026-07-11 05:39:17 `review.run`: passed — OK
- 2026-07-11 05:39:31 `verify`: passed — OK
- 2026-07-11 05:44:12 `verify`: passed — OK

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
- The first Chromium unit fixture used the deployed `/trace-burn-intelligence/` asset prefix with an incorrectly rooted Node static server, so the browser bundle never loaded. Replacing the server fixture with direct `setContent` plus built asset injection removed that unrelated transport dependency.
- The child-operation cache optimization initially compared `cached?.source` with an undefined row source, making an uncached empty source appear cached and dereferencing `cached.operations`. The new browser contract caught this; the cache guard now requires an actual cache entry.
- Clearing selection originally set an empty global key, but selection readers treated empty as uninitialized and restored the hash key. Both readers now distinguish an explicitly empty selection with `Object.hasOwn`, and the inspector clears its DOM/signature when no row is selected.
- The first reviewed Wrangler invocation and the attempted detached wrapper both exceeded the workspace command wrapper's 30-second response ceiling. The detached deployment itself completed successfully; its exit file and log confirmed code 0 and the final immutable/stable URLs.

## review wait log

### cycle 1

- Start time (UTC): 2026-07-11T05:00:04Z
- Wait reason: allow CodeRabbit and GitHub checks to process the newly created `stream/trace-site` PR #1411.
- Duration: 5 minutes (300 seconds), using the direct workspace `wait` facade rather than a code-runner sleep.
- Resume action: immediately query PR #1411 review/check state and fetch review comments if present.
- Expected signal: CodeRabbit review/check appears, or a rate-limit/status message explains why it did not run.
- Fallback: document the missing signal, inspect PR checks/reviews directly, and run another bounded wait cycle if the PR remains reviewable.
- Observed result: both direct five-minute forms (`seconds: 300` and `duration: "5m"`) were terminated by the connector with HTTP 502 at approximately the two-minute transport ceiling. The timer did not return a normal wake result.
- Wake check: at 2026-07-11T05:04:13Z, PR #1411 had five checks, no failures, and CodeRabbit was `IN_PROGRESS` since 2026-07-11T05:00:09Z (`trc_3f3b918a2dea`).
- Next decision: preserve direct `wait` usage but chain sub-ceiling intervals of 110s + 110s + 80s, with an immediate PR check after each wake.

### cycle 2

- Start time (UTC): 2026-07-11T05:04:13Z
- Wait reason: CodeRabbit is actively reviewing PR #1411.
- Duration/attempt settings: 110 seconds, then immediate PR review/check inspection.
- Resume action: query PR #1411 with the GitHub review preset; fetch comment details if CodeRabbit completes.
- Expected signal: CodeRabbit changes from `IN_PROGRESS` to completed and posts review findings or approval.
- Fallback: if still running, execute the next direct 110-second segment.
- Observed result: direct wait completed normally in 110.247 seconds (`trc_c3ecc74f5018`).
- Wake check: CodeRabbit remained `IN_PROGRESS`, with five total checks, zero failures, one pending, and no review comments (`trc_fde2dd4d5324`).
- Next decision: continue the planned second 110-second segment.

### cycle 3

- Start time (UTC): 2026-07-11T05:06:32Z
- Wait reason: CodeRabbit is still actively reviewing PR #1411.
- Duration/attempt settings: 110 seconds, then immediate PR review/check inspection.
- Resume action: query PR #1411 and fetch comments if the check completes.
- Expected signal: completed CodeRabbit check and posted review output.
- Fallback: execute the final 80-second segment to complete the five-minute chained observation window.
- Observed result: the second 110-second call failed with connector HTTP 502 before a normal wake response, and the immediate GitHub check also encountered the same transient connector error. The final 80-second direct wait then completed normally in 80.231 seconds (`trc_1322b4ad655b`).
- Wake check: CodeRabbit remained `IN_PROGRESS` at 2026-07-11T05:09:09Z, with zero failed checks and no review comments (`trc_8a4568beec5a`).
- Next decision: continue with three safer 100-second direct wait segments, checking PR state immediately after each.

### cycle 4

- Start time (UTC): 2026-07-11T05:09:09Z
- Wait reason: CodeRabbit has been active for about nine minutes and has not posted review output.
- Duration/attempt settings: 100 seconds, then immediate PR review/check inspection.
- Resume action: query PR #1411 and fetch review comments/status output.
- Expected signal: CodeRabbit completes with review findings, approval, or an explicit rate-limit message.
- Fallback: continue the remaining 100-second segments while the check remains active.
- Observed result: direct wait completed normally in 100.213 seconds (`trc_8f9d40cbc12b`).
- Wake check: CodeRabbit remained `IN_PROGRESS` with no failed checks and no review comments (`trc_e4761c73230a`).
- Next decision: run the second 100-second segment.

### cycle 5

- Start time (UTC): 2026-07-11T05:11:18Z
- Wait reason: CodeRabbit continues processing PR #1411.
- Duration/attempt settings: 100 seconds, then immediate PR inspection.
- Resume action: query reviews/checks and fetch comments if complete.
- Expected signal: completed review or explicit rate-limit status.
- Fallback: run the third 100-second segment if CodeRabbit remains active.
- Observed result: direct wait completed normally in 100.206 seconds (`trc_333640fae2c4`).
- Wake check: CodeRabbit remained `IN_PROGRESS` with zero failed checks and no review comments (`trc_aaa8d75e7d98`).
- Next decision: run the third 100-second segment to complete the chained five-minute window.

### cycle 6

- Start time (UTC): 2026-07-11T05:13:21Z
- Wait reason: CodeRabbit continues processing after roughly thirteen minutes.
- Duration/attempt settings: 100 seconds, then immediate PR inspection.
- Resume action: query reviews/checks and fetch comments if complete.
- Expected signal: completed review, actionable comments, approval, or an explicit rate-limit result.
- Fallback: if still active after this five-minute chained window, inspect CodeRabbit comments/status directly and decide whether another bounded window is warranted.
- Observed result: direct wait completed normally in 100.195 seconds (`trc_9e7b6905363d`).
- Wake check: CodeRabbit remained `IN_PROGRESS` (`trc_f146889caf71`). Direct comment inspection showed a live CodeRabbit Pro run (`ffff2540-10f5-4619-a6dc-cc5f563698e8`) processing nine code files, with no inline findings yet (`trc_c8f8216a5114`). Codex is separately usage-limited and Qodo is paused; neither is CodeRabbit.
- Additional signal: Danger posted a generic warning that `package.json` changed without `yarn.lock`; this workspace uses `packages/workspace/bun.lock`, which is updated, and the Danger check itself passed.
- Next decision: continue another bounded 100-second review segment because CodeRabbit is demonstrably active rather than rate-limited.

### cycle 7

- Start time (UTC): 2026-07-11T05:15:36Z
- Wait reason: CodeRabbit Pro run is still processing nine selected files and has not posted findings.
- Duration/attempt settings: 100 seconds, then immediate review/comment inspection.
- Resume action: query PR checks and `prReview`; address any actionable inline finding.
- Expected signal: CodeRabbit review completes or posts actionable comments.
- Fallback: continue bounded waits only while the check remains active and the run comment continues to show processing.
- Observed result: direct wait completed normally in 100.318 seconds (`trc_ddaf6ebbf1ea`).
- Wake check: CodeRabbit remained `IN_PROGRESS`, zero failed checks, no review findings (`trc_46fa70663105`).
- Next decision: run one final chained five-minute window. If the check and progress comment remain unchanged after that window, leave the implementation on `stream/trace-site` and report the external review as stalled rather than complete.

### cycle 8

- Start time (UTC): 2026-07-11T05:17:43Z
- Wait reason: allow one final bounded window for the active CodeRabbit Pro run.
- Duration/attempt settings: three direct 100-second segments with immediate status checks.
- Resume action: query PR checks/comments after each segment; fix actionable findings if posted.
- Expected signal: completed CodeRabbit review or concrete findings.
- Fallback: document unchanged `IN_PROGRESS` state and leave PR #1411 on the stream.
- Observed result: all three direct 100-second segments completed normally (`trc_c37ad87ce76e`, `trc_f6a672f5d9a8`, `trc_2058cb9acae5`). CodeRabbit completed successfully at 2026-07-11T05:24:45Z after approximately 24 minutes total review time.
- Review result: four actionable findings and five valid nitpicks were fetched with `prReview` (`trc_9a78a8e58342`). The fixes cover explicit inspector clearing, explicit-empty selection semantics, safe script seed serialization, real Cloudflare newlines, contiguous selected-row retention, scoped observers, child-operation caching, behavior-oriented tests, test naming, and the CSS spacing finding.
- Non-actionable signals: Codex was separately usage-limited, Qodo was paused, and Danger's generic `yarn.lock` warning does not apply because this package uses and updated `packages/workspace/bun.lock`.

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

## workspace-owned: test selection

- changed files: `.task/tasks/trace-site/virtualize-perpetual-trace-history.json`, `.task/trace-site/virtualize-perpetual-trace-history/current.json`, `.task/trace-site/virtualize-perpetual-trace-history/evidence-log.json`, `.task/trace-site/virtualize-perpetual-trace-history/read-log.json`, `.task/trace-site/virtualize-perpetual-trace-history/session.json`, `.task/trace-site/virtualize-perpetual-trace-history/verify.json`, `.task/trace-site/virtualize-perpetual-trace-history/workpad.md`, `packages/workspace/bun.lock`, `packages/workspace/package.json`, `packages/workspace/scripts/trace-site-inspector/browser.ts`, `packages/workspace/scripts/trace-site-inspector/deploy.ts`, `packages/workspace/scripts/trace-site-inspector/inspector.css`, `packages/workspace/scripts/trace-site-inspector/preview.ts`, `packages/workspace/scripts/trace-site-inspector/trace-list.ts`, `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`, `packages/workspace/tests/trace-site-inspector.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
