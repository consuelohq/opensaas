# Ship compact readable trace inspector

branch: `task/trace-site-makeover/ship-compact-readable-trace-inspector`
stream: `stream/trace-site-makeover`
pr: https://github.com/consuelohq/opensaas/pull/2667
started: 2026-10-29

## acceptance criteria

- [x] Transfer exactly the 13 tested files and prove SHA-256 equality.
- [x] Preserve layout and metric behavior; 24 transfer tests passed.
- [ ] Strict review/full verification, stream promotion, canary release and installed update.

## plan

1. Tests first: reproduce red on current main.
2. Copy only the verified files and prove all source hashes match.
3. Revalidate, promote through the approved clean stream, release to canary, and smoke the installed update.

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

- Use the explicitly approved clean stream from current main; preserve the older stream.
- Carry only tested source files and no old task metadata.

## notes for ko

- Canary release and local update are authorized and pending clean-stream promotion.

## improvements noticed

- none yet

## errors i ran into

- Old stream conflicted; Ko approved the clean replacement. No outstanding source/test failures.

---

## publish checklist

```bash
bun run task:push -- --message "type(trace-site-makeover): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/definitely-missing.json`

## Approved recovery and Test-first contract

Ko approved stream/trace-site-makeover after the old stream hit 17 code conflicts. Preserve old stream and its sync worktree. Source task tsk_854aac10b8e8, PR #2662, tested SHA f6a5a61faa3ced2ea052163f935e8212effad6b5. Both source and this fresh task start from the same current main 1e282c8e8739cd858e2dc3cb03273212002868c5. Transfer only the 13 approved product/test files; no old task metadata or legacy stream code.

Behavior: identical approved compact header, narrow rail, Output/Input/Details, adjacent fields and full-width payloads, readable typography/plain zeros and contrast, honest token counts, deduplicated nested failures, preserved live/keyboard/JSON/Workpad/mobile navigation. Existing pattern: the three validated regression files. Tests were copied before production files. Red command: bun run --cwd packages/os test -- tests/trace-site-inspector-reading.test.ts. Expected missing reading-view module reproduced, trace trc_eeb9d256d959. Production transfer is now unblocked.

Original evidence: 76 focused trace tests (trc_ed0bd1654404), 8 gate-recovery tests (trc_62101366e493), clean strict review, and all 10 full verification suites with publish-valid stamp (trc_fcb7200f0027). Prior source workpad holds complete design/TDD/recovery history. Screenshots: /tmp/consuelo-trace-reading-review/trace-reading-{dark,light}-{width}.png.

## Current status

Clean task session tsk_7b9e65b06af7. Red reproduced. Copy ten remaining production/fixture files exactly, validate hashes, then rerun strict review and full verification. User authorized canary release and installed update; version before work 0.1.134.

- 2026-10-29 05:26:19 write: `.task/trace-site-makeover/ship-compact-readable-trace-inspector/workpad.md`

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

- 2026-10-29 05:26:19 fs.write: `.task/trace-site-makeover/ship-compact-readable-trace-inspector/workpad.md`
- 2026-10-29 05:27:19 write: `.task/trace-site-makeover/ship-compact-readable-trace-inspector/workpad.md`
- 2026-10-29 05:27:19 fs.write: `.task/trace-site-makeover/ship-compact-readable-trace-inspector/workpad.md`
- 2026-10-29 05:30:17 fs.write: `.task/trace-site-makeover/ship-compact-readable-trace-inspector/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 05:27:29 `review.run`: passed — OK
- 2026-10-29 05:29:54 `verify`: passed — OK

### Clean-stream publish evidence

Strict review passed with zero blocking issues. All 10 full verification suites passed with a publish-valid stamp, trace trc_0ca4279cfd07, including the complete OS package suite and normal DB guardrails. The exact 13 tested file hashes remain unchanged from the first verified task. Publish via #2667 -> stream/trace-site-makeover -> main, then use durable canary release with local update. Prior conflicted task/stream remains preserved and will be marked superseded after replacement publication.

- 2026-10-29 05:30:17 append: `.task/trace-site-makeover/ship-compact-readable-trace-inspector/workpad.md`
