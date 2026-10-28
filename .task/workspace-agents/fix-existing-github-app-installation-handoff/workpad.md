# fix existing GitHub App installation handoff

branch: `task/workspace-agents/fix-existing-github-app-installation-handoff`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2266
started: 2026-08-29

## acceptance criteria

- [ ] `Connect GitHub` securely authorizes the GitHub user before binding an installation.
- [ ] An already-installed Consuelo OS GitHub App can be connected without reinstalling it or manually changing repository access.
- [ ] A new installation still uses GitHub's repository-selection UI and returns to the requested Consuelo path.
- [ ] Device Authority rejects a spoofed `installation_id` that the authorized GitHub user cannot access.
- [ ] The one-time node-bound handoff remains opaque and single-use; GitHub user tokens are short-lived flow state only and are never returned to the browser/node or logged.
- [ ] The live GitHub App callback/setup configuration and Device Authority credentials are wired for the flow.
- [ ] Focused source-control tests, strict review, verify, deployed callback smoke, Canary release, and exact local Canary update pass.

## plan

1. Extend Device Authority GitHub App config with client ID/secret and a short-lived OAuth-backed connect state.
2. Start Connect GitHub at GitHub user authorization, then list installations accessible to that user. Reuse a single or uniquely owner-matching existing installation immediately; otherwise continue to GitHub installation selection.
3. Verify any post-install `installation_id` against the same GitHub user's accessible installations before creating the connection/handoff.
4. Keep repository discovery/token minting on GitHub App installation credentials; never persist a user token beyond the short connection flow.
5. Update the local gateway handoff contract/UI only as needed for the new authority URL shape.
6. Configure the live Consuelo OS GitHub App callback/setup settings and Device Authority secrets, then run the real existing-installation E2E.
7. Publish task -> stream, forward-port/release only the scoped fix to main if the stream review is broader, promote the immutable runtime to Canary, and update this Mac to that exact version.

## Test-first contract

behavior under test: Existing GitHub App installations reconnect through GitHub user authorization and are bound only when the authorized user can access the installation; new installations remain supported and spoofed installation IDs fail closed.
existing local pattern: `github-source-control.ts` owns one-time install state/connection/handoff, the GitHub source-control service owns App JWT/install token API calls, and `settings-hono-routes.test.ts` protects the local gateway handoff.
new or changed tests: `packages/os/tests/github-source-control-authority.test.ts` for existing-install reuse + authorized install callback + spoof rejection; `packages/os/tests/settings-hono-routes.test.ts` for the updated connect URL contract; config/runtime tests if the environment surface changes require them.
focused red command: `bun test packages/os/tests/github-source-control-authority.test.ts packages/os/tests/settings-hono-routes.test.ts`
expected red failure: current start response goes straight to `/apps/consuelo-os/installations/new`, there is no GitHub user OAuth callback, and the install callback accepts any App installation ID paired with a valid Consuelo state.
no-test waiver: not applicable.

## files changed

- none yet

## key decisions

- GitHub's current setup-URL contract warns that `installation_id` is spoofable and should be verified using a GitHub user access token; this fix follows that model rather than only toggling Redirect on update.
- OAuth is used only to prove which App installations the current GitHub user may access. Repository operations continue to use short-lived installation tokens minted from the App private key.

## notes for ko

- The screenshots prove the Consuelo OS GitHub App is already installed on `consuelohq` with all repositories. The failure is the Consuelo association handoff, not GitHub permissions.

## improvements noticed

- The browser facade still reproduces the shared-profile `SingletonLock` failure. This task will not broaden into that separate browser lifecycle repair unless it blocks the GitHub App configuration/E2E.

## errors i ran into

- `stream.context` and initial `session.start` calls hit the GitHub user's exhausted core API window. `stream.sync` succeeded; after the rate window reset, canonical `session.start` succeeded as task session `tsk_839f7d966d2e` / PR #2266.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): reconnect existing GitHub App installations" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-29 01:47:58 write: `.task/workspace-agents/fix-existing-github-app-installation-handoff/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 01:47:58 fs.write: `.task/workspace-agents/fix-existing-github-app-installation-handoff/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/workspace/scripts/browser.js`

- 2026-08-29 01:53:59 apply-patch: `packages/os/tests/github-source-control-authority.test.ts`

## workspace-owned: validation evidence

- 2026-08-29 01:54:42 `review.run`: passed — OK
- 2026-08-29 01:55:01 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- 2026-08-29 01:55:01 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`
- 2026-08-29 01:55:49 `review.run`: passed — OK
- 2026-08-29 01:57:34 `verify`: passed — OK
