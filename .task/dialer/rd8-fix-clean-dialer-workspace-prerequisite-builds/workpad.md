# rd8 fix clean dialer workspace prerequisite builds

branch: `task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2480/rd8-fix-clean-dialer-workspace-prerequisite-builds
github pr: https://github.com/consuelohq/opensaas/pull/2480
started: 2026-09-14

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
- `packages/dialer-server/railway.json`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

## workspace-owned: files changed

- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/Dockerfile`
- `packages/dialer-server/railway.json`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

## workspace-owned: activity log

- 2026-09-14 15:06:17 fs.write: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
- 2026-09-14 15:06:49 fs.write: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
- 2026-09-14 15:08:22 fs.write: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
- 2026-09-14 15:08:45 fs.write: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
- 2026-09-14 15:09:32 fs.write: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
- 2026-09-14 15:09:55 fs.write: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
- 2026-09-14 15:11:15 fs.write: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
- 2026-09-14 15:14:50 fs.write: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
- 2026-09-14 15:15:17 fs.write: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`

## workspace-owned: validation evidence

- 2026-09-14 15:09:06 `review.run`: passed — OK
- 2026-09-14 15:09:21 `verify`: passed — OK
- 2026-09-14 15:15:31 `review.run`: passed — OK
- 2026-09-14 15:15:43 `verify`: passed — OK

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

## Test-first contract

behavior under test: A completely fresh Dialer checkout must build every workspace dependency whose package exports point at `dist` before Dialer Server tests/typechecks/builds import it. `@consuelo/contacts` is now a direct Dialer Server dependency, so CI, production release validation, Railway Docker builds, and Railway watch classification must treat it as a Dialer prerequisite.
existing local pattern: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts` already locks CI package tests, logger prerequisite ordering, Docker package build order, production release workflow, and Railway watch paths.
new or changed tests: extend that release-workflow contract to require `packages/contacts` in Dialer change classification and Railway watch patterns, require a contacts build before Dialer Server tests in CI and production release validation, and require contacts in Docker prerequisite build order.
focused red command: `bun test packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
expected red failure: current workflows/Dockerfile/railway.json omit the contacts build/classification/watch requirements, reproducing the fresh-CI `Cannot find module '@consuelo/contacts'` failure seen in Consuelo / dialer job 104024943420.
no-test waiver: not applicable.

CI RED evidence source: Linux Consuelo / dialer job 104024943420 ran Dialer 261/261, then Dialer Server produced 8 module-load errors; first exact error: `Cannot find module '@consuelo/contacts' from .../packages/dialer-server/src/routes/inbound-customer.ts`. Fresh CI had installed the workspace but `packages/contacts/package.json` exports only `dist/index.js`, and the CI step had not built contacts.

- 2026-09-14 15:06:17 append: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-production-release.yaml`
- `packages/contacts/src/index.ts`
- `packages/contacts/src/utils.ts`
- `packages/contacts/tsconfig.json`
- `packages/dialer-server/package.json`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer/package.json`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/logger/package.json`
- `packages/workspace/scripts/task-push.js`

## GREEN evidence — clean workspace prerequisite repair

- Release workflow contract: 4/4 pass, 58 assertions (trace `trc_755c09c94ab4`).
- Fresh-task proof: `packages/contacts/dist` did not exist before validation (trace `trc_946dbe1135b2`). Building logger + contacts, then running the exact CI package-test commands passed: Dialer 261/261, Dialer Server 201 pass / 57 intentional service skips / 0 fail, LeadConnector 147/147 (trace `trc_1255313cfab8`).
- CI continuation: all three typechecks pass; Dialer build + compiled inbound smoke pass; LeadConnector build pass; Dialer Server compiled build pass; GitHub workflow policy 12/12 pass (trace `trc_ae183bfa651c`).
- Production change: contacts is now a Dialer change trigger, pre-test release prerequisite, Docker prerequisite, and Railway watched dependency. No provider/deployment action was performed.

- 2026-09-14 15:08:22 append: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`

## acceptance criteria — final

- [x] Reproduce the fresh-CI failure as missing built `@consuelo/contacts` output, without changing the shared phone-normalization runtime behavior.
- [x] Make contacts changes trigger Dialer CI and production-release classification.
- [x] Build contacts before Dialer Server tests/typechecks/builds in CI and production release validation.
- [x] Build contacts in the Railway Docker image before Dialer Server and watch `packages/contacts/**` for Railway rebuilds.
- [x] Lock the prerequisite order in release workflow contract tests.
- [x] Prove a fresh task with no contacts `dist` passes the exact CI package-test sequence after the prerequisite build.
- [x] Pass package typechecks/builds and workflow-policy tests.
- [ ] Pass strict review and canonical verify.
- [ ] Promote to `stream/dialer` and obtain green Linux `Consuelo / dialer` CI evidence.

## current status

Implementation and focused validation are complete. No production/provider action was performed. Awaiting repository review/verify, then task promotion and CI confirmation.

- 2026-09-14 15:08:45 append: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`

Repository gates GREEN: strict review 0 findings/blockers (trace `trc_c89ef36fcf1a`); canonical verify against `origin/stream/dialer` passed in full mode and wrote a publish-valid stamp, 5 changed product/workflow files, 0 DB risks/findings (trace `trc_d538130b5b5a`). Acceptance item “Pass strict review and canonical verify” is complete.

- 2026-09-14 15:09:32 append: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`

Publish attempt failed before commit creation (trace `trc_7838d6bed0c9`): `task.push` received GitHub 404 on `POST /repos/consuelohq/opensaas/git/trees`. No commit/stream mutation occurred. Diagnose remote task ref/base-tree integrity before retry; do not assume validation failure.

- 2026-09-14 15:09:55 append: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
Publish diagnosis: remote task ref `984017cf3ecf6398580ce2efaded192837079a54` exists and resolves to valid tree `1bf98b92e30c9be97425e65cccc073e2fc36ab2e`, parent `89c71130648bac81c28ae4356d92607fa1a0c4f8` (trace `trc_390e61a477ea`). `task-push.js` derives `baseTree` directly from that remote head commit tree. Therefore the prior GitHub `git/trees` 404 was not stale/missing task ancestry; one bounded retry is justified as a transient Git Data API failure.

- 2026-09-14 15:11:15 append: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`

- 2026-09-14 15:13:41 apply-patch: `packages/dialer-server/src/architecture.test.ts`

- 2026-09-14 15:14:06 apply-patch: `packages/dialer-server/package.json`
- 2026-09-14 15:14:06 apply-patch: `packages/dialer-server/src/routes/inbound-customer.ts`
- 2026-09-14 15:14:06 apply-patch: `.github/workflows/consuelo-ci.yaml`
- 2026-09-14 15:14:06 apply-patch: `.github/workflows/consuelo-production-release.yaml`
- 2026-09-14 15:14:06 apply-patch: `packages/dialer-server/Dockerfile`
- 2026-09-14 15:14:06 apply-patch: `packages/dialer-server/railway.json`
- 2026-09-14 15:14:06 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
## publication-permission pivot

Diagnostic tree creation proved the GitHub credential rejects only `.github/workflows/consuelo-ci.yaml` and `.github/workflows/consuelo-production-release.yaml` with 404; every other changed path can be written (trace `trc_fcf6b01ef58b`). This is a workflow-file permission boundary, not a Git tree outage.

Rather than bypass that boundary, the repair is now package-local: Dialer Server removes its `@consuelo/contacts` workspace dependency and imports `libphonenumber-js` directly, implementing the same US/default-country + international validation semantics used by the contacts normalizer. The workflow/Docker/Railway edits and their temporary release-contract assertions were reverted. A new architecture contract requires no `@consuelo/contacts` dependency/import and a direct `libphonenumber-js` dependency. RED was captured before implementation (trace `trc_ca27844c00fa`). `yarn.lock` was regenerated after the dependency swap (trace `trc_e6f339a9113e`).

This is narrower than the original prerequisite-build patch: fresh CI no longer needs contacts `dist` at all, and current production release classification remains correct because the changed surface is Dialer Server itself.

- 2026-09-14 15:14:50 append: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`

## final package-local GREEN

Final focused + release-package validation after the permission-safe pivot passed (trace `trc_f41830051a32`): architecture + customer route 7/7; Dialer 261/261; Dialer Server 201 pass / 57 intentional service skips / 0 fail; LeadConnector 147/147; all three typechecks pass; all three builds pass; release-workflow contract 4/4. The route retains domestic formatted-number normalization and valid international handling through `libphonenumber-js`, while the architecture contract prevents reintroducing an unbuilt `@consuelo/contacts` workspace dependency. Current working-tree product diff is only Dialer Server package/import/test + `yarn.lock`; workflow/Docker/Railway files are back to the stream versions.

- 2026-09-14 15:15:17 append: `.task/dialer/rd8-fix-clean-dialer-workspace-prerequisite-builds/workpad.md`
