# add browser responsive flags

branch: `task/workspace-agents/add-browser-responsive-flags`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/397
started: 2026-05-13

## acceptance criteria

- [x] Add repo-level agent-browser config with persistent profile, deterministic downloads, content boundaries, output cap, no auto-dialog, and stable light color scheme.
- [x] Add responsive/mobile/tablet support as flags on existing browser tools, not new tool names.
- [x] Support common responsive flags: preset, device, provider, width, height, and colorScheme.
- [x] Keep Google auth as a manual persistent-profile flow; do not add broad auth profiles or secrets.
- [x] Do not implement action policy or doctor checks.
- [x] Regenerate docs/types and validate.

## implementation plan

1. Read browser wrapper, facade schemas, manifest, and SCRIPTS docs.
2. Add `agent-browser.json` repo config.
3. Extend `browser.js` option parsing and page setup flags.
4. Extend existing facade schemas and manifest entries for browser open/test/app/consuelo/screenshot.
5. Regenerate generated docs/types and run focused validation.
6. Push and promote through stream review PR.

## files changed

- `agent-browser.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/browser.js`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tooling/tool-manifest.json`

## key decisions

- Use flags on existing tools instead of adding `browser.mobile`/`browser.tablet` tool names.
- `preset` maps common values to device/viewport defaults: mobile/iphone => iPhone 16 Pro, tablet/ipad => iPad Pro 11, desktop => 1440x900 viewport.
- Keep `provider` optional; use `provider: "ios"` only when explicitly testing iOS simulator flows.
- Google SSO setup is manual: open accounts.google.com with the persistent profile and sign in visibly; do not store credentials in repo or chat.

## validation

- `node --check packages/workspace/scripts/browser.js` — passed.
- `bun run generate-types` — passed; regenerated `packages/workspace/src/generated/workspace.d.ts`.
- `bun run generate-docs` — passed; regenerated `packages/workspace/TOOLS.md`.
- `cd packages/workspace && bun run test tests/facade/facade.test.ts -u` — passed; 498 tests passed and snapshots updated.
- `cd packages/workspace && bun run test tests/facade/facade.test.ts` — passed; 498 tests passed.
- Runtime smoke: `bun run browser -- open https://example.com --preset mobile --full` — passed; captured `/tmp/opensaas-screenshots/example.com-2026-05-13T10-28-33.png` and reported `preset=mobile device=iPhone 16 Pro`.
- Runtime smoke: `bun run browser -- open https://example.com --preset tablet --full` — passed; captured `/tmp/opensaas-screenshots/example.com-2026-05-13T10-28-56.png` and reported `preset=tablet device=iPad Pro 11`.
- Runtime smoke: `bun run browser -- screenshot responsive-desktop --preset desktop --full` — passed; captured `/tmp/opensaas-screenshots/responsive-desktop-2026-05-13T10-28-34.png` and reported `preset=desktop viewport=1440x900`.
- Schema smoke — passed; `BrowserOpenInput` accepts presets and complete width/height, rejects width without height; `BrowserScreenshotInput` accepts tablet preset.
- `checkFiles` for `browser.js` and `schemas.ts` — passed.
- `audit { scripts: true }` — passed; 48 documented scripts, 48 actual scripts, no missing/undocumented scripts.
- `review.run { base: "origin/stream/workspace-agents", noTests: true }` — passed.
- `verify { base: "origin/stream/workspace-agents", noReview: true, noDb: true }` — passed.

## notes for Ko

- No action policy or doctor checks are included by request.
