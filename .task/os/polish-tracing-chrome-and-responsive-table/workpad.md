# Polish tracing chrome and responsive table

branch: `task/os/polish-tracing-chrome-and-responsive-table`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2041/polish-tracing-chrome-and-responsive-table
github pr: https://github.com/consuelohq/opensaas/pull/2041
started: 2026-08-15

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Reproduce the screenshots against the generated Trace Burn surface and measure the actual mobile/tablet/desktop geometry.
2. Add focused regression assertions before production edits.
3. Fix only the Trace Burn -> shared-shell integration seams plus the compact inspector layout; preserve vendor visual assets and existing data behavior.
4. Validate the table, dropdown, frame, far-right column, and selected inspector at phone/tablet/desktop sizes; run focused trace contracts, syntax, strict review, and formal verify.
5. Publish to `stream/os`, sync the stream with `main`, and merge the stream review PR because Ko explicitly requested shipping all the way.

## current status

- Implementation and validation are complete. Focused trace contracts, browser geometry checks, syntax, strict review, and formal verify are green. Ready to publish to the stream and then main.

## files changed

- `packages/os/assets/vendor/observability-traces-v38/inspector.js` (rebuilt generated runtime only)
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/observability-traces-site.test.ts`

## workspace-owned: files changed

- Same source/test files above; the generated `inspector.js` was rebuilt from the OS-owned browser source with the existing package script.

## workspace-owned: activity log

- 2026-08-15 07:18:15 fs.write: `.task/os/polish-tracing-chrome-and-responsive-table/workpad.md`

## workspace-owned: validation evidence

- Focused RED for the missing responsive/detail contracts: `trc_6b66d24aa792`.
- Focused Trace Burn regression GREEN: 10/10 (`trc_2fc7835f5918`).
- Trace gateway/Trace Burn selected contracts: 7 files / 48 tests plus runtime boundary 3/3 passed (`trc_d48eb38fb7d6`).
- OS syntax checks passed (`trc_c12b03c8769c`).
- Selector check maps this change to the critical Trace Burn + internal workspace shell rules (`trc_f56efb578684`).
- Mobile dark, 402px: page width remains 402px, shell is exactly viewport width, shell rows are only chrome + content, table header is one 34px row, Cost is fully reachable, menu center is exactly 201px and shows the complete route descriptions (`trc_b47acae81620`).
- Mobile selected trace, 402px: body is one 402px column; detail rail right edge is 402px, inspector right edge 391px, close button right edge 381px, and Cost remains fully reachable (`trc_770d1a4f2498`).
- Desktop dark, 1440px: complete 18px rounded frame is inset 14px on both sides, body starts immediately below the 38px chrome, document has no horizontal overflow, and Cost is fully reachable (`trc_f99f6afd7e15`).
- iPad-sized 1024x1366: document width stays 1024px, the complete frame stays inset, and Cost is fully reachable at max table scroll (`trc_aacadf257b19`).
- 2026-08-15 07:30:11 `review.run`: passed — OK
- 2026-08-15 07:30:37 `verify`: passed — OK
- 2026-08-15 07:31:28 `verify`: passed — OK

## key decisions

- Keep the v38 visual shell assets intact; fix the integration via a small OS-owned style layer and the OS-owned inspector browser runtime.
- Treat `aria-hidden="false"` as the actual visible-state contract instead of activating the legacy `.open` selector wholesale; this avoids re-enabling unrelated retired modal rules.
- On <=760px, the inspector runtime no longer writes a minimum 420px third grid column. The table remains full-width and the selected inspector becomes the existing bottom-sheet pattern within the viewport.
- Preserve one normal shared-chrome separator; remove the stale 50px toolbar row that created the apparent extra divider/gap below chrome.

## notes for ko

- The visible route menu now reads `Inspect live traces and tool execution.` rather than the confusing legacy `Live agent` wording.
- No Trace Burn data model, filters, row rendering, colors, trace history transport, or gateway/auth behavior was redesigned.

## improvements noticed

- The generated tracing runtime's mobile layout had been keyed to `.open`, while the current OS runtime actually exposes the surface through `aria-hidden="false"`. Future responsive overrides should key from the actual runtime state rather than old vendor modal state.

## issues and recovery

- A broad manual shell run passed 90/91 tests but the unrelated `local-agent-connectivity` per-agent verification assertion failed again (`trc_3aef8ac6bcc3`, `trc_5c9eefe6476d`). This task does not change that file/path. The exact Trace Burn suites, syntax, strict review, and formal publish verification are green; `verify` is `publishValid=true` (`trc_57e709cb8ee3`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Tracing keeps the existing Trace Burn content and interaction design, but the shared workspace chrome owns the full outer frame consistently with Overview/Tools/Nodes/Secrets; no legacy "Live agent" control leaks into or behind the chrome; the legacy Tool/Latency/Tokens header band does not add a duplicate border below the chrome; the trace table/detail surfaces stay bounded to the viewport at phone, iPad, and desktop sizes, with the far-right columns/actions reachable instead of being clipped by the page/window overflow.
existing local pattern: `packages/os/tests/observability-traces-site.test.ts` protects generated Trace Burn HTML and the shared workspace shell contracts; browser verification uses the generated page at mobile/tablet/desktop widths.
new or changed tests: extend `observability-traces-site.test.ts` with structural/CSS assertions for full-frame chrome ownership, removal/hiding of the legacy live-agent/header strip, no duplicate top border, and a viewport-bounded horizontal-scroll contract for the trace grid/detail pane.
focused red command: `bun --cwd packages/os test tests/observability-traces-site.test.ts`
expected red failure: current Trace Burn CSS still lets the canonical table grid establish page-level minimum width/clipping, retains the legacy live-agent/header band under the shared chrome, and the shared chrome is not the complete outer frame.
no-test waiver: not applicable.

## Acceptance criteria

- [x] Preserve current Trace Burn data, filters, row/detail behavior, colors, and existing redesign work; this is integration polish, not a redesign.
- [x] Shared workspace chrome visually forms the same complete rounded outer window/frame as the other internal pages.
- [x] Remove the visible/overlapping legacy `Live agent` control from the tracing top region.
- [x] Remove the extra border/separator immediately below the shared top chrome/header area.
- [x] On phone, iPad, and desktop, the trace table cannot enlarge the page viewport; it scrolls/clips within its own bounded surface and the far-right columns remain reachable.
- [x] Mobile Tool / Latency / Tokens header treatment no longer blows out the layout.
- [x] The detail drawer/panel and its close control do not cut off the right edge of the table/page.
- [x] Focused regression test, browser checks at mobile/tablet/desktop, strict review, and formal verify pass.
- [ ] Ship through the task -> stream lifecycle, then ship `stream/os` to `main` because Ko explicitly asked to ship it all.

- 2026-08-15 07:18:15 append: `.task/os/polish-tracing-chrome-and-responsive-table/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/observability-traces-site.test.ts`

- 2026-08-15 07:31:06 apply-patch: `.task/os/polish-tracing-chrome-and-responsive-table/workpad.md`
