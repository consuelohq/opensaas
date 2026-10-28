# Address browser review findings

branch: `task/tooling/address-browser-review-findings`
stream: `stream/tooling`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1402/address-browser-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1402
started: 2026-07-11

## acceptance criteria

- [x] Verify every Codex and inline review finding against the current stream implementation.
- [x] Fix only findings that remain valid, with matching behavior in workspace and OS.
- [x] Preserve raw upstream flags and provider options through the browser CLI/facade.
- [x] Report timeouts and signal exits as failures, including a short SIGKILL fallback.
- [x] Keep typed browser status/runtime failures in the Effect error channel.
- [x] Regenerate owned manifests, documentation, and generated TypeScript surfaces without unrelated churn.
- [x] Add focused behavioral tests and keep workspace/OS browser runtime files byte-identical.
- [x] Complete review and repository verification before publish.

## plan

1. Classify all review findings against the current stream code and generated ownership.
2. Write failing focused contracts for valid browser lifecycle, CLI, facade, and metadata issues.
3. Apply the smallest mirrored workspace/OS fixes and regenerate owned artifacts.
4. Run focused tests, browser facade tests, parity/build checks, review, and verify.
5. Publish and promote through the tooling stream workflow.

## current status

- Implementation and focused validation complete.
- Repository review is clean with zero findings after the final promise-based CLI adapter rewrite.
- Ready for final verification and publish.

## files changed

- `packages/workspace/scripts/lib/browser/cli.ts`
- `packages/workspace/scripts/lib/browser/process.ts`
- `packages/workspace/scripts/lib/browser/service.ts`
- `packages/workspace/scripts/lib/browser/types.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tests/browser-review-contract.test.ts`
- `packages/workspace/tests/browser-service.test.ts`
- `packages/workspace/tests/stream-lifecycle.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/manifests/tool-manifest.json`
- `packages/workspace/TOOLS.md`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/os/scripts/lib/browser/cli.ts`
- `packages/os/scripts/lib/browser/process.ts`
- `packages/os/scripts/lib/browser/service.ts`
- `packages/os/scripts/lib/browser/types.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/browser-service.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/TOOLS.md`
- `packages/os/src/generated/workspace.d.ts`

## workspace-owned: files changed

- Browser runtime, facade schemas, tests, source manifest, generated manifest/docs/types, and task metadata listed above.

## workspace-owned: activity log

- Verified all supplied review findings against `origin/stream/tooling`.
- Added red contracts for timeout escalation, raw flag preservation, provider forwarding, normalized URLs, typed status failures, CLI error output, type snapshots, and capability metadata.
- Implemented mirrored Effect/CLI fixes in workspace and OS.
- Regenerated tool manifests, docs, and generated TypeScript definitions.
- Restored an unrelated OS facade snapshot changed by an invalid combined package-context test run.

## workspace-owned: validation evidence

- Focused browser/stream contracts: 47 passed.
- Workspace browser facade contracts: 117 passed, 443 skipped by browser filter.
- OS browser facade contracts: 117 passed, 543 skipped by browser filter.
- Browser entry builds: workspace and OS passed.
- OS typecheck/script syntax checks: passed.
- Browser workspace/OS byte parity: passed.
- Generated outputs stable after regeneration: passed.
- `git diff --check`: passed.
- `review.run --base origin/stream/tooling --no-tests`: passed with 0 findings after final CLI adapter validation.
- 2026-07-11 03:28:26 `verify`: failed — COMMAND_FAILED
- 2026-07-11 03:29:51 `review.run`: passed — OK
- 2026-07-11 03:30:16 `verify`: passed — OK

## key decisions

- Kept `StreamCleanupInput.keep` unchanged because `stringArray` is already optional and generated signatures already expose `keep?: string[]`; that review suggestion was stale.
- Used timeout exit code 124 and non-timeout signal fallback code 1 so signal-terminated commands cannot report success.
- Added a 250 ms SIGKILL grace period after SIGTERM and clear it when the process exits.
- Kept screenshot metadata as writes state but non-mutating because it writes an output artifact without changing browser session state.
- Preserved mirrored workspace/OS runtime files byte-identically.

## notes for ko

- All still-valid Codex and inline findings were fixed.
- One finding was skipped as already satisfied: `StreamCleanupInput.keep` is optional today.

## improvements noticed

- Full workspace and OS facade suites must not be combined in one root Vitest invocation; package-context assumptions can rewrite unrelated snapshots. Browser-filtered package suites are deterministic.

## issues and recovery

- The initial task branch was accidentally bootstrapped from stale local main and then reused from a stale remote task ref. PRs #1399 and #1400 were closed, the stale ref was deleted, and PR #1402 was recreated from the actual `stream/tooling` tip before edits.
- A combined root facade run touched an unrelated OS snapshot; it was restored before scoped validation.

---

## publish checklist

```bash
bun run task:push -- --message "fix(tooling): address browser review findings" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- Browser runtime, facade schemas, manifests, generated docs/types, browser tests, stream lifecycle tests, and task metadata relevant to this review.

## workspace-owned: test selection

- changed files: `.task/tasks/tooling/address-browser-review-findings.json`, `.task/tooling/address-browser-review-findings/current.json`, `.task/tooling/address-browser-review-findings/evidence-log.json`, `.task/tooling/address-browser-review-findings/read-log.json`, `.task/tooling/address-browser-review-findings/session.json`, `.task/tooling/address-browser-review-findings/workpad.md`, `packages/os/TOOLS.md`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/lib/browser/cli.ts`, `packages/os/scripts/lib/browser/process.ts`, `packages/os/scripts/lib/browser/service.ts`, `packages/os/scripts/lib/browser/types.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/browser-service.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/scripts/lib/browser/cli.ts`, `packages/workspace/scripts/lib/browser/process.ts`, `packages/workspace/scripts/lib/browser/service.ts`, `packages/workspace/scripts/lib/browser/types.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/browser-review-contract.test.ts`, `packages/workspace/tests/browser-service.test.ts`, `packages/workspace/tests/stream-lifecycle.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
