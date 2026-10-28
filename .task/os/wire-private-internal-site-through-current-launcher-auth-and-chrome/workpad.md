# Wire private internal Site through current launcher auth and chrome

## Acceptance criteria
- `consuelo.yaml` `launcher.extraSections` is rendered in the current shared workspace chrome route menu, not the retired onboarding launcher section list.
- Custom menu sections remain validated/sanitized, are workspace-local, and users without the overlay receive the stock menu unchanged.
- The existing `Internal / Users & installs` YAML entry reaches the private internal Site through a secure workspace handoff so an already authenticated user does not appear logged out on `internal.consuelohq.com` merely because workspace cookies are host-only.
- Internal Site access still requires the separate internal/operator authorization gate. Wrong-host, expired, replayed, unauthenticated, or unauthorized transitions fail closed.
- Browser workspace sessions do not authorize `/mcp`; MCP remains bearer/OAuth-only.
- The internal dashboard uses the same shared workspace window/chrome/border contract as Overview/Tracing/Configuration, including responsive and light/dark behavior.
- Astro remains the view/source layer where it fits the existing OS Site build precedent; Hono/Workspace Edge remains the authentication/data boundary. Do not introduce a second auth system.
- Existing YAML survives lifecycle update/restart and remains effective after Site materialization.
- Focused tests, relevant integration tests, verification, review, publish, and stream merge complete before reporting shipped.

## Plan
1. Resolve current Site snapshot publication, workspace chrome materialization, and the exact web-auth handoff/session flow.
2. Write red tests for current-menu YAML wiring, full cross-host handoff/session continuity, shared dashboard chrome/border, negative auth cases, and MCP separation.
3. Implement the smallest migration that feeds validated `launcher.extraSections` into the shared chrome and turns private-host navigation into the existing handoff model without weakening host-only cookies.
4. Rework the internal Site view to consume the shared chrome/frame and add/retain an Astro source contract while keeping live data/auth in the Hono/Workspace Edge path.
5. Run focused tests red to green, then relevant OS/website integration suites and verifier/review.
6. Publish PR #2139, merge to `stream/os`, and run non-destructive production smoke checks. Do not restart OS/Caddy as a debugging shortcut.

## Test-first contract
- `launcher-local-customization.test.ts`: RED until a YAML extra section appears in the current generated workspace route menu; assert it is absent when no overlay exists and remains escaped/safe.
- Workspace chrome test: RED until additional groups/links can be rendered into the shared dropdown without altering stock routes or allowing unsafe hrefs.
- Web auth / Workspace Edge integration: RED until an authenticated source session can transition to `internal.consuelohq.com`, consume a single-use audience-bound handoff, mint the internal host-only session, and load `/users` without a second Google approval; replay/wrong-host/unauthenticated cases fail.
- Internal dashboard integration: RED until dashboard HTML uses the shared workspace chrome/window frame and keeps CSS/JS/data behind the existing operator authorizer.
- Security regression: browser session never grants `/mcp`; existing bearer contract remains unchanged.
- Astro source/build contract: if a new internal Astro source is introduced, RED until it uses the shared OS design tokens/frame source and the runtime template is proven derived/compatible with it.

## Current findings
- Legacy `launcher.extraSections` is still parsed by `consuelo-home.ts` and preserved across lifecycle updates, but `launcher-onboarding.ts` is no longer the operational launcher root.
- Current root materialization is `sites.ts -> renderConfigurationSite('configuration')`; the current menu is `workspace-chrome.ts`.
- Current shared frame is `.workspace-window` plus `renderWorkspaceChromeBar(...)`; this is the border/chrome contract to reuse.
- Workspace session cookie is `__Host-consuelo_os_session`, intentionally host-only. Cross-host login continuity must use the existing handoff model rather than a shared-domain cookie.
- Internal dashboard already has a separate authorizer and live control-plane integration; preserve that second gate.
- `packages/consuelo-website/src/pages/os/launcher.astro` is a design/source artifact for the older launcher look; do not switch the operational launcher back to it.

- 2026-08-16 06:37:56 write: `.task/os/wire-private-internal-site-through-current-launcher-auth-and-chrome/workpad.md`

## files changed

- `packages/consuelo-website/src/components/os/InternalDashboardShell.astro`
- `packages/os/tests/internal-dashboard-astro-source.test.ts`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/workspace-chrome.test.ts`

## workspace-owned: files changed

- `packages/consuelo-website/src/components/os/InternalDashboardShell.astro`
- `packages/os/tests/internal-dashboard-astro-source.test.ts`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/workspace-chrome.test.ts`

## workspace-owned: activity log

- 2026-08-16 06:37:56 fs.write: `.task/os/wire-private-internal-site-through-current-launcher-auth-and-chrome/workpad.md`
- 2026-08-16 06:42:08 fs.write: `packages/os/tests/launcher-local-customization.test.ts`
- 2026-08-16 06:42:17 fs.write: `packages/os/tests/workspace-chrome.test.ts`
- 2026-08-16 06:43:06 fs.write: `packages/os/tests/internal-dashboard-astro-source.test.ts`
- 2026-08-16 06:49:50 fs.write: `packages/consuelo-website/src/components/os/InternalDashboardShell.astro`

## workspace-owned: files read

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/tests/website-structure.test.js`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/security/route-policies.ts`
- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/install-control-plane-cloudflare.test.ts`
- `packages/os/tests/internal-dashboard-integration.test.ts`
- `packages/os/tests/internal-user-dashboard.test.ts`
- `packages/os/tests/launcher-astro-source.test.ts`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/launcher-nodes-materialization.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/os-device-authority-architecture.test.ts`
- `packages/os/tests/os-universal-login.test.ts`
- `packages/os/tests/os-web-auth-contract.test.ts`
- `packages/os/tests/secrets-surface.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/trace-site-renderer.test.ts`
- `packages/os/tests/workspace-site-snapshot-publishing.test.ts`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.registry.json`

## workspace-owned: validation evidence

- 2026-08-16 06:55:26 `review.run`: passed — OK
- 2026-08-16 06:58:48 apply-patch: `packages/os/tests/os-device-authority-architecture.test.ts`
- 2026-08-16 07:02:29 apply-patch: `packages/os/tests/internal-user-dashboard.test.ts`
- 2026-08-16 07:02:29 apply-patch: `packages/os/tests/install-control-plane-cloudflare.test.ts`
- 2026-08-16 07:03:22 `review.run`: passed — OK

## Final summary
- The durable `launcher.extraSections` YAML contract now feeds the current shared workspace route menu instead of the retired onboarding launcher section list.
- The private `internal.consuelohq.com` menu destination is rewritten to a same-origin handoff start route. Device Authority validates the source host-only workspace session, issues a one-time audience-bound handoff for the private host, and `/auth/consume` mints a new host-only session there. No shared-domain cookie was introduced.
- The private dashboard now requires that internal-host workspace session before its existing operator authorizer. Root, pages, assets, API routes, and diagnostic reads fail closed without the browser session; operator denial remains a separate 403.
- `/mcp` authorization contracts were not changed and remain OAuth/bearer only.
- The internal dashboard now uses the same shared `.workspace-window` / workspace chrome shell as the current OS Sites. A non-routable Astro shell source was added for the view/design contract; live auth/data remains in Hono/Workspace Edge.

## Final files changed
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/internal-user-dashboard.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/security/route-policies.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/consuelo-website/src/components/os/InternalDashboardShell.astro`
- focused/source-contract tests under `packages/os/tests/`, including launcher customization, workspace chrome, universal login, internal dashboard integration, Device Authority architecture, and control-plane Cloudflare coverage.

## Key decisions
- Preserve `__Host-consuelo_os_session` host-only semantics; use handoffs for cross-host continuity instead of weakening cookie scope.
- Treat YAML menu configuration as data for the current shared chrome, not as a reason to resurrect the old launcher renderer.
- Allow handoff targets only for the private internal Site in both Workspace Edge and Device Authority.
- Keep internal/operator authorization as a second gate after workspace-session validation.
- Reuse shared runtime chrome/frame primitives and keep Astro as a view/source concern rather than introducing a second runtime auth stack.

## Green evidence
- TDD red run failed for the intended missing menu, handoff, session, shared-frame, and Astro-source behaviors before implementation.
- Focused auth/menu/dashboard run: 21/21 passed (`trc_d27a1db34e4e`).
- Final scoped regression set: 14 files, 93/93 passed (`trc_583d39d65073`).
- Managed-cloud/Device Authority contract selection: 14 files, 105/105 passed after updating the explicit route-policy contract (`trc_e9fd4dda265a`).
- Internal dashboard + control-plane direct regressions: 9/9 passed (`trc_be163763b583`).
- OS syntax/typecheck passed (`trc_983dc2cb5417`).
- Astro check passed with 0 errors and 0 warnings; only pre-existing hints (`trc_3bfe6ac29ce4`).
- Strict review against `origin/stream/os`: 0 blocking issues (`trc_040d68d9d51c`).

## Verification exception / issues encountered
- The outer `verify` facade twice surfaced the connector's generic connection error while normal OS calls remained healthy. Running the same verifier inside the task worktree proved the verifier itself was executing.
- Correct-base full verification against `origin/stream/os` passes review and DB guards but cannot write a publish-valid stamp because the repository-wide `@consuelo/os` package suite is red across many unrelated existing areas (`trc_a533106d3ab8`).
- Two package-wide failures that did touch this change were isolated and fixed: the explicit Device Authority route-policy expectation and older private-dashboard fixtures that intentionally bypassed workspace sessions. Both are green in the focused suites above.
- Publishing therefore uses Ko's explicit task approval plus the scoped green evidence and strict review, rather than weakening or bypassing the failing repository-wide tests in code.

- 2026-08-16 07:05:07 apply-patch: `.task/os/wire-private-internal-site-through-current-launcher-auth-and-chrome/workpad.md`