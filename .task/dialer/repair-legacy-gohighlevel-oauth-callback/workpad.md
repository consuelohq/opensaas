# repair legacy gohighlevel oauth callback

branch: `task/dialer/repair-legacy-gohighlevel-oauth-callback`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2622/repair-legacy-gohighlevel-oauth-callback
github pr: https://github.com/consuelohq/opensaas/pull/2622
started: 2026-10-08

## acceptance criteria

- [ ] Wet Stone can complete a fresh Marketplace install/update without the legacy `consuelohq.com/calls/api/integrations/oauth/callback` returning 404.
- [ ] The compatibility path forwards the complete OAuth query string to the current `calls.consuelohq.com` callback without exposing the authorization code.
- [ ] The resulting installation is active for Wet Stone and the embedded Dialer can create an embed session.
- [ ] Contacts, opportunity search, pipelines, and queue preview all load successfully after reinstall.
- [ ] No carrier call is placed during the smoke.
- [ ] The fix preserves the shared Mercury LIVE Marketplace registration and existing installs.

## plan

1. Recover the prior legacy-callback compatibility implementation and compare it with the current production callback contract.
2. Prove the current route is absent/failing with a focused source contract before restoring it.
3. Restore the smallest compatibility route targeting the current `calls.consuelohq.com` edge and validate static build/query forwarding.
4. Deploy the website compatibility route, then rerun the exact Wet Stone Marketplace update/install.
5. If HighLevel returns a code-only callback, validate whether the backend can complete it safely; do not invent state or bypass installation ownership.
6. Finish with Contacts/Opportunities/queue smoke and no carrier call.

## Test-first contract

behavior under test: `/calls/api/integrations/oauth/callback` must exist on the public website and forward the untouched browser query string with `location.replace` to the current production callback at `https://calls.consuelohq.com/api/lead-connector-embed/auth/callback`.

existing local pattern: historical commit `0798d024bd` implemented this exact static Astro compatibility bridge with a source/VM contract; current branch no longer contains the route.

new or changed tests: restore/update `packages/consuelo-website/tests/leadconnector-oauth-callback.test.mjs` against the current production callback host.

focused red command: `bun test packages/consuelo-website/tests/leadconnector-oauth-callback.test.mjs`

expected red failure: callback Astro route is absent on the current branch.

no-test waiver: not applicable.

## current status

- DEV-1619 queue-loading regression is already repaired in production: current Wet Stone opportunity search and queue preview both return HTTP 200.
- Previous task #2621 deployed the `calls.consuelohq.com/api/lead-connector-embed/auth/callback` edge rewrite and aligned Railway `LEADCONNECTOR_REDIRECT_URI`; Cloudflare and Railway are healthy.
- Exact fresh-install/update smoke then exposed the remaining blocker: HighLevel redirected to `https://consuelohq.com/calls/api/integrations/oauth/callback?code=...`, which currently returns 404.
- Historical commit `0798d024bd` contains the intended static compatibility route, but it was lost from the current website tree.
- HighLevel's current public OAuth documentation confirms Marketplace installs redirect with an authorization `code`; `state` is not guaranteed for this Marketplace-driven path. The existing canonical backend callback currently requires both code and state, so installation completion must be verified after restoring the public bridge rather than assumed.

## files changed

- `packages/consuelo-website/src/pages/calls/api/integrations/oauth/callback.astro`
- `packages/consuelo-website/tests/leadconnector-oauth-callback.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-website/src/pages/calls/api/integrations/oauth/callback.astro`
- `packages/consuelo-website/tests/leadconnector-oauth-callback.test.mjs`

## workspace-owned: activity log

- 2026-10-08 15:39:36 fs.write: `packages/consuelo-website/tests/leadconnector-oauth-callback.test.mjs`
- 2026-10-08 15:39:51 fs.write: `packages/consuelo-website/src/pages/calls/api/integrations/oauth/callback.astro`

## workspace-owned: validation evidence

- none yet

## key decisions

- Restore compatibility at our public website instead of changing the shared LIVE Marketplace app registration.
- Never synthesize or bypass OAuth state. If the Marketplace callback remains code-only after the 404 is fixed, handle that as a separate explicit application contract with installation ownership evidence.
- Keep the smoke mock/read-only after installation; do not place a carrier call.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/public/_redirects`
- `packages/consuelo-website/tests/website-structure.test.js`
- `packages/dialer-server/src/commercial/application.ts`
- `packages/dialer-server/src/lead-connector-application.ts`
- `packages/dialer-server/src/routes/lead-connector.ts`
- `packages/lead-connector/src/application/embed-bootstrap.ts`
- `packages/lead-connector/src/application/installations.ts`
- `packages/lead-connector/src/application/oauth.ts`
- `packages/lead-connector/src/application/tokens.ts`
- `packages/lead-connector/src/application/webhook.ts`
- `packages/lead-connector/src/application/webhooks.ts`
- `packages/lead-connector/src/infrastructure/persistent-stores.ts`
- `packages/workspace/scripts/website-deploy.js`
