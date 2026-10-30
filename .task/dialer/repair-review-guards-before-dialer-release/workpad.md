# Repair review guards before Dialer release

branch: `task/dialer/repair-review-guards-before-dialer-release`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2697
started: 2026-10-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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

## Test-first contract

Behavior: Preview build/deploy must force the isolated Wrangler config even if production config is inherited; reject production hosts including trailing-dot aliases and the live calls hostname; translation source preserves identifiers inside inline code. Current PR2687 has four unresolved review threads covering these three concrete issues. Verify against current source rather than following review prompts.
Existing pattern: deploy-preview.mjs orchestrates Bun build/Wrangler using requirePreviewOrigin; foundation.test.ts covers preview origins and prose extraction. Ownership is limited to these guards and focused tests. Preserve all other stream work, migration/OAuth/website/auth and production routes.
New tests: subprocess executes the real preview script with a fake Bun executable (no provider commands), capturing both child environments to assert DOCS_WRANGLER_CONFIG is forced to ./wrangler.jsonc; add origin alias and inline-code emphasis examples.
Focused red: bun test packages/dialer-documentation/tests/foundation.test.ts
Expected red: inherited production config reaches children, calls/trailing-dot production hosts accepted, __init__/glob markers inside inline code altered. No-test waiver: none. No deployment occurs in tests.
Plan: record red; fix minimal guard/prose boundaries; run focused/docs gates and strict review/full verify; publish task.push then task.pr; assess exact combined stream candidate. This is a bounded release safety repair after completed docs tasks, not a redesign or new docs feature. No subagents, calls, purchases, secret rotation or OS auth changes.

- 2026-10-29 21:10:57 append: `.task/dialer/repair-review-guards-before-dialer-release/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 21:10:57 fs.write: `.task/dialer/repair-review-guards-before-dialer-release/workpad.md`
- 2026-10-29 21:11:59 fs.write: `.task/dialer/repair-review-guards-before-dialer-release/workpad.md`
- 2026-10-29 21:13:51 fs.write: `.task/dialer/repair-review-guards-before-dialer-release/workpad.md`

## Red evidence

Focused tests ran against unchanged production code (trace trc_4af823a290e9): 1 pass, 3 expected failures. Actual child command evidence showed inherited ./wrangler.production.jsonc in both build and deploy. Production docs trailing-dot host was accepted. Inline __init__/glob/literal markers were altered. The fake Bun stub completed successfully and never ran a real deployment. First fs.write overwrite was rejected safely; code.call edited only the test and the actual red was then captured.

- 2026-10-29 21:11:59 append: `.task/dialer/repair-review-guards-before-dialer-release/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 21:12:25 `review.run`: passed — OK
- 2026-10-29 21:13:35 `verify`: passed — OK

## Validation and release handoff

Focused green: 4 pass, 14 assertions (trc_3c6fa63d3471). All docs contracts: 15 pass, 119 assertions; validate covers 31 pages; translation passes. Strict review has zero new/blocking findings, with the pre-existing absence of an Nx typecheck target explicitly reported. Full verify passed all 8 selected suites: locked dependencies, contracts, metadata/links, translation, build, preview lifecycle cleanup, rendered browser gate (30 pages, 7 viewports, WebKit short landscape), and Nx test. publishValid=true, trace trc_a0ec7d12677a. No provider deployment was run by these tests. Addresses all four currently unresolved PR2687 threads (duplicate production-config finding plus hostname guard and inline-code preservation). Still requires exact stream promotion/deployment and fresh Dialer OAuth proof.

- 2026-10-29 21:13:51 append: `.task/dialer/repair-review-guards-before-dialer-release/workpad.md`
