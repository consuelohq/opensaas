# DEV-1631 Dialer docs foundation

branch: `task/dialer/dev-1631-dialer-docs-foundation`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2682
started: 2026-10-29

## acceptance criteria

- [x] Preview deploy requires an isolated HTTPS DOCS_SITE_URL and emits matching canonical/Open Graph/sitemap metadata plus noindex.
- [x] Translation strips supported inline emphasis/code markers while preserving SDK package-name punctuation.
- [x] Arabic translation panel uses RTL; switching languages restores LTR/source presentation.
- [x] Astro preview browser tests stop the owned runtime after successful and failing runs, preserving unrelated occupied ports.
- [x] Preserve public OS-to-Dialer docs redirects and current production domains; no deployment or main merge.

## plan

1. Read package guidance, re-audit current source, and preserve the paused WIP.
2. Exercise focused red/green contracts, then package validation and translation tests.
3. Build with an isolated preview URL, verify browser and lifecycle regressions, run strict review/full verify.
4. Push and promote to stream/dialer only; hand off final integration to coordinator.

## files changed

- `packages/dialer-documentation/scripts/deploy-preview.mjs`
- `packages/dialer-documentation/scripts/lib/preview-deploy.mjs`
- `packages/dialer-documentation/scripts/lib/preview-server.mjs`
- `packages/dialer-documentation/scripts/test-preview-lifecycle.mjs`
- `packages/dialer-documentation/tests/foundation.test.ts`

## key decisions

- none yet

## notes for ko

- Resumed existing managed task session tsk_761485f66b70 without resetting WIP.
- Confirmed remote main efa6ca8763d734e634268bb069bbbe4c43ad73e4 and stream d267219442e114867e6b25f297a00d94f552b32c before publication.
- Local tests use docs-preview.example.test solely as a fixture origin; no live Worker, domain, or carrier operations.

## improvements noticed

- none yet

## errors i ran into

- Browser test initially failed with Miniflare SQLITE_BUSY when lifecycle and browser suites ran concurrently against the same local state; sequential rerun passed. Keep these tests serialized.
- Astro emitted pre-existing route-priority warnings for legacy OS docs redirect paths during preview build; the build finished successfully and rendered tests verified intended redirects.

## Final validation evidence (2026-10-29)

- `bun test packages/dialer-documentation/tests/foundation.test.ts`: 2 passing.
- `bun run --cwd packages/dialer-documentation validate`: 31 Dialer pages and destinations validated.
- `bun run --cwd packages/dialer-documentation test`: 8 tests passing, 97 assertions.
- `bun run --cwd packages/dialer-documentation test:translation`: passing.
- `DOCS_SITE_URL=https://docs-preview.example.test PUBLIC_DOCS_PREVIEW=1 bun run --cwd packages/dialer-documentation build`: passing; isolated generated metadata/noindex inspected through browser.
- `bun scripts/test-preview-lifecycle.mjs`: passing, including occupied unrelated port and both pass/failure cleanup.
- `DOCS_TEST_PORT=44197 DOCS_SITE_URL=https://docs-preview.example.test PUBLIC_DOCS_PREVIEW=1 bun run test:browser`: passing Chromium seven-viewport suite and WebKit short-landscape, 30 pages, redirects, translation and metadata; trace trc_ae0c3334bd8e.
- TDD note: resumed a paused existing WIP that already contained tests and implementation. The original focused-red receipt is not retained; do not claim one.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.agents/skills/nx-run-tasks/SKILL.md`
- `packages/dialer-documentation/AGENTS.md`
- `packages/dialer-documentation/AUTHORING.md`
- `packages/dialer-documentation/CLAIM-LEDGER.md`
- `packages/dialer-documentation/README.md`
- `packages/dialer-documentation/astro.config.mjs`
- `packages/dialer-documentation/package.json`
- `packages/dialer-documentation/scripts/deploy-preview.mjs`
- `packages/dialer-documentation/scripts/lib/documentation-browser-test.mjs`
- `packages/dialer-documentation/scripts/lib/preview-deploy.mjs`
- `packages/dialer-documentation/scripts/lib/preview-server.mjs`
- `packages/dialer-documentation/scripts/test-browser.mjs`
- `packages/dialer-documentation/scripts/test-preview-lifecycle.mjs`
- `packages/dialer-documentation/src/components/translation/RuntimeLanguageSelect.astro`
- `packages/dialer-documentation/src/lib/translation/text.ts`
- `packages/dialer-documentation/tests/foundation.test.ts`

## Acceptance and plan

Re-audited current remote main 7706be452f9bd98c392762178829191d32fddeae and stream d267219442e114867e6b25f297a00d94f552b32c. All four findings remain: deploy:preview is unguarded, text.ts retains inline markers, panel lacks dir, and preview cleanup skips an exited launcher. Preserve legacy redirects, production origins, OS docs, unrelated work and source social card.

1. Add focused regressions, observe red, implement preview-origin guard/noindex, safe plaintext normalization and Arabic panel direction.
2. Use the Astro supported preview stop lifecycle; prove owned-port cleanup on success/failure and refusal of an occupied port.
3. Run package/translation/build/rendered matrix plus strict review/full verify; publish task then stream, leave in review for coordinator integration.

## Test-first contract

Behavior: preview deploy rejects absent/production/invalid origins; preview build metadata agrees with configured origin and remains noindex; supported inline markup renders as plaintext; Arabic panel is RTL and language changes restore direction; owned preview ports are cleaned after pass and failure.
Pattern: Bun tests in tests/, fixture translation requests in browser suite, shared browser helper.
New tests: foundation.test.ts for preview/text/lifecycle; fixture language transitions and preview metadata assertions in test-browser.mjs.
Focused red: bun test packages/dialer-documentation/tests/foundation.test.ts.
Expected red: missing preview helper and literal inline markup. No-test waiver: none.

- 2026-10-29 18:44:29 append: `.task/dialer/dev-1631-dialer-docs-foundation/workpad.md`

## workspace-owned: files changed

- `packages/dialer-documentation/scripts/deploy-preview.mjs`
- `packages/dialer-documentation/scripts/lib/preview-deploy.mjs`
- `packages/dialer-documentation/scripts/lib/preview-server.mjs`
- `packages/dialer-documentation/scripts/test-preview-lifecycle.mjs`
- `packages/dialer-documentation/tests/foundation.test.ts`

## workspace-owned: activity log

- 2026-10-29 18:44:29 fs.write: `.task/dialer/dev-1631-dialer-docs-foundation/workpad.md`
- 2026-10-29 18:44:45 write: `packages/dialer-documentation/tests/foundation.test.ts`
- 2026-10-29 18:44:45 fs.write: `packages/dialer-documentation/tests/foundation.test.ts`
- 2026-10-29 18:45:22 write: `packages/dialer-documentation/scripts/lib/preview-deploy.mjs`
- 2026-10-29 18:45:22 fs.write: `packages/dialer-documentation/scripts/lib/preview-deploy.mjs`
- 2026-10-29 18:45:23 write: `packages/dialer-documentation/scripts/deploy-preview.mjs`
- 2026-10-29 18:45:23 fs.write: `packages/dialer-documentation/scripts/deploy-preview.mjs`
- 2026-10-29 18:45:24 write: `packages/dialer-documentation/scripts/lib/preview-server.mjs`
- 2026-10-29 18:45:24 fs.write: `packages/dialer-documentation/scripts/lib/preview-server.mjs`
- 2026-10-29 18:46:15 write: `packages/dialer-documentation/scripts/test-preview-lifecycle.mjs`
- 2026-10-29 18:46:15 fs.write: `packages/dialer-documentation/scripts/test-preview-lifecycle.mjs`
- 2026-10-29 19:48:50 apply-patch: `.task/dialer/dev-1631-dialer-docs-foundation/workpad.md`
- 2026-10-29 19:50:46 fs.write: `.task/dialer/dev-1631-dialer-docs-foundation/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 19:49:05 `review.run`: passed — OK
- 2026-10-29 19:49:25 apply-patch: `packages/dialer-documentation/scripts/test-preview-lifecycle.mjs`
- 2026-10-29 19:49:43 apply-patch: `packages/dialer-documentation/scripts/lib/documentation-browser-test.mjs`
- 2026-10-29 19:50:08 `review.run`: passed — OK
- 2026-10-29 19:51:07 `verify`: passed — OK

## Review closure and red/green evidence

- Added invalid-port startup diagnostic regression to `scripts/test-preview-lifecycle.mjs`: observed expected RED (trace trc_28403249fa77), then added bounded port validation and explicit async startup catch in `scripts/lib/documentation-browser-test.mjs`.
- Re-ran lifecycle: green, including occupied-port refusal and pass/failure stop. No owned `preview-server.mjs` processes and test port 44197 was free afterward.
- Re-ran rendered browser after code change: Chromium 7 viewports, WebKit landscape, metadata and RTL passed (trace trc_27ce4ce91e94).
- `review.run` strict after change: zero blocking findings, one pre-existing Nx configuration note (`no projects with 'typecheck' target found`). Not related to task source.
- Keep Miniflare lifecycle/browser checks sequential to avoid SQLite state lock; original parallel run and recovered success recorded above.

- 2026-10-29 19:50:46 append: `.task/dialer/dev-1631-dialer-docs-foundation/workpad.md`
