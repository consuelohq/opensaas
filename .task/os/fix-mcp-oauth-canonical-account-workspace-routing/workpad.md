# fix mcp oauth canonical account workspace routing

branch: `task/os/fix-mcp-oauth-canonical-account-workspace-routing`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1976/fix-mcp-oauth-canonical-account-workspace-routing
github pr: https://github.com/consuelohq/opensaas/pull/1976
started: 2026-08-14

## acceptance criteria

- [x] ChatGPT MCP OAuth callback resolves the verified Google email through the existing canonical web identity directory before workspace routing; it no longer assumes `google:<sub>` is the account key.
- [x] Existing canonical accounts with an active workspace route complete OAuth and issue tokens bound to the canonical/compatible operating account selected by the existing web-auth resolver.
- [x] Legacy Google aliases remain usable only through the existing overlap checks in `resolveWebOperatingAccountId`; missing/ambiguous canonical identity fails closed instead of widening tenant access.
- [x] CIMD client/redirect binding, PKCE, resource binding, scopes, refresh/revoke behavior, and MCP authorization remain unchanged.
- [ ] Focused auth/tenant tests, strict review, full verify, main integration, targeted Device Authority production release, and deployed OAuth smoke are green.

## plan

1. Add a worker-level regression that seeds only a canonical Consuelo account/workspace plus canonical email directory, then runs ChatGPT CIMD authorize -> Google callback -> token -> introspection. Current callback must reproduce the 403 because it looks up `google:<sub>`.
2. Reuse `resolveCanonicalWebUser(... intent: 'login')` plus `resolveWebOperatingAccountId` in the MCP OAuth callback before `resolveMcpOAuthWorkspaceHost`; keep route parsing and token semantics intact.
3. Add negative coverage for unresolved canonical identity and retain the existing legacy alias tests.
4. Run focused Worker/canonical/web-auth suites, strict review, and full verify. Merge to `main` through the normal stream/task path without bypassing gates.
5. Deploy only the Device Authority Worker through the existing production release path, then smoke metadata + synthetic ChatGPT CIMD authorize and have the production route ready for immediate reconnect.

## current status

- Production `os.consuelohq.com` is serving the current auth shell and OAuth metadata, and the successful OS production release ran against main `46ca0dab...`, so this is not a stale deploy.
- The prior CIMD hotfix removed the Cloudflare -> ChatGPT metadata subrequest and is deployed, but the Google callback still hardcodes `accountId = 'google:' + identity.sub` before workspace routing.
- Current web login already resolves the same Google email to a canonical Consuelo user via `resolveCanonicalWebUser` and selects canonical vs legacy-compatible account keys with `resolveWebOperatingAccountId`. Device approval has a separate stricter 15-minute signed-membership resolver that is intentionally unsuitable for ordinary MCP reconnects.
- This mismatch explains the post-Google 403/Forbidden for canonical web accounts whose workspace is stored under `user_*` rather than `google:<sub>`.
- The callback now resolves canonical web identity first, then uses the existing operating-account compatibility resolver before workspace lookup. Canonical accounts and overlap-validated legacy aliases both use the same identity boundary as normal web login.
- Legacy MCP OAuth tests were upgraded to seed the canonical email directory and a matching workspace id before exercising the legacy alias; directory-less legacy fallback is no longer treated as authenticated identity.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 23:15:23 `review.run`: passed — OK
- 2026-08-14 23:15:42 `verify`: passed — OK

## key decisions

- Reuse the canonical **web** identity resolver, not the device-enrollment resolver. MCP reconnect is an interactive web login and should not inherit the device resolver's 15-minute signed-membership freshness requirement.
- Preserve existing legacy alias compatibility through `resolveWebOperatingAccountId`; do not add a new fallback or duplicate identity system.
- Keep this hotfix scoped to Device Authority OAuth identity/routing. The unrelated Linux lifecycle CI fixture failure (`darwin` fixture bundle asserted on Linux) is tracked separately and is not allowed to block the already-authorized targeted Worker release path.

## Test-first contract

- Behavior under test: a ChatGPT CIMD OAuth reconnect for an existing canonical Consuelo user whose workspace route is keyed by `user_*` completes instead of returning 403 after Google approval, and the token subject uses the resolver-selected operating account.
- Existing local pattern: `os-device-authority-worker.test.ts` already drives CIMD authorize/callback/token/introspection end to end; `google-oauth.ts` already uses `resolveCanonicalWebUser` + `resolveWebOperatingAccountId` for normal web login.
- New test: add a canonical-account CIMD reconnect case next to the existing legacy Google-account CIMD case. Seed canonical directory + canonical `AccountWorkspace`, but deliberately do not seed `google:google-sub-123`.
- Focused RED command: `bun x vitest run packages/os/tests/os-device-authority-worker.test.ts -t "canonical Consuelo account for ChatGPT CIMD reconnect"`.
- Expected RED: callback returns 403 `access_denied` because current code looks up `google:google-sub-123`, which has no workspace route.
- Negative coverage: existing invalid CIMD binding remains; add/retain fail-closed identity directory behavior before publish.
- No-test waiver: none; this is an auth/tenant boundary and requires integration coverage.

### RED evidence

- Focused canonical reconnect test ran before production edits and failed exactly at the Google callback: expected 302, received 403.
- The authorize step succeeded, proving CIMD/redirect/PKCE parsing is not the failure. The 403 occurs only after verified Google identity is available and before an authorization code is issued, matching the hardcoded `google:<sub>` workspace lookup.

### GREEN evidence

- Focused canonical CIMD reconnect test now passes end to end through authorize -> Google callback -> token -> introspection, with introspection subject `user_canonical_123`.
- Full `os-device-authority-worker.test.ts`: 29/29 passed, covering canonical reconnect, overlap-validated legacy alias compatibility, central MCP routing, CIMD binding, resource echo, PKCE, token issuance, introspection, refresh/revoke, and fail-closed identity-directory behavior.
- Additional auth suites passed: canonical device identity 8/8, universal login 10/10, cloud-first web onboarding 13/13, operator OAuth client 30/30. Combined relevant auth result: 90 passed.
- `production-release-mcp-security.test.ts` could not run from the task worktree because its pre-existing path calculation resolves the workflow to the parent temp directory (`.../T/.github/...`); both failures are ENOENT before assertions and are unrelated to this auth change. Release workflow state is validated separately through the actual GitHub production workflow and targeted release readiness path.
- Strict review against `origin/main`: 0 issues / 0 blockers. Full verify passed with `publishValid: true` and DB guard clean.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/canonical-device-identity.ts`
- `packages/os/cloudflare/os-device-authority/src/services/cloud-first-onboarding.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/tests/canonical-device-identity.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-08-14 23:14:14 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`
- 2026-08-14 23:14:31 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-08-14 23:14:54 apply-patch: `.task/os/fix-mcp-oauth-canonical-account-workspace-routing/workpad.md`

- 2026-08-14 23:15:52 apply-patch: `.task/os/fix-mcp-oauth-canonical-account-workspace-routing/workpad.md`