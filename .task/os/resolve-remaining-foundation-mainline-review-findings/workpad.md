# resolve remaining foundation mainline review findings

branch: `task/os/resolve-remaining-foundation-mainline-review-findings`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1718/resolve-remaining-foundation-mainline-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1718
started: 2026-07-29

## acceptance criteria

- [x] Every actionable review finding inherited by `stream/os -> main` is fixed with a regression test or explicitly dispositioned with repository evidence.
- [x] Managed Linux nodes boot fresh disks safely, repeat apply without false drift, give the runtime user access to onboarding state, run enrollment authoritatively, and install/start the Caddy ingress dependency.
- [x] Dry-run is side-effect free and local-agent bearer credentials are created atomically with restrictive permissions.
- [x] MCP, heartbeat, lifecycle, registry, grant, and ingress failure paths fail closed without masking diagnostics.
- [ ] Focused tests, expanded OS tests, OS typecheck, formal verification, PR checks, and fresh review are green before promotion.
- [ ] The consolidated task is promoted to `stream/os`, the stream PR is merged to `main`, and superseded audit PRs are closed only after main contains the fixes.

## plan

1. Capture the inherited review queue and classify each item against current repository conventions.
2. Add focused failing tests for each actionable lifecycle/security/routing defect.
3. Implement the smallest compatible fixes; preserve deliberate OAuth and D1 protocol conventions.
4. Run focused and expanded validation, publish for fresh review, and resolve any new findings.
5. Promote the task, merge `stream/os -> main`, then close superseded audit PRs.

## current status

- Actionable inherited findings are implemented and covered by focused regressions. Local and formal workspace verification are green; the branch is ready for push, PR checks, and fresh review.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install-tty.test.ts`
- `packages/os/scripts/lib/gcloud-managed-cloud-node.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/errors.ts`
- `packages/os/scripts/lib/local-agent-mcp-bridge.ts`
- `packages/os/scripts/lib/managed-cloud-node-enrollment.ts`
- `packages/os/scripts/lib/managed-cloud-node.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/mcp-stdio.ts`
- `packages/os/scripts/start-caddy-daemon.sh`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/daemon-bun-path.test.ts`
- `packages/os/tests/gcloud-managed-cloud-node-instance.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/managed-cloud-node-enrollment.test.ts`
- `packages/os/tests/managed-cloud-node-instance-contract.test.ts`
- `packages/os/tests/managed-cloud-review-regressions.test.ts`
- `packages/os/tests/native-lifecycle-operation.test.ts`
- `packages/os/tests/oauth-device-page-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/platform-managed-cloud-node-instance.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tests/foundation-finish-line-regressions.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- Classified every inherited review item against the stream candidate; retained protocol and migration conventions where repository evidence showed the finding was not applicable.
- Added failing finish-line contracts, implemented the production fixes, then repaired stale baseline tests in the directly affected installer/lifecycle surfaces.
- Attempted the full OS suite and retained its unrelated baseline failures; re-ran every changed and directly affected surface explicitly.
- Addressed the current-head Codex P2 by restoring the approved workspace ID comparison against the trusted managed-node plan; the new regression failed before the implementation change and passed afterward.

## workspace-owned: validation evidence

- Focused/expanded OS validation: 27 files passed, 234 tests passed, 1 real-terminal-only PTY test skipped in the non-TTY runner.
- OS typecheck: passed (`workspace script syntax checks passed`).
- Shell syntax: `bash -n` passed for `bootstrap.sh` and `start-caddy-daemon.sh`.
- Formatting and patch integrity: Prettier check and `git diff --check` passed.
- Formal workspace verify: publish-valid; review ran static rules, ESLint, typecheck, and spec compliance with zero findings, the package registry gate passed, and the DB guard passed with zero risks.
- Full OS suite was attempted: 228 files passed, 19 failed, 2 skipped; failures were audited and were mostly unrelated repository baseline/environment contracts. Directly relevant stale tests were corrected and now pass in the expanded suite.
- 2026-07-29 05:16:36 `verify`: failed — COMMAND_FAILED
- 2026-07-29 05:18:27 `verify`: passed — OK
- 2026-07-29 05:18:55 `verify`: passed — OK
- 2026-07-29 05:20:01 `review.run`: passed — OK
- Current-head enrollment identity regression: red with an incorrectly accepted `workspace_other`, then green with 15/15 focused enrollment/finish-line tests passing.
- 2026-07-29 05:30:38 `verify`: passed — OK
- 2026-07-29 05:32:12 `verify`: passed — OK

## key decisions

- OAuth/device endpoints retain RFC-style flat OAuth errors; the project-wide nested application error shape does not apply to protocol endpoints.
- D1 migrations retain the existing ordered, underscore-named, forward-only Cloudflare convention; renaming an applied migration or inventing a down migration would be unsafe.
- Release mutation concurrency is already enforced by `.github/workflows/consuelo-os-runtime-publish.yaml` with `group: consuelo-os-release-state`; this finding is already satisfied.
- Internal release/bootstrap scripts are not rebranded as public `Consuelo` CLI commands merely to add `--json`/`--quiet`; user-facing CLI behavior remains scoped to the actual CLI surface.
- Source-text lifecycle contract tests remain intentional complements to behavioral tests; only brittle exact-object assertions will be loosened where they obstruct compatible fields.

## notes for ko

- Do not uninstall/reinstall the current Consuelo installation until PR #1718 is merged to `stream/os` and the refreshed stream-to-main PR #1716 is merged. The same chat can then capture pre-uninstall and post-install machine state.

## improvements noticed

- none yet

## issues and recovery

- The first read call omitted the required `language`/`code` fields. The typed validation envelope was inspected and the corrected `code.call` input succeeded; no native fallback was used.
- The facade shell runtime does not expose the local `apply_patch` helper, so subsequent edits use the facade's typed edit runtime directly.
- The broad OS suite contains pre-existing failures in task-hook/manifest inventories, trace SQLite environment support, browser/tool package layout, and other unrelated contracts. Touched lifecycle/install failures were isolated, corrected where stale, and re-run green rather than being hidden.
- The first formal verify found two mechanical related-pre-existing error-handling rules in touched lifecycle/enrollment files. Both awaits now have typed catch boundaries, the affected 42 tests/typecheck passed, and the second verify produced a publish-valid zero-finding stamp.

## test-first contract

- Managed bootstrap: assert recursive onboarding ownership, foreground enrollment, Caddy installation/service activation, and stable first/repeat apply metadata.
- Install state: assert dry-run creates no credentials and materialized credential files are born mode `0600`.
- Local MCP bridge: assert 4xx retryability classification, bounded `Content-Length`, and malformed SSE frames do not discard valid frames.
- Lifecycle/ingress: assert rejected health checks stay typed, `SERVICE_PREFLIGHT_FAILED` is modeled, equal proxy ports are rejected, Caddy receives only allowlisted environment, and required Portless overrides the default-disabled optional path.
- Registry/control plane: assert node deletion removes host index, grant failure state survives cleanup failure, pre-auth workspace IDs are not trusted, and MCP catch-all records a sanitized failure.
- Enrollment/heartbeat: assert grant expiry is honored, approved workspace IDs match the trusted node plan, resolved status dependencies receive failures, capabilities deduplicate after trim, and non-Error causes remain attached.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/os/resolve-remaining-foundation-mainline-review-findings/verify.json`, `.task/os/resolve-remaining-foundation-mainline-review-findings/workpad.md`, `packages/os/scripts/lib/managed-cloud-node-enrollment.ts`, `packages/os/tests/managed-cloud-node-enrollment.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
