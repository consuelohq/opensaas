
## 2026-08-10 restart recovery continuation

- Live evidence: launchd label com.consuelo.system disappeared after consuelo restart; plist remained valid.
- Root cause contract: a restart invoked from inside the launchd-owned OS process must not boot out its own job before a replacement supervisor can restore it.
- Watchdog contract: when the plist exists but the launchd label is absent, recovery must bootstrap the label rather than repeat kickstart-only failures.
- Fallback contract: local legacy workspace health on 8850 is distinct from the configured hosted workspace connector and must not be reported as Codex failover readiness.
- Test-first: add focused red coverage for self-safe launchd restart and missing-label watchdog bootstrap before production edits.
- PR review continuation: refresh actionable comments and address all current P1/P2 findings before promotion.

- 2026-08-10 16:07:02 apply-patch: `packages/os/tests/consuelo-reload.test.ts`
- 2026-08-10 16:07:02 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-10 16:07:02 apply-patch: `packages/os/tests/observability-traces-site.test.ts`
- 2026-08-10 16:07:02 apply-patch: `packages/os/tests/local-agent-connectivity.test.ts`
- 2026-08-10 16:07:02 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-08-10 16:07:02 apply-patch: `packages/os/tests/fs-read-output-contract.test.ts`

## workspace-owned: files read

- `packages/os/tests/security-gateway.test.ts`

- 2026-08-10 16:10:33 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-08-10 16:12:14 apply-patch: `packages/os/scripts/consuelo-reload.js`
- 2026-08-10 16:12:14 apply-patch: `packages/os/scripts/workspace-watchdog.sh`
- 2026-08-10 16:12:14 apply-patch: `packages/os/scripts/lib/local-agent-connectivity.ts`
- 2026-08-10 16:12:14 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-08-10 16:12:14 apply-patch: `packages/consuelo-website/src/pages/os/observability/traces.astro`
- 2026-08-10 16:12:14 apply-patch: `packages/os/tests/observability-traces-site.test.ts`
- 2026-08-10 16:12:51 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-08-10 16:12:51 apply-patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-08-10 16:13:22 apply-patch: `packages/os/tests/local-agent-connectivity.test.ts`
- 2026-08-10 16:15:33 apply-patch: `packages/workspace/tests/tool-manifest.test.ts`
- 2026-08-10 16:16:15 apply-patch: `packages/workspace/tests/tool-manifest.test.ts`

## 2026-08-10 review and restart fixes

- Red evidence: focused Bun/Vitest-compatible run produced 50 passing and 6 failing tests, one for each current review/restart contract.
- Green evidence: the same six focused files now pass 56 tests with 307 assertions.
- Restart fix: loaded LaunchAgents use `launchctl kickstart -k` without self-bootout; unloaded installed agents still bootstrap.
- Watchdog fix: missing labels bootstrap their installed plist before kickstart.
- Compatibility fix: MCP 2026 discovery falls back to the retained 2024 initialize handshake only on method-not-found.
- Security fix: flattened `node/security/generated/auth.json` resolves replay, usage, and audit state to the canonical Consuelo home.
- Traces fix: the Astro route renders the complete shared static cockpit; the real Astro build emitted one valid document with the live controller and EventSource client.
- Facade fix: OS and workspace `FsReadOutput` signatures and generated types/docs include `text-full`.
- Verification: OS syntax check, OS manifest tests (15/15), workspace manifest tests (6/6), generated facade artifacts, and website build all pass.
- Detached broad verification kept launchd PID `54567` stable, proving the temporary errors came from the upstream long-call availability window rather than a daemon restart.
- Full OS/workspace suites retain unrelated baseline failures in the media/facade matrix, task-hook/test-selection fixtures, and task-worktree fixtures; changed-area suites remain green.
- Both OS and workspace generated-manifest drift checks pass.
- Strict local review (static rules, lint, typecheck, spec compliance) reports 0 blocking issues.
- Safety checkpoint: desired tree is committed at `fb0031e9a2dceec3ffe275458dca6823fde160fa` and pushed to `codex/checkpoint-pr-1828-review-fixes-20260810`.
- Reconciliation: local task HEAD now exactly matches remote PR head `ab6c5e626e73482e3365c22c19439db6fd26b486`; the intended review/restart delta remains in the worktree.
- Post-reconciliation package-script Vitest run passes 6 files / 56 tests on the exact remote base.

- 2026-08-10 16:21:50 apply-patch: `.task/os/mcp-2026-dual-era-transport/workpad.md`

## workspace-owned: validation evidence

- 2026-08-10 16:22:59 `review.run`: passed — OK
- 2026-08-10 16:26:11 apply-patch: `.task/os/mcp-2026-dual-era-transport/workpad.md`
- 2026-08-10 16:32:13 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-08-10 16:32:55 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-08-10 16:33:58 `review.run`: passed — OK
- 2026-08-10 16:34:31 `verify`: passed — OK
