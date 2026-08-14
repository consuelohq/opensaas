# orchestrator audit provider integration before main

branch: `task/os-provider-tools/orchestrator-audit-provider-integration-before-main`
stream: `stream/os-provider-tools`
pr: https://github.com/consuelohq/opensaas/pull/1618
started: 2026-07-24

## acceptance criteria

- [x] Manually audit Worker 12 against its brief because Codex/Grok review quota was unavailable.
- [x] Prove one coherent public deployment surface with no live legacy Railway aliases.
- [x] Prove read/write approval boundaries and secret redaction.
- [x] Prove provider discovery, manifest generation, and runtime-bundle inclusion/exclusion.
- [x] Add focused failing tests before any production correction.
- [x] Run focused provider tests and manifest/documentation drift checks.
- [x] Do not request CodeRabbit, Codex, Grok, or other external reviews.

## plan

1. Inspect the combined stream diff, generated manifest, dispatcher, search metadata, and runtime classifier.
2. Run targeted static audits and focused tests against the Worker 12 contract.
3. For each verified defect, record a test-first contract, reproduce red, patch minimally, and rerun.
4. Merge corrections into the provider stream only after validation; otherwise close this audit task as no-code evidence.

## test-first contract

- Behavior under test: canonical deployment routing/discovery, approval enforcement, redaction, and customer/operator bundle separation.
- Existing pattern: provider integration and deployment-provider handler tests under `packages/os/tests` and `packages/os/tools/deployment-provider`.
- Focused red command: selected after the first verified defect; no production edit before a reproducing test.
- No-test waiver: audit-only findings need no code change; configuration/documentation corrections require exact parser/drift validation.

## current status

- External review quota was exhausted on PR #1602, so this task performed a manual implementation and contract audit without invoking another model.
- Verified defects fixed: legacy Railway package/runtime entrypoints survived the clean cutover; `confirm --runtime` depended on the retired hidden Railway default; Cloudflare/Vercel public docs still claimed native tools were planned; Connect tests/browser evidence/claim ledger were stale.
- Stream PR #1616 remains gated until this correction merges and its checks rerun.

## files changed

- Canonical provider cutover: `packages/os/package.json`, `packages/os/scripts/confirm.js`, runtime-bundle classification, decision-engine schema/handler, generated manifest/types/docs, and focused tests.
- Public documentation: Railway, Vercel, Cloudflare, claim ledger, browser smoke, Connect contracts, and stale evidence paths.
- Developer documentation: `packages/os/SCRIPTS.md` and `packages/os/tools/railway/README.md` now describe `deployment.*` rather than hidden defaults.

## key decisions

- Treat generated output as evidence; edit source manifests/generators only.
- Do not add compatibility aliases because this is a pre-launch clean cutover.
- Keep repository/workspace Railway CLI wrappers as source-only development compatibility; exclude them from customer bundles and the public OS package surface.

## notes for ko

- CodeRabbit stream skips are caused by the repository path-filter configuration and are being handled separately without triggering a review.

## issues and recovery

- `batch` did not propagate the outer task session to `git.diff`; direct task-scoped calls are used instead.
- A broad facade suite still exposes unrelated media/task-session harness failures already documented by Worker 12. Provider-owned suites pass independently, so this task did not weaken unrelated contracts.
- Initial Connect contract run proved three stale-documentation failures; after source, browser, ledger, and evidence updates, all nine Connect tests pass.

## validation evidence

- RED: `bun x vitest run packages/os/tests/provider-cutover.test.ts` failed 3/3 before production edits.
- GREEN: 6 provider/runtime/manifest test files, 73 tests passed.
- GREEN: `bun test packages/documentation/tests/connect.test.ts` passed 9 tests / 559 assertions.
- GREEN: `bun run --cwd packages/os generate-tool-manifest:check` reported generated manifests current.
- GREEN: task `verify` passed static rules, ESLint, typecheck, spec compliance, and DB safety with zero findings; no external model review was invoked.
- Static audit: old Railway public names remain only in negative regression assertions, the historical Worker 09 brief, and repository-only CLI wrapper implementation/help.

- 2026-07-24 04:18:01 write: `.task/os-provider-tools/orchestrator-audit-provider-integration-before-main/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/provider-cutover.test.ts`

## workspace-owned: activity log

- 2026-07-24 04:18:01 fs.write: `.task/os-provider-tools/orchestrator-audit-provider-integration-before-main/workpad.md`
- 2026-07-24 04:21:27 fs.write: `packages/os/tests/provider-cutover.test.ts`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/tool-manifest.test.ts`

- 2026-07-24 04:23:40 apply-patch: `.task/os-provider-tools/orchestrator-audit-provider-integration-before-main/workpad.md`

## workspace-owned: validation evidence

- RED: `bun x vitest run packages/os/tests/provider-cutover.test.ts` failed 3/3 before production edits.
- GREEN: 6 provider/runtime/manifest test files, 73 tests passed.
- GREEN: `bun test packages/documentation/tests/connect.test.ts` passed 9 tests / 559 assertions.
- GREEN: `bun run --cwd packages/os generate-tool-manifest:check` reported generated manifests current.
- Static audit: old Railway public names remain only in negative regression assertions, the historical Worker 09 brief, and repository-only CLI wrapper implementation/help.
- 2026-07-24 04:18:01 write: `.task/os-provider-tools/orchestrator-audit-provider-integration-before-main/workpad.md`
- 2026-07-24 04:24:01 `verify`: passed — OK
- 2026-07-24 04:24:05 apply-patch: `.task/os-provider-tools/orchestrator-audit-provider-integration-before-main/workpad.md`
- 2026-07-24 04:24:09 `verify`: passed — OK
