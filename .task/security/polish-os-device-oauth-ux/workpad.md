# polish os device oauth ux

branch: `task/security/polish-os-device-oauth-ux`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1276/polish-os-device-oauth-ux
github pr: https://github.com/consuelohq/opensaas/pull/1276
started: 2026-06-29

## acceptance criteria

- [x] Device sign-in page uses a Grok-like split layout with Consuelo OS branding, code confirmation, Google continuation, and a black right visual pane.
- [x] Device sign-in page is standalone transactional UI, not the marketing/launch layout, so cookie/banner chrome does not appear.
- [x] Google OAuth device approval callback has a distinct authorized state and failed state with terminal-return copy.
- [x] Cloudflare OS device authority fallback page matches the same sign-in/authorized/failed visual language.
- [x] Installer device OAuth step shows a stronger Clack prompt, copies the verification URL on macOS when possible, and includes a clickable terminal link plus full URL fallback.
- [x] Contract tests and focused verification cover the changed OAuth flow surfaces.

## plan

1. Read the website, OS device worker, Google auth callback, installer prompt, and relevant tests.
2. Replace the Astro device sign-in page with a standalone split auth document.
3. Align the Google callback and Cloudflare fallback pages with the same authorized/failed states.
4. Improve the Clack installer prompt with clipboard copy, OSC 8 link, code, and fallback URL.
5. Update focused contracts and verify with tests, build, and browser screenshots.

## current status

- Implementation complete locally in task worktree.
- Focused tests, OS syntax/typecheck, Astro build, and browser desktop/mobile checks pass.
- Workspace review clean for this change; full verify is blocked by pre-existing `twenty-server` typecheck/test failures on `stream/security`.

## files changed

- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/twenty-server/src/engine/core-modules/auth/controllers/google-auth.controller.ts`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/scripts/install.ts`
- `packages/os/tests/oauth-device-page-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: files changed

- `.task/security/polish-os-device-oauth-ux/current.json`
- `.task/security/polish-os-device-oauth-ux/session.json`
- `.task/security/polish-os-device-oauth-ux/workpad.md`
- `.task/tasks/security/polish-os-device-oauth-ux.json`

## workspace-owned: activity log

- Started task branch from `stream/security` with PR 1276.
- Read `CODING-STANDARDS.md` and website design guidance before editing.
- Confirmed `stream/security` has the older website design structure; edited within that branch instead of pulling newer main-only files.
- Removed inherited launch layout from `/login/device` after visual verification showed a cookie banner on the transactional auth page.

## workspace-owned: validation evidence

- `bun --cwd packages/os test tests/oauth-device-page-contract.test.ts tests/os-device-authority-worker.test.ts` passed: 2 files, 12 tests.
- `cd packages/os && bun run typecheck` passed: workspace script syntax checks.
- `cd packages/consuelo-website && bun run build` passed: 0 errors, 0 warnings, 26 pre-existing hints in unrelated files.
- Browser desktop check at `http://127.0.0.1:3000/login/device/?user_code=D6AHW4PE` passed: code hydrated as `D6AH-W4PE`, approval href included `osDeviceUserCode=D6AHW4PE`, no cookie buttons, no text overlaps.
- Browser mobile check passed on iPhone 16 Pro preset: code hydrated, no horizontal overflow, no cookie buttons.
- `review.run` passed for this change with 0 owned issues; it reports pre-existing `twenty-server` typecheck/test failures.
- `verify --no-stamp` failed because the selected `twenty-server` suite has existing failures/snapshot drift; DB guard passed.
- Screenshots captured at `/tmp/opensaas-screenshots/127.0.0.1-2026-06-29T21-16-16.png` and `/tmp/opensaas-screenshots/127.0.0.1-2026-06-29T21-16-19.png`.
- 2026-06-29 21:19:32 `review.run`: passed — OK
- 2026-06-29 21:21:17 `review.run`: passed — OK
- 2026-06-29 21:23:29 `verify`: failed — COMMAND_FAILED
- 2026-06-29 21:24:56 `review.run`: passed — OK

## key decisions

- Used a standalone Astro document for `/login/device` because auth pages should not inherit marketing navigation, analytics layout chrome, or cookie prompts.
- Kept code and background mark in monospace, but moved page copy and buttons to sans typography to match the Grok reference more closely.
- Kept button radius at 8px to stay inside existing design rules while preserving the dark full-width command shape.
- Used macOS `pbcopy` only when available; non-macOS terminals still get the clickable link and full URL fallback.

## notes for ko

- The actual Google approval flow still goes through `https://app.consuelohq.com/auth/google?action=os-device-approval&osDeviceUserCode=...`.
- The authorized callback page now says `Device authorized` and tells the user to return to the terminal.

## improvements noticed

- The website build still has unrelated Astro hints in existing files (`content.config.ts`, launch components, SEO scripts). Left untouched.

## issues and recovery

- First browser screenshot exposed cookie banner leakage from `LaunchLayout`; fixed by making `/login/device` standalone.
- Initial OSC 8 terminal link helper was over-escaped; corrected to runtime Unicode escapes and reverified syntax.
- Review flagged missing local error handling in the async prompt helper; added fallback URL logging and reran OS checks/review.

---

## publish checklist

```bash
bun run task:push -- --message "feat(security): polish OS device oauth UX" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/security/polish-os-device-oauth-ux/current.json`, `.task/security/polish-os-device-oauth-ux/session.json`, `.task/security/polish-os-device-oauth-ux/workpad.md`, `.task/tasks/security/polish-os-device-oauth-ux.json`, `packages/consuelo-website/src/pages/login/device.astro`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/install.ts`, `packages/os/tests/oauth-device-page-contract.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/twenty-server/src/engine/core-modules/auth/controllers/google-auth.controller.ts`
- matched rules: `twenty-server-project`, `auto:twenty-server:test`
- selected suites: `twenty-server affected test target`
- run results: `twenty-server affected test target` failed
- failed suites: `twenty-server affected test target`
