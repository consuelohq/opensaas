# polish internal trace inspector preview

branch: `task/trace-site/polish-internal-trace-inspector-preview`
stream: `stream/trace-site`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1398/polish-internal-trace-inspector-preview
github pr: https://github.com/consuelohq/opensaas/pull/1398
started: 2026-07-11

## acceptance criteria

- [x] Change only the existing internal Trace Burn Intelligence product and workspace-owned support code; do not modify `packages/os` or port the page to OS Observability.
- [x] Preserve the existing dashboard, launchers, filters, pagination, live feed, cost/failure surfaces, and dark trace-cockpit visual language.
- [x] Replace the selected-trace inner view with a two-region branch inspector: trace/branch context on the left and a useful preview on the right.
- [x] Show branch call count, failures, cumulative duration, input tokens, output tokens, and total tokens, plus token/latency values for each branch peer.
- [x] Provide real Summary, Input, Output, Error, Metadata, and Raw preview sections; failed traces open Error by default.
- [x] Extract useful failure diagnostics from stderr, nested batch/tool results, error messages, exit codes, and failed children instead of stopping at generic command-failed text.
- [x] Hide both Menu controls on desktop while retaining mobile navigation.
- [x] Make selected trace detail full-screen and navigable on mobile, not a partial-height bottom sheet.
- [x] Preserve selected trace and active preview section while the live feed refreshes.
- [x] Add focused automated tests and browser validation at desktop and phone widths.
- [x] Deploy the internal Tailnet artifact, then deploy a safe Cloudflare-hosted preview without exposing private trace payloads.
- [x] Verify deployed routes before task/stream cleanup.
- [x] Return a separate approval plan for any future OS port, local-database connection, authentication boundary, Hono, or Effect work.

## scope exclusions

- No OS Trace Sites implementation changes.
- No Hono or Effect migration.
- No public raw trace feed or local-database bridge.
- No rewrite of the outer dashboard.

## plan

1. Capture the current Tailnet desktop/mobile behavior and inspect the live artifact contract.
2. Add tests for branch accounting, nested error extraction, idempotent artifact patching, desktop/mobile control visibility, and full-screen mobile detail.
3. Implement a small tracked trace-inspector overlay rather than editing the historical minified bundle in place.
4. Build and apply the overlay to the internal archive while preserving the current feed, dashboard, and existing scripts.
5. Run focused tests, workspace review, and task verification.
6. Validate the Tailnet page on desktop and mobile, including streaming-selection persistence.
7. Publish a sanitized static Cloudflare preview and verify it before cleanup; do not publish embedded private trace data.
8. Push/promote the task through `stream/trace-site`, then report a separate port approval plan.

## test-first contract

Behavior under test:

- Branch summaries deduplicate feed aliases and sum calls, failures, duration, input/output/total tokens correctly.
- Error extraction prefers actionable stderr or nested child diagnostics over generic envelopes.
- Artifact patching adds one versioned CSS/JS overlay reference and is idempotent.
- Desktop CSS hides the outer command Menu and inner trace Menu; mobile CSS exposes only the navigation needed for the full-screen detail view.
- The preview has real named sections and persistent selected-section state.

Focused red command:

`bun --cwd packages/workspace test tests/trace-site-inspector.test.ts`

Expected red failure:

The new trace-inspector model/deployer modules do not exist yet.

## current status

- Implementation, private deployment, sanitized Cloudflare deployment, desktop/mobile browser validation, focused tests, and strict review are complete.
- The private Tailnet page remains the real data-connected surface and now loads the versioned v28 inspector overlay.
- The Cloudflare preview is a separate standalo## files changed

- `.task/trace-site/polish-internal-trace-inspector-preview/workpad.md`
- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/model.ts`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/tests/trace-site-inspector.test.ts`

## workspace-owned: files changed

- All files listed above plus task lifecycle metadata under `.task/trace-site/` and `.task/tasks/trace-site/`.

## workspace-owned: activity log

- Added the trace inspector model, browser overlay, responsive CSS, deterministic private deployer, sanitized Cloudflare preview builder, and focused tests.
- Deployed v28 assets into the ignored internal Open Design archive used by the Tailnet site.
- Created the dedicated `consuelo-trace-preview` Cloudflare Pages project and deployed the synthetic v28 preview on branch `trace-site-v28`.

## workspace-owned: validation evidence

- Red TDD evidence: focused test failed because the new inspector model did not exist, trace `trc_2fb69ac23e72`.
- Final focused test: 6 tests passed, trace `trc_7d45cef22ef0`.
- Strict review: zero own issues and zero blocking issues, trace `trc_e142de5809d5`.
- Full task verification passed and wrote a publish-valid stamp, trace `trc_3052f2794a51`. The registry selected zero suites, so the focused six-test command remains the explicit behavioral test evidence.
- Private v28 Tailnet deployment: `trc_415105220677`.
- Private desktop validation: desktop Menu hidden, six real preview sections, branch totals/peers, failed call opens Error with the concrete Cloudflare failure, trace `trc_68ec571e808f`.
- Private mobile validation: full viewport detail, Menu/Preview branch navigation, and selected trace plus Input tab preserved across the 15-second feed refresh, traces `trc_d8804c6797fd`, `trc_485a9cdf3629`, and `trc_537795b58986`.
- Final synthetic preview build: v28 assets, no private markers, trace `trc_e9830ebdf628`.
- Cloudflare v28 deployment: `trc_4f516c6d5f1d`.
- Cloudflare immutable and alias URL verification: HTTP 200, v28, standalone synthetic shell, no private markers, trace `trc_936dbd7ba34e`.
- Cloudflare desktop browser validation: `trc_0d80965d26a0`.
- Cloudflare mobile browser validation: `trc_aadba3221efe`.
- The first Cloudflare attempt inherited historical static dashboard text even though its seed data was synthetic. That deployment was immediately deleted, trace `trc_b6e3e8e63714`, and the publisher was changed to generate a standalone synthetic shell before the final deploy.
- 2026-07-11 03:24:29 `review.run`: passed — OK
- 2026-07-11 03:25:11 `review.run`: passed — OK
- 2026-07-11 03:26:04 `verify`: passed — OK

## key decisions

- Fix the current internal site first and defer the OS port until local DB, gateway, and auth contracts are explicitly approved.
- Preserve the established product shell and add a bounded source-owned overlay instead of rewriting the old generated bundle.
- Cloudflare publication must use a sanitized preview artifact; the live Tailnet page remains the private data-connected surface for this task.

## notes for ko

- The current Tailnet page already exposes stable trace identities and full raw fields in its private feed, so the UI can deliver branch totals and useful error previews without an OS API change.
- The current public `sites.consuelohq.com/tracing` route is only a reserved placeholder and is not a safe data connection for the private trace feed.

## future port approval plan

No port work is approved or started. The next phase should be alignment-first and split into explicit gates:

1. **Local data boundary** — confirm the canonical trace database location, retention model, and local runtime owner. Browsers must never open SQLite or a Tailnet database address directly.
2. **Authentication and authorization** — approve the user/workspace identity model and separate scopes for trace summaries, trace detail, and raw payloads. Remote reads should use short-lived signed gateway requests with audit records.
3. **Read contracts** — agree on bounded contracts for recent rows, summary, live events, selected-trace detail, and branch aggregation. The UI should not infer complete detail from a truncated list response.
4. **Privacy and redaction** — define server-side redaction, payload size limits, raw-field opt-in, error-message safety, and what may be cached or published.
5. **Connectivity proof** — first prove a local-only adapter, then an authenticated gateway path, including disconnected/offline states. Do not port the page until both are observable and tested.
6. **UI port** — after those contracts are approved, move this inspector source into the durable Astro page and replace the private feed seam without redesigning the interface again.
7. **Hono and Effect** — treat them as later service-boundary refactors. Hono may own HTTP routing and Effect may own query/stream services only after the contracts above are stable.

Approval should therefore happen in three separate decisions: local read adapter, authenticated remote hydration, then UI source port.

## improvements noticed

- A later port needs an approved authentication and trace-detail/read contract before it can connect customer pages to local databases.
- The historical internal artifact should eventually gain a first-class source/build owner instead of relying on an ignored generated archive plus deployment overlay.

## issues and recovery

- `stream/trace-site` did not exist; `task.start` created the stream from current main and opened PR #1398.
- The earlier Astro source is not on current main. The live internal artifact remains under the ignored Open Design archive, so this task introduces tracked overlay source and a deterministic deployment script.
- A superseded safe synthetic v27 Pages deployment could not be deleted through Wrangler because Cloudflare treats branch aliases as protected. It contains only synthetic data; the final reviewed URL is the v28 alias.

---

## publish checklist

```bash
bun run task:push -- --message "fix(trace-site): polish internal trace inspector preview" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/skills/task/SKILL.md`
- `packages/workspace/scripts/trace-site-inspector/preview.ts`
- `packages/workspace/scripts/website-deploy.js`
- `packages/workspace/senior-engineer.md`

## workspace-owned: test selection

- changed files: `.task/tasks/trace-site/polish-internal-trace-inspector-preview.json`, `.task/trace-site/polish-internal-trace-inspector-preview/current.json`, `.task/trace-site/polish-internal-trace-inspector-preview/evidence-log.json`, `.task/trace-site/polish-internal-trace-inspector-preview/read-log.json`, `.task/trace-site/polish-internal-trace-inspector-preview/session.json`, `.task/trace-site/polish-internal-trace-inspector-preview/workpad.md`, `packages/workspace/scripts/trace-site-inspector/browser.ts`, `packages/workspace/scripts/trace-site-inspector/deploy.ts`, `packages/workspace/scripts/trace-site-inspector/inspector.css`, `packages/workspace/scripts/trace-site-inspector/model.ts`, `packages/workspace/scripts/trace-site-inspector/preview.ts`, `packages/workspace/tests/trace-site-inspector.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
