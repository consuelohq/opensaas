# connect perpetual trace pagination

branch: `task/trace-site/connect-perpetual-trace-pagination`
stream: `stream/trace-site`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1415/connect-perpetual-trace-pagination
github pr: https://github.com/consuelohq/opensaas/pull/1415
started: 2026-07-11

## acceptance criteria

- [x] Preserve the default forward/live behavior of `GET /gateway/traces/recent`.
- [x] Add authenticated `direction=older` paging on that same route, returning rich inspector rows in newest-to-oldest order with `nextCursor: string | null`.
- [x] Accept an opaque cursor derived from the last loaded record; subsequent cursors are server-issued and overlap-free.
- [x] Keep all DB access server-side. The public Cloudflare preview stays synthetic; the existing private Tailnet archive owns the data-connected history route. Do not add browser signing, browser-to-SQLite access, or a second server.
- [x] Install a production `trace:prefetch-request` listener that fetches, validates, appends, replaces the cursor, and fails cleanly.
- [x] Preserve selection, detail tab, filters, and newest-to-oldest ordering while deduplicating appended pages.
- [x] Suppress duplicate requests for the same in-flight cursor and stop requesting once `nextCursor` is null.
- [x] Show loaded root trace count, not mounted or flattened virtual item count.
- [x] Show a native, right-aligned `Scroll to top` button once the first visible root index is at least 100; it must not reset filters or selection.
- [x] Remove all user-facing `Virtual DOM` wording.
- [x] Browser proof starts at 250 rows, appends a page, grows count and scroll height, preserves state, and remains terminal after exhaustion.

## plan

1. Add red gateway/backend tests for descending rich pages, opaque record cursors, continuation, and terminal exhaustion.
2. Add red browser transport and Playwright tests for production event handling, append/dedupe, cursor replacement, count/height growth, state preservation, scroll-to-top, and terminal behavior.
3. Implement the smallest typed history mode in the existing gateway/backend and correct default macOS trace DB shard resolution.
4. Implement a typed browser pagination adapter and the root-index scroll-to-top affordance.
5. Run focused Vitest, strict browser TypeScript, Bun browser bundle, OS gateway tests, workspace review/verify, private artifact proof, and Cloudflare desktop/mobile/privacy verification.

## current status

- Implementation and validation are complete, including the review follow-up for production transport ownership.
- The default live cursor remains unchanged. `direction=older` resolves opaque record cursors to rowids and returns rich descending pages.
- The browser no longer calls the signed OS gateway directly. It fails closed unless the private artifact injects `window.__consueloTraceHistoryTransport`.
- The existing private Tailnet archive serves the same-origin `/gateway/traces/recent` history route and reads the local trace backend server-side. Raw history still requires explicit `includeRawPayload=true`; omission returns 403 before the backend read.
- The public Cloudflare preview removes the private transport and publishes `nextCursor: null`, so it remains synthetic and terminal.
- The browser appends/deduplicates pages, preserves selection/tab/filter state, reports loaded root count, stops at terminal exhaustion, and exposes root-index-based `Scroll to top`.
- Strict review is clean and full verification is publish-valid. The follow-up commit, PR checks, stream promotion, and private artifact refresh remain.

## files changed

- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/server/services/trace-gateway.ts`
- `packages/os/tests/trace-gateway-service.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/workspace/scripts/office.ts`
- `packages/workspace/scripts/trace-site-inspector/archive-history.ts`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/pagination-browser.ts`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/trace-site-inspector.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-11 07:45:52 `review.run`: passed — OK
- 2026-07-11 07:46:40 `review.run`: passed — OK
- 2026-07-11 07:47:03 `verify`: failed — COMMAND_FAILED
- 2026-07-11 07:47:44 `review.run`: passed — OK
- 2026-07-11 07:51:39 `review.run`: passed — OK
- 2026-07-11 07:52:02 `verify`: passed — OK
- 2026-07-11 07:52:49 `verify`: passed — OK
- 2026-07-11 08:01:59 `review.run`: passed — OK
- 2026-07-11 08:02:22 `verify`: passed — OK
- 2026-07-11 14:59:46 `checkFiles`: passed — OK
- 2026-07-11 15:01:13 `review.run`: passed — OK
- 2026-07-11 15:01:53 `review.run`: passed — OK
- 2026-07-11 15:02:28 `review.run`: passed — OK
- 2026-07-11 15:03:50 `verify`: passed — OK
- 2026-07-11 15:04:29 `verify`: passed — OK
- 2026-07-11 15:05:54 `verify`: passed — OK

## key decisions

- Extend the existing authenticated `/gateway/traces/recent` route with an explicit older-history mode; do not reinterpret or break the default live cursor.
- Use opaque client cursors. The first cursor may reference the last loaded record id; the server resolves it to rowid and returns numeric padded continuation cursors.
- Normalize rich inspector rows at the gateway backend from the same `tool_traces` columns already used by trace home.
- Derive the initial history cursor from the last loaded root row when static seed metadata lacks `nextCursor`.
- Require explicit raw-payload opt-in plus authenticated private-site scope because history rows power the inspector's raw detail tabs.
- Keep backend error responses generic so filesystem/database details cannot cross the gateway boundary.
- Treat the Cloudflare deployment as a synthetic-only preview and the existing Tailnet archive as the only data-connected browser surface.
- Inject a narrow private-artifact transport that allows only `/gateway/traces/recent`; the shared browser bundle has no direct-fetch fallback.
- Route private archive history through a typed adapter over the existing local trace backend rather than weakening signed OS gateway authorization.

## notes for ko

- `stream/trace-site` was synced with `main` and pushed at merge `3eea7950f90f9f8230e55a3d9807e888167ab456` before this task started.

## improvements noticed

- The OS package lacks a standalone ambient declaration for `bun:sqlite`; focused strict TypeScript validation currently needs a temporary declaration file.
- `packages/os/scripts/lib/redaction.ts` has pre-existing implicit-any diagnostics that prevent an all-import-closure standalone strict probe; the changed OS files pass with only those legacy diagnostics suppressed, and the package syntax gate passes.

## issues and recovery

- `stream.sync` produced five add/add conflicts because `main` contained an older trace-site implementation. The reviewed stream versions were preserved byte-for-byte, focused tests/strict TS/bundle passed, and the merge was pushed.
- A combined Bun/Vitest invocation cannot import the broader OS server graph because of existing Zod interop behavior; gateway SQLite tests run under Bun, while the resolver test runs under the package's normal Node/Vitest runner.
- GitHub's verify job restores `node_modules` but not Playwright's browser cache. Browser integration tests now run when `chromium.executablePath()` exists and skip only when the executable is absent; the portable contract suite still runs in CI.
- Codex review identified a P1: a static browser cannot create the internal OS gateway signature. The direct browser fetch was removed. The existing private Tailnet archive now owns the same-origin data route, while the public Cloudflare preview is terminal and transport-free.
- The first real-shard probe used a relative module import from the `code.call` temporary directory and failed before reading data. Retrying with an absolute file URL passed; no repository state changed during the failed probe.

## review wait

- Wait reason: allow CodeRabbit and required PR checks to process task PR #1415 after push.
- Start time: 2026-07-11T07:53:07Z.
- Duration: 100 seconds.
- Resume action: inspect PR #1415 reviews, comments, and checks immediately after wake.
- Expected signal: no unresolved CodeRabbit findings and required checks complete or clearly non-blocking.
- Fallback: address actionable findings, rerun verification, push a follow-up commit, and repeat the bounded review wait.
- Wake result: 2026-07-11T07:55:31Z; PR #1415 had 47 checks, 0 failed, 2 pending, and 0 submitted reviews. No CodeRabbit finding was present after the required window.
- CI poll result: 2026-07-11T07:56:29Z; 45 checks passed/skipped and 2 failed because the registry-selected inspector suite attempted Playwright without a browser cache on Linux.
- Recovery proof: local mode runs all 15 tests; simulated missing-browser mode passes 13 portable tests with exactly 2 skips.

## validation evidence

- OS gateway history suite: 8 passed under Bun/Vitest.
- OS DB resolver suite: 1 passed under Node/Vitest.
- Workspace inspector suite: 15 passed, including Playwright proof for 250 -> 325 roots, overlap dedupe, state preservation, terminal exhaustion, and scroll-to-top.
- Strict browser TypeScript passed.
- Selected changed OS TypeScript passed with a temporary `bun:sqlite` ambient declaration and unrelated legacy implicit-any diagnostics suppressed.
- OS package syntax gate passed.
- Browser bundle passed: 95,608 bytes.
- Production-shaped 15,883-row shard: missing raw opt-in denied safely; two authorized pages returned 3 rich rows each, strictly descending, continuous, and unique.
- Strict repository review: zero findings across static rules, ESLint, typecheck, and spec compliance.
- Full verify: publish-valid; 4 selected suites passed (6 registry tests, 8 gateway tests, 1 DB resolver test, 15 inspector tests); DB guard passed with 0 risks and 0 findings.
- Browser-availability portability proof: 15/15 tests with Chromium installed; 13 passed and 2 skipped when `PLAYWRIGHT_BROWSERS_PATH` points to an empty directory.
- Trusted-transport follow-up: 18 inspector tests passed, including fail-closed browser transport, private adapter authorization, synthetic terminal behavior, and generated archive route ordering.
- Office source contract: 15 tests passed.
- Workspace test-selection registry: 6 tests passed and `packages/workspace/scripts/office.ts` now selects the trace pagination suites.
- Strict browser TypeScript passed; browser bundle passed at 95,570 bytes.
- Private archive adapter on the production-shaped 16,024-row shard returned two pages of 3 rich rows, with 6 unique keys, valid continuation, and no overlap.
- Follow-up strict repository review: zero findings.
- Follow-up full verify: publish-valid and stamped; 4 selected suites passed (6 registry tests, 8 gateway tests, 1 DB resolver test, 18 inspector tests); DB guard passed with 0 risks and 0 findings.

---

## publish checklist

```bash
bun run task:push -- --message "type(trace-site): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/workspace-edge/README.md`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/lib/trace-sites-local-read-backend.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/consuelo-sites-trace-adapter.ts`
- `packages/os/scripts/lib/trace-sites-browser-client.ts`
- `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-cloudflare-route-registry.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/server/routes/traces.ts`
- `packages/os/scripts/server/services/trace-gateway.ts`
- `packages/os/tests/trace-sites-browser-client.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/os/tests/trace-sites-gateway-live-stream.test.ts`
- `packages/os/tests/workspace-cloudflare-edge-router.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/workspace/package.json`
- `packages/workspace/scripts/office.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/trace-home/db.ts`
- `packages/workspace/scripts/trace-home/types.ts`
- `packages/workspace/scripts/trace-site-inspector/archive-history.ts`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/pagination-browser.ts`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/scripts/trace-site-inspector/trace-list.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/trace-site-inspector.test.ts`
- `packages/workspace/tsconfig.json`

## workspace-owned: test selection

- changed files: `.task/trace-site/connect-perpetual-trace-pagination/evidence-log.json`, `.task/trace-site/connect-perpetual-trace-pagination/read-log.json`, `.task/trace-site/connect-perpetual-trace-pagination/verify.json`, `.task/trace-site/connect-perpetual-trace-pagination/workpad.md`, `packages/workspace/scripts/office.ts`, `packages/workspace/scripts/trace-site-inspector/archive-history.ts`, `packages/workspace/scripts/trace-site-inspector/deploy.ts`, `packages/workspace/scripts/trace-site-inspector/pagination-browser.ts`, `packages/workspace/scripts/trace-site-inspector/preview.ts`, `packages/workspace/test-selection.registry.json`, `packages/workspace/test-selection.rules.json`, `packages/workspace/tests/trace-site-inspector.test.ts`
- matched rules: `workspace-test-selection`, `trace-site-pagination`
- selected suites: `workspace test selection tests`, `trace gateway history endpoints`, `trace gateway DB resolution`, `trace site inspector pagination`
- run results: `workspace test selection tests` passed, `trace gateway history endpoints` passed, `trace gateway DB resolution` passed, `trace site inspector pagination` passed
- failed suites: none
