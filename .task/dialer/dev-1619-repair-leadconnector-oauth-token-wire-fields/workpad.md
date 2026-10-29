# DEV-1619 repair LeadConnector OAuth token wire fields

branch: `task/dialer/dev-1619-repair-leadconnector-oauth-token-wire-fields`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2696
started: 2026-10-29

## acceptance criteria

- [ ] Company/Location initial exchange and refresh use the documented OAuth wire schema.
- [ ] New serializer-level contract fails before and passes after the fix.
- [ ] Existing ownership, encryption and invalid-state/error behavior remain covered.
- [ ] Review/verify, local service proof, publication and fresh deployed OAuth acceptance pass.

## plan

1. Reproduce the live 422 through the real SDK HTTP serializer (red recorded).
2. Change OAuth request keys at the two application/provider boundaries only.
3. Run focused and broader package/runtime validation, review and full verify.
4. Publish to stream, inspect the complete current integration candidate, release the exact accepted source and obtain fresh one-time OAuth proof.

## files changed

- `packages/lead-connector/src/oauth-wire.contract.test.ts`

## key decisions

- Keep SDK inputs camelCase and explicitly map provider OAuth fields to snake_case.
- Do not transform generic transport bodies; other provider REST contracts use camelCase.

## notes for ko

- Wet Stone has the correct v3 test loader installed; public Marketplace v3 remains disapproved/unpublished.
- Carrier approvals are consumed; no further phone call or number purchase is included.
- Existing OS authentication and MCP routing are outside this change.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

Behavior under test: Initial Company/Location OAuth code exchange and subsequent refresh must send HighLevel's documented snake_case form fields. The application/SDK input model may remain camelCase; the provider wire boundary must use client_id, client_secret, grant_type, user_type, redirect_uri and refresh_token. Preserve the correct existing code field, signed embed validation, token encryption, ownership checks and callback URL.

Evidence: Fresh Wet Stone v3 test install succeeded on 2026-10-29, but its normal deployed callback returned 502 at 20:37:29Z (Railway request _v-mpjfGTr-4foueO8poTA; source 508441ced8a275b12d5855dec414fa17a1c92ad9). Exact generated/runtime client ID and redirect URI agree. Current source sends camelCase form keys. Official https://marketplace.gohighlevel.com/docs/ghl/oauth/get-access-token/index.html specifies snake_case. Two non-credential probes using deliberately invalid fixtures: camelCase ->422 property should not exist / missing client_id; snake_case ->401 Authorization code not found. No real authorization code was replayed. Existing installation resources still return 200; they do not prove fresh OAuth.

Existing local pattern: Effect application programs plus createLeadConnectorFetchTransportLayer; Company and Location credential stores use encrypted tokens and existing clock/cipher ports. Read current task source before editing, preserve shared-stream work. New task owns token-exchange wire fields and focused relevant contracts only, not migrations, docs, website, OS auth, pricing or carrier runtime.

New tests: Add an OAuth HTTP wire contract through the real fetch serializer. Provider fixture rejects camelCase exactly as the observed 422 validation. Prove Company authorization/refresh and Location authorization/refresh send required snake_case fields, preserve code/token values without logging them, and persist only valid successful responses. Update existing request expectations to the documented external contract where needed. Do not add a generic camelCase-to-snake_case transport converter because other provider APIs legitimately use camelCase.

Focused red command: bun test packages/lead-connector/src/oauth-wire.contract.test.ts
Expected red failure: the current SDK posts forbidden clientId/clientSecret/grantType/userType/redirectUri/refreshToken keys and fails the realistic provider wire contract. Record terminal red output before editing production files.
No-test waiver: none.

Dependency and release graph: task PR2696 -> current stream/dialer -> review PR2687 -> main -> exact-source Dialer release -> fresh one-time OAuth/SDK bootstrap verification. Stream started at 51d8d3e0463eb9f9bda1368b6e767a830de6079b; verify its complete current review diff and all effective checks before central promotion. DEV-1623 agent handoff remains an unverified integration input; do not mix or overwrite its migration ownership. No new subagents.

Validation: focused red/green, relevant LeadConnector tests/typecheck/build, server boundary/provider integration checks with local Postgres/Redis via dev, strict review and full verify; publish task.push followed immediately by task.pr, then verify exact stream/main/release SHA and fresh deployed OAuth. Existing carrier approvals are consumed. Do not replay spent authorization codes or call journals, make calls, record media, buy numbers, change Stripe quantities, rotate shared secrets or touch OS Google/MCP authentication.

- 2026-10-29 20:50:34 append: `.task/dialer/dev-1619-repair-leadconnector-oauth-token-wire-fields/workpad.md`

## workspace-owned: files changed

- `packages/lead-connector/src/oauth-wire.contract.test.ts`

## workspace-owned: activity log

- 2026-10-29 20:50:34 fs.write: `.task/dialer/dev-1619-repair-leadconnector-oauth-token-wire-fields/workpad.md`
- 2026-10-29 20:54:48 write: `packages/lead-connector/src/oauth-wire.contract.test.ts`
- 2026-10-29 20:54:48 fs.write: `packages/lead-connector/src/oauth-wire.contract.test.ts`
- 2026-10-29 20:55:35 fs.write: `.task/dialer/dev-1619-repair-leadconnector-oauth-token-wire-fields/workpad.md`
- 2026-10-29 21:07:40 fs.write: `.task/dialer/dev-1619-repair-leadconnector-oauth-token-wire-fields/workpad.md`

## Focused red evidence

`bun test packages/lead-connector/src/oauth-wire.contract.test.ts` exited 1: 0 pass, 5 fail. All four success flows failed with LeadConnectorProviderError status=422; the rejection-preserves-existing-credential test received 422 rather than its intended valid-wire 401. This is the expected production defect, not a missing dependency or import failure. Trace trc_3837fd963d97 (see exact code.call evidence in this chat). Production files were unchanged for this red run.

The typed status helper ignored taskSession and inspected the stale primary main checkout. A separate task-scoped code.call verified the correct managed cwd and only the new task metadata before source edits. Do not act on the primary checkout's legacy build artifacts or unrelated dirty files.

- 2026-10-29 20:55:35 append: `.task/dialer/dev-1619-repair-leadconnector-oauth-token-wire-fields/workpad.md`


## Focused green evidence

The same focused wire contract now passes: 5 pass, 0 fail, 17 assertions. Both authorization and both refresh flows complete through the real serializer, and a rejected valid-wire request preserves the previous encrypted Company credential. The broader LeadConnector suite initially passed 167 tests and failed only three old camelCase request expectations; those assertions now require the documented snake_case wire contract. The generic HTTP serializer is unchanged. Typecheck passed.

## Local validation before review

- LeadConnector: 170 tests pass, zero failures, 1360 assertions; package typecheck and build pass.
- Disposable local Postgres/Redis lab: 1 pass, 39 assertions (trace trc_eac8ae3347ac).
- Isolated PostgreSQL upgrade plus server LeadConnector/embed boundaries: 13 pass, 61 assertions (trace trc_501d6b7ddf18). This covers the migration input without replacing its ownership.
- Dialer server typecheck passes (trace trc_c34e70270064).
- Removed formatter-only churn from existing contracts; final tracked production diff is only the two OAuth request bodies. New wire contract covers all four exchange/refresh combinations and rejected-provider preservation.
- The documented dev helper is absent from this node's manifest (NOT_FOUND, explicit tool-manifest mismatch). Used the repository's disposable local lab through managed code.call, without production credentials or carrier effects.
- Review, full verify, publication, integration, deployment and fresh OAuth proof are still pending. Current install resources/launcher success does not prove fresh authorization.

- 2026-10-29 21:07:40 append: `.task/dialer/dev-1619-repair-leadconnector-oauth-token-wire-fields/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 21:07:49 `review.run`: passed — OK
- 2026-10-29 21:08:11 `verify`: passed — OK
