# Make trace inspector compact readable and accurate

branch: `task/trace-site/make-trace-inspector-compact-readable-and-accurate`
stream: `stream/trace-site`
pr: https://github.com/consuelohq/opensaas/pull/2662
started: 2026-10-29

## acceptance criteria

- [x] Compact call header, narrow rail, Output/Input/Details tabs, and complete readable payloads.
- [x] System sans text, plain-zero code, correct light/dark contrast, and contained responsive layout.
- [x] Honest token provenance and deduplicated nested failures/totals.
- [x] Preserve live selection, keyboard controls, JSON, Workpad, redaction, and mobile call navigation.
- [x] Strict review and full verification passed.
- [ ] Stream promotion, canary release, and installed update.

## plan

1. [x] Research, define focused regressions, and run red.
2. [x] Implement and regenerate the browser bundle.
3. [x] Prove model/state/adapter behavior and bundled browser layout.
4. [ ] Run strict review/verify, publish, release to canary, update and smoke this node.

## files changed

- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/tool-scope-authorization.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/inspector-state.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-styles.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/mcp-central-proxy-scope.test.ts`
- `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- `packages/os/tests/trace-site-inspector-reading.test.ts`

## key decisions

- Preserve vendor template/CSS bytes and add the OS-owned reading layer.
- Aggregate root usage once; count terminal failed operations without duplicate batch wrappers.
- Preserve missing database counts using additive token provenance flags.

## notes for ko

- Approved stream/trace-site and shipment. Canary release and installed update are pending.

## improvements noticed

- none yet

## errors i ran into

- Recovered dependency linking, a removed statusLabel helper, inherited viewport CSS sizing, and light-theme contrast. Exact evidence and recovery are recorded below.

---

## publish checklist

```bash
bun run task:push -- --message "type(trace-site): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/src/content/docs/observe/traces.mdx`
- `packages/os/definitely-missing.json`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/scripts/lib/verify-run-state.js`

## Approved scope and plan

Ko approved the compact trace inspector proposal, shipment, and stream/trace-site. Start from remote main; keep the existing table, branch navigation, live selection, JSON/Workpad modes, keyboard controls, and signed trace transport. Own only OS trace inspector presentation/model/state, focused regression tests, and the rebuilt inspector bundle. Preserve the frozen vendor visual shell; add an OS-owned style layer. Release through the stream review PR to the installed canary channel and update this node using the durable release tool.

Acceptance: remove redundant Completed/fact cards; compact selected-call identity with the existing plus status glyph; bound call rail width; Output/Input/Details tabs; adjacent short labels/values and full-width long payloads; system sans reading text and plain-zero code; explicit loaded-call scope, honest missing/estimated tokens, and nested failure counts without duplicate child rows. Preserve small-screen usability and no clipped formatted output.

Dependency graph: model metrics + state/payload view -> browser renderer + OS-owned style -> generated browser bundle/site builder -> unit and browser proof -> strict review/verify -> push -> stream PR -> canary release and local update.

## Test-first contract

Behavior under test: accurate recorded/estimated/unknown token counts; nested failure deduplication; active Output/Input/Details section persists across live updates; long payloads use all available content width while simple fields stay adjacent; readable compact inspector and safe HTML escaping.
Existing local pattern: Vitest pure model/state contracts in packages/os/tests/trace-site-inspector-interactions.test.ts and trace-site-inspector-os-owned.test.ts; site builder contracts in observability-traces-site.test.ts.
New tests: packages/os/tests/trace-site-inspector-reading.test.ts covering model/state/presentation behavior, plus a browser integration using the bundled runtime with synthetic trace data.
Focused red command: bun run --cwd packages/os test -- tests/trace-site-inspector-reading.test.ts
Expected red: missing tokenUsage/inspector view exports and section state/behavior.
No-test waiver: CSS appearance is verified in rendered browser screenshots and layout assertions; no tests mirroring individual CSS declarations.

## Current status

Task session tsk_854aac10b8e8; implementation complete, 76 focused trace tests and 8 recovery tests green, strict review clean, and all 10 full verification suites passed. Canary release/update remains. Installed canary version before work: 0.1.134.

- 2026-10-29 04:46:10 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`

## workspace-owned: files changed

- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/tool-scope-authorization.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/inspector-state.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-styles.ts`
- `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/mcp-central-proxy-scope.test.ts`
- `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- `packages/os/tests/trace-site-inspector-reading.test.ts`

## workspace-owned: activity log

- 2026-10-29 04:46:10 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 04:48:13 write: `packages/os/tests/trace-site-inspector-reading.test.ts`
- 2026-10-29 04:48:13 fs.write: `packages/os/tests/trace-site-inspector-reading.test.ts`
- 2026-10-29 04:48:24 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 04:48:24 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 04:48:56 apply-patch: `packages/os/scripts/lib/trace-site-inspector/model.ts`
- 2026-10-29 04:48:56 apply-patch: `packages/os/scripts/lib/trace-site-inspector/inspector-state.ts`
- 2026-10-29 04:50:03 write: `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- 2026-10-29 04:50:03 fs.write: `packages/os/scripts/lib/trace-site-inspector/reading-view.ts`
- 2026-10-29 04:53:18 write: `packages/os/scripts/lib/trace-site-inspector/reading-styles.ts`
- 2026-10-29 04:53:18 fs.write: `packages/os/scripts/lib/trace-site-inspector/reading-styles.ts`
- 2026-10-29 04:54:36 apply-patch: `packages/os/tests/trace-site-inspector-reading.test.ts`
- 2026-10-29 04:54:46 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 04:54:46 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 04:54:46 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- 2026-10-29 04:54:46 apply-patch: `packages/os/scripts/lib/trace-site-inspector/model.ts`
- 2026-10-29 04:57:24 write: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 04:57:24 fs.write: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 04:58:31 apply-patch: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 04:59:04 apply-patch: `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- 2026-10-29 05:00:14 apply-patch: `packages/os/tests/trace-site-inspector-reading.browser.test.ts`
- 2026-10-29 05:01:34 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:01:34 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:05:47 apply-patch: `packages/os/tests/trace-site-inspector-reading.test.ts`
- 2026-10-29 05:06:22 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:06:22 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:06:22 apply-patch: `packages/os/scripts/lib/trace-site-inspector/model.ts`
- 2026-10-29 05:07:27 apply-patch: `packages/os/scripts/lib/observability-traces-site.ts`
- 2026-10-29 05:07:27 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- 2026-10-29 05:09:37 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:09:37 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:15:20 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:15:48 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:16:29 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:18:53 fs.write: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 05:09:37 `checkFiles`: passed — OK
- 2026-10-29 05:10:04 apply-patch: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:10:12 `review.run`: passed — OK
### Full verification recovery
Full package verification completed at 05:12:22Z with two failed tests: central read-only classifier omits the three already-declared read-only PostHog tools; script inventory lacks the two new inspector modules and existing production-release-plan.ts. All other package tests passed and database guards passed. Current PostHog schema explicitly marks config/projects/query readOnly=true, mutating=false and capture mutating=true. Bounded required recovery: align only those three read-only classifier entries (capture stays execution-scoped), add a focused enforcement test, and register the three inventory entries. No tool implementation, OAuth grants, or provider behavior changes. A status call after the failed-result replay TTL relaunched verification; its old fingerprint will be discarded after these corrections and verification will run again against the final files.
The current manifest does not forward the legacy noDb flag, so full verification actually runs normal DB guards; these passed. The mapped public traces docs remain accurate and do not describe the old stacked inspector, so the non-blocking documentation opportunity is deferred.
- 2026-10-29 05:15:20 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:15:26 apply-patch: `packages/os/tests/mcp-central-proxy-scope.test.ts`
Recovery red confirmed: 3 expected failures across 8 tests (trc_d17ca3e24a44): current PostHog narrow read scopes absent, manifest classification mismatch, and inventory mismatch. The new explicit test also requires posthog.capture to stay mcp:call.
- 2026-10-29 05:15:48 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:15:49 apply-patch: `packages/os/scripts/lib/tool-scope-authorization.ts`
Verification recovery green: all 8 classifier/inventory tests passed (trc_62101366e493). Changes are exactly three existing read-only tool names, their explicit read-versus-capture enforcement test, and three inventory entries. No grant or tool implementation changed. Self-review of the source diff is complete. Rerun strict review and full verification against this final code fingerprint before publication.
- 2026-10-29 05:16:29 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
- 2026-10-29 05:16:36 `review.run`: passed — OK
- 2026-10-29 05:18:26 `verify`: passed — OK

- 2026-10-29 05:18:53 apply-patch: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
### Publish-ready evidence

Strict review is clean on the final file set (zero blocking findings). Full verification passed with a publish-valid stamp, trace trc_fcb7200f0027. All 10 selected suites passed, including the full OS package suite, OS trace gateway/history/redaction and request-budget contracts, Node SQLite compatibility, shell/session integration, parity audit, and normal database guardrails. No product behavior tests or verification gates were bypassed. Self-review and structured diff inspection complete; vendor template/CSS bytes remain unchanged. Publication proceeds through task PR #2662 -> stream/trace-site review PR -> exact-SHA canary release and local update.

- 2026-10-29 05:18:53 append: `.task/trace-site/make-trace-inspector-compact-readable-and-accurate/workpad.md`
