# complete gohighlevel marketplace bulk oauth

branch: `task/dialer/complete-gohighlevel-marketplace-bulk-oauth`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2623/complete-gohighlevel-marketplace-bulk-oauth
github pr: https://github.com/consuelohq/opensaas/pull/2623
started: 2026-10-08

## acceptance criteria

- [ ] Native HighLevel Marketplace code-only callbacks exchange a Company OAuth token without inventing state.
- [ ] Existing state-bound Location OAuth callbacks remain unchanged.
- [ ] Company credentials are encrypted at rest and keyed only by provider-verified `companyId`.
- [ ] Verified embed `companyId` + `activeLocation` can derive and persist the selected Location token through HighLevel `/oauth/locationToken`.
- [ ] Wet Stone completes a fresh Marketplace install and creates an embed session after production deploy.
- [ ] Contacts, opportunity search, pipelines, and queue preview return successful responses after reinstall.
- [ ] No carrier call is placed during the smoke.

## plan

1. Reproduce the focused code-only Marketplace OAuth contract red on the current stream branch.
2. Apply the previously validated bulk-OAuth implementation from the interrupted task branch.
3. Re-run lead-connector and dialer-server typechecks/tests/build.
4. Merge the task into `stream/dialer` and release dialer-server through the existing production workflow.
5. Repeat the exact Wet Stone Marketplace install and queue-loading smoke without placing a carrier call.

## Test-first contract

behavior under test: a native Marketplace callback containing `code` but no `state` must exchange a Company token; verified embed context must then exchange that Company token for the selected Location token. The existing callback containing both `code` and `state` must continue through the current state-bound OAuth handler.

existing local pattern: `completeLeadConnectorOAuth` owns the state-bound Location flow; production evidence maps HighLevel `companyId` to Consuelo `workspaceId`, and HighLevel's documented bulk-install flow uses Company OAuth followed by `/oauth/locationToken`.

new or changed tests: `packages/lead-connector/src/marketplace-oauth.contract.test.ts` plus the dialer-server LeadConnector callback boundary.

focused red command: `bun test packages/lead-connector/src/marketplace-oauth.contract.test.ts`

expected red failure: the current stream has no `completeLeadConnectorMarketplaceOAuth` export/implementation.

no-test waiver: not applicable.

## current status

- Follow-up to DEV-1619 after the legacy website callback bridge and edge callback rewrite were already shipped.
- The exact fresh-install smoke reached the production backend with a code-only callback and failed only because the backend required state.
- A complete implementation was developed and validated in the prior task worktree, but that task branch was deleted automatically after its earlier PR merged. Its code-only diff was preserved at `/tmp/dev1619-marketplace-bulk-oauth.patch` for replay here.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red reproduced on this task before implementation: focused test failed because `completeLeadConnectorMarketplaceOAuth` was not exported.
- Focused bulk OAuth contract: 2 pass / 0 fail / 6 assertions.
- `@consuelo/lead-connector`: typecheck pass; 160 pass / 0 fail / 1309 assertions; build pass.
- `@consuelo/dialer-server`: typecheck pass; 219 pass / 71 integration skips / 0 fail / 1183 assertions.
- Dialer callback boundary proves code-only Marketplace callbacks use the Company OAuth path and do not call the state-bound handler.
- 2026-10-08 16:04:02 `review.run`: passed — OK

## key decisions

- Do not synthesize OAuth state or trust browser tenant identifiers.
- Store the provider Company credential encrypted and derive Location credentials only from signed/decrypted HighLevel embed context.
- Keep the existing state-bound OAuth path intact for app-initiated Location OAuth.
- Keep this task scoped to install/auth/queue smoke; do not place a carrier call.

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

- `.github/workflows/consuelo-production-release.yaml`
- `packages/lead-connector/src/application/marketplace-oauth.ts`
- `packages/lead-connector/src/marketplace-oauth.contract.test.ts`

- 2026-10-08 16:03:25 apply-patch: `.task/dialer/complete-gohighlevel-marketplace-bulk-oauth/workpad.md`
