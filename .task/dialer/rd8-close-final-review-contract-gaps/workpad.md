# rd8 close final review contract gaps

branch: `task/dialer/rd8-close-final-review-contract-gaps`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2483/rd8-close-final-review-contract-gaps
github pr: https://github.com/consuelohq/opensaas/pull/2483
started: 2026-09-20

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/Dockerfile`
- `packages/dialer-server/README.md`
- `packages/dialer-server/package.json`
- `packages/dialer-server/railway.json`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/inbound/customer-entry.integration.test.ts`
- `packages/dialer-server/src/inbound/customer-entry.ts`
- `packages/dialer-server/src/inbound/outbound-capacity.ts`
- `packages/dialer-server/src/inbound/telephony-admission.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `packages/dialer-server/src/runtime/inbound-customer-entry-activation.test.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/src/application/parallel-application.spec.ts`
- `packages/dialer/src/application/start-parallel-session.ts`
- `packages/dialer/src/errors/dialer-errors.ts`
- `packages/dialer/src/infrastructure/twilio/call-provider.ts`
- `packages/lead-connector/src/application.contract.test.ts`
- `packages/lead-connector/src/application/resources.ts`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/lead-connector/src/embed/customer.test.ts`
- `packages/lead-connector/src/embed/customer.ts`
- `packages/lead-connector/src/index.ts`
- `yarn.lock`
- `areas/dialer/rd/receipts/RD8.md`
- `packages/dialer-server/INBOUND-TESTING.md`
- `packages/dialer-server/src/inbound/enrichment.test.ts`
- `packages/dialer-server/src/inbound/enrichment.ts`
- `packages/dialer-server/src/runtime/inbound-enrichment.test.ts`
- `packages/dialer-server/src/runtime/inbound-enrichment.ts`
- `packages/dialer/src/infrastructure/twilio/create-outcome.test.ts`
- `packages/dialer/src/infrastructure/twilio/create-outcome.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-09-20 20:24:02 `verify`: passed — OK
- 2026-09-20 20:27:55 `verify`: passed — OK
- 2026-09-21 01:06:45 `verify`: passed — OK

## key decisions

- none yet

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

## Publication blocker — 2026-09-20 20:26 UTC

- Recovered missing scoped current.json through task.start(pr=2483); taskSession remained tsk_f05432cb85ae. Canonical verify then passed publishValid:true and wrote the real scoped verification stamp. No bypass used.
- task.push reached GitHub create-tree and returned HTTP 404. Remote task PR remains deb54847c82b833fab081bacbf3900cd1be48a5c; no commit/ref update happened.
- Read-only credential inspection confirmed both the workspace and gh use the same token, with gist, read:org, repo scopes and repository push access, but no workflow scope. The pending two workflow changes require workflow authorization. Asked Ko to run gh auth refresh -h github.com -s workflow. Do not remove required CI changes just to publish.
- Current stream PR2436 remains e95e7aad827616549b13f12aef6c37cafed97141, MERGEABLE/CLEAN; its previous checks passed but do not validate this unpublished continuation.
- Direct Railway origin /health also returned Application not found, matching the public edge. Local Railway authentication is unavailable; GitHub environment lacks DIALER_EDGE_PROXY_SECRET. Awaiting confirmation whether to restore the existing Railway service or target a moved service.
- Keep task worktree and full local changes. After GitHub authorization: rerun canonical verify if necessary, task.push, task.pr ready, inspect exact new stream head CI. Do not merge main until deployment target, required configuration/secrets and a production DB backup are verified. Main merge triggers deployment/migration.

## Publication resumed — 2026-09-21 01:06 UTC

Ko completed GitHub authorization. Read-only API inspection now confirms workflow scope in addition to repo/read:org/gist. Remote task head remains deb54847c82b833fab081bacbf3900cd1be48a5c and all expected local edits remain. Re-run canonical verification and publish through normal task flow. Railway still reports Unauthorized; asked Ko to run railway login before inspecting existing project/billing readiness. No paid-plan purchase or live-call action authorized by this sign-in request.
