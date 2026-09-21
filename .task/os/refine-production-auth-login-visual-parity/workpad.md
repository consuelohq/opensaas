# refine production auth login visual parity

branch: `task/os/refine-production-auth-login-visual-parity`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1958/refine-production-auth-login-visual-parity
github pr: https://github.com/consuelohq/opensaas/pull/1958
started: 2026-08-14

## acceptance criteria

- [x] Remove the fixed bottom stripe from the universal auth shell.
- [x] Use the canonical Consuelo app icon alone in the top-left; no visible `Consuelo OS` lockup text.
- [x] Match Vercel's login start position across desktop/tablet/mobile while keeping onboarding layouts unchanged.
- [x] Tighten the login column/provider button to 320px / 40px and reduce the login heading to 28px.
- [x] Render the bottom Sign Up as blue, non-underlined text.
- [x] Task code is publish-valid and ready for the task→stream→main release path.

## plan

1. Measure live Vercel geometry and canonical Consuelo branding.
2. Pin a focused visual contract RED, then implement only the auth-shell presentation delta.
3. Render task source at 390×844, 1024×1461, and 1440×900 and compare computed geometry.
4. Run focused regression, strict review, full verify, publish, merge, release, and validate production.

## current status

- Implementation and task-source browser validation complete. Focused universal-login suite is 8/8 green, strict review is 0 blockers, and full verify is publish-valid. Publishing remains.

## files changed

- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/tests/os-universal-login.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 10:12:31 `verify`: failed — COMMAND_FAILED
- 2026-08-14 10:15:16 `review.run`: passed — OK
- 2026-08-14 10:15:29 `verify`: passed — OK
- 2026-08-14 10:15:48 `verify`: passed — OK
- 2026-08-14 10:16:51 `verify`: passed — OK

## key decisions

- Login geometry is login-specific via `auth-main--login`; workspace chooser/onboarding/provisioning retain the existing wider shell.
- Use the canonical app icon served by Consuelo's own website asset rather than keeping the invented C/OS monogram or duplicating the large generated SVG into the Worker source.
- Match Vercel's vertical start formula directly: `max(104px, calc(50svh - 296px))` produced y=126 at 390×844, y=434.5 at 1024×1461, and y=154 at 1440×900.

## notes for ko

- Vercel reference measurements: auth column 320px, provider button 40px, heading start y≈125.5/434/153.5 at the three tested viewports. Consuelo task render matches those starts within 0.5px while using a smaller 28px heading as requested.
- Operational follow-through after task publication: merge `stream/os` to `main`, dispatch the OS-only production release, then verify the public login and health endpoints before reporting done.

## improvements noticed

- none yet

## issues and recovery

- The local OS facade briefly dropped command-execution calls while read/browser/status calls remained healthy. No repo state was lost. The executor recovered; RED, GREEN, and the full focused test file then ran normally through `code.call`.
- The early full `verify --no-stamp` was intentionally run after the RED test edit and returned non-publishable before implementation; review/DB portions were clean. Final verify still required.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## discovery
- Compare live Vercel login geometry/typography against Consuelo production auth shell.
- Verify canonical Consuelo logo treatment from our live website/docs; do not invent a new lockup.
- Inspect the Device Authority universal login HTML/CSS and owning tests.
- Scope is presentation only: logo/header, card width/vertical placement, heading size, signup styling, and removal of the unexplained bottom stripe. Auth/session/onboarding contracts remain unchanged.

## Test-first contract
- Change type: visual/layout-only auth shell refinement.
- Existing coverage: os-universal-login static contract plus production browser verification.
- Test decision: add/update focused static assertions for semantic content/brand structure where stable; use browser screenshots + computed-style checks for exact layout.
- Expected RED: current shell contains a text lockup next to the mark, uses an underlined signup link, includes a fixed bottom brand stripe, and renders a wider/lower card than the reference.
- Provider boundary: no live Google login submission or account mutation during validation.

## workspace-owned: files read

- `packages/consuelo-website/public/favicon.svg`
- `packages/consuelo-website/public/images/home/consuelo-mark.svg`
- `packages/consuelo-website/public/images/logo/logo-white.svg`
- `packages/consuelo-website/public/images/logo/logo.svg`
- `packages/consuelo-website/scripts/generate-brand-assets.ts`
- `packages/documentation/public/favicon.svg`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/tests/os-universal-login.test.ts`

- 2026-08-14 10:15:05 apply-patch: `.task/os/refine-production-auth-login-visual-parity/workpad.md`

- 2026-08-14 10:15:39 apply-patch: `.task/os/refine-production-auth-login-visual-parity/workpad.md`

- 2026-08-14 10:16:43 apply-patch: `.task/os/refine-production-auth-login-visual-parity/workpad.md`
