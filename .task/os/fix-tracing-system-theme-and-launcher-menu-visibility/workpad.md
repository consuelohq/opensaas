# Fix Tracing system theme and launcher menu visibility

branch: `task/os/fix-tracing-system-theme-and-launcher-menu-visibility`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2254
started: 2026-08-28

## Acceptance criteria

- [x] The workspace launcher exposes every configured custom section, including owner-only `Internal → Users & installs`, without horizontal or vertical scrolling.
- [x] The launcher remains inside the viewport on the reported desktop size and uses compact 3–4 word descriptions.
- [x] Tracing follows the browser/device `prefers-color-scheme` value consistently with the launcher chrome.
- [x] Tracing declares matching light/dark theme metadata and does not remain visually dark when the media query is light.
- [x] Existing owner-route auth handoff and route visibility controls remain intact.
- [x] Existing trace live history and inspector behavior remain intact.
- [x] Workspace-specific edge publication rejects an identity that conflicts with the installed OS auth identity.

## Test-first contract

behavior under test: a configured custom launcher section must be visible without scrolling, Tracing body/chrome must share the system light/dark scheme, and edge publication must not replace the OS workspace identity with an unrelated app workspace ID.
existing local patterns: launcher/site generation tests plus the install edge publisher contract.
red evidence: launcher/theme run had 16 passes and 2 expected failures; publisher guard run had 7 passes and 1 expected failure.
green evidence: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/install-edge-site-publisher.test.ts tests/internal-launcher-regressions.test.ts tests/observability-traces-site.test.ts` → 26 passed, 0 failed.

## Scope coordination

The active `os/isolate-test-traces-and-clarify-session-observability` task may touch trace inspector JavaScript. This task owns only shared launcher CSS, Tracing theme composition/metadata, edge publication identity safety, and their focused tests; it does not change inspector model/runtime behavior.

## Current status

- Source regressions fixed and focused tests green.
- Local sites regenerated from this task branch.
- Corrected workspace-specific edge snapshot `sha256-8f27430a1085189d` published under canonical OS identity `workspace_internal`.
- D1 and its signed record now both use `workspace_internal` for `internal.consuelohq.com`.
- Downloaded R2 Tracing object matched SHA-256 `ec4d6a5fa0927f5398db193eab4d407c13d6a969231ea650fc4c1fa257d4ad27` and contained the system-theme, internal route, owner link, and three-column markers.
- Private route verification preserved the required `workspace_session_required` boundary.

## Files changed

- `.task/os/fix-tracing-system-theme-and-launcher-menu-visibility/workpad.md`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/internal-launcher-regressions.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`

## Key decisions

- Treat the stale Cloudflare snapshot as the primary UI incident; local regeneration alone cannot update what the authenticated browser receives.
- Keep owner-route authorization/handoff unchanged and publish the existing per-workspace launcher configuration.
- Use a three-column desktop launcher with visible overflow instead of clipped content or scrollbars.
- Preserve the vendor trace runtime and layer explicit system-theme metadata/CSS around it.
- Validate publisher inputs against `node/security/generated/auth.json` whenever an installed identity is present.

## Incident and recovery

- The first manual publish incorrectly used the Twenty workspace UUID `7d0894c1-bdb1-4dd6-9a00-78681b52d5f6`; the installed OS auth identity is `workspace_internal`. That mismatch caused successfully issued workspace sessions to be rejected and restarted the Google flow.
- Republished the same content-addressed snapshot under `workspace_internal`; D1 and R2 now agree with the installed auth identity.
- Added a failing-then-green publisher regression so this mismatch is rejected before any R2/D1 mutation.

## Notes for Ko

- The admin route and theme code had been generated locally, but the authenticated Cloudflare edge still pointed to the older snapshot.
- Future generic release snapshot refreshes remain a separate policy concern for workspace-specific launcher customizations; do not infer that a local `sites refresh` publishes Cloudflare state.

- 2026-08-29 00:07:28 write: `.task/os/fix-tracing-system-theme-and-launcher-menu-visibility/workpad.md`

## workspace-owned: files changed

- `.task/os/fix-tracing-system-theme-and-launcher-menu-visibility/workpad.md`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/internal-launcher-regressions.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`

## workspace-owned: activity log

- 2026-08-29 00:07:28 fs.write: `.task/os/fix-tracing-system-theme-and-launcher-menu-visibility/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 00:08:31 `review.run`: passed — OK
- 2026-08-29 00:08:41 `review.run`: passed — OK
- 2026-08-29 00:10:22 `verify`: passed — OK
- 2026-08-29 00:10:59 `verify`: passed — OK
