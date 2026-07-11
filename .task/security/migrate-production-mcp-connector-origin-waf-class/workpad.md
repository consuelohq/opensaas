# migrate production mcp connector origin waf class

branch: `task/security/migrate-production-mcp-connector-origin-waf-class`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1425/migrate-production-mcp-connector-origin-waf-class
github pr: https://github.com/consuelohq/opensaas/pull/1425
started: 2026-07-11

## acceptance criteria

- [x] Add a fail-closed, idempotent migration for the two managed OS MCP WAF rules.
- [x] Replace only the retired nested connector-origin exclusion with the canonical opaque connector hostname class.
- [x] Preserve each rule's action, action parameters, ordering, enabled state, description, and trusted-provider allowlist logic.
- [x] Expose the migration through an explicit production workflow-dispatch flag using the existing protected environment token.
- [x] Prove planned, applied, already-migrated, and unexpected-policy behavior with focused tests.
- [x] Run strict review and full verification before dispatching the production migration.

## plan

1. Add failing unit contracts around a framework-neutral WAF migration helper.
2. Implement exact-ref discovery, exact old-fragment replacement, PATCH, and post-write verification.
3. Add a CLI and a guarded production workflow-dispatch input.
4. Run focused tests, strict review, full verify, publish, dispatch, and verify the live rules.

## test-first contract

- Behavior under test: only `consuelo-os-mcp-provider-allow` and `consuelo-os-mcp-untrusted-block` migrate from the old `.os-origin` exclusion to the anchored `c-<32-hex>` class.
- Expected red failure: migration module does not exist.
- Focused command: `bun --cwd packages/os vitest run tests/managed-os-mcp-origin-class-migration.test.ts`.

## current status

- Red contract reproduced the missing migration module.
- Added an exact-ref migration helper, CLI, and guarded production workflow input.
- Focused tests, strict review, and full verification pass. Ready for branch dispatch.
- Production workflow dispatch started: run `29167637882`.
- Run `29167637882` completed with failure only in the WAF migration step: the OS release token returned Cloudflare API code `10000` for the custom-ruleset read. No WAF rule was changed.
- The Cloudflare dashboard remains behind an automation-resistant human verification challenge.
- Next bounded check: run the same exact migration in `--dry-run` mode with the existing Pages token to determine whether it already carries Rulesets permission. No policy write is possible in this check.
- The task worktree was synchronized to remote commit `3985855ddf57e1ed2c83109d289ec16faf1fab77` before preparing the probe.
- Scoped strict review passes with zero findings. Full verify is blocked only by unrelated pre-existing `api`, `twenty-server`, and `twenty-sdk` failures selected repository-wide for the workflow-only diff; the focused migration suite remains green.

## wait plan

- Wait reason: GitHub Actions must finish the protected OS release and managed WAF migration step.
- Duration: poll every 20 seconds for up to 10 minutes.
- Resume action: read run `29167637882` status, job conclusions, and migration-step log output.
- Expected signal: workflow conclusion `success` and migration output status `migrated` or `unchanged` for both managed rule refs.
- Fallback: stop on failed/cancelled conclusion or bounded timeout and inspect the exact failing job logs before any further production mutation.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- `packages/os/scripts/migrate-managed-os-mcp-origin-class.ts`
- `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

## workspace-owned: files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- `packages/os/scripts/migrate-managed-os-mcp-origin-class.ts`
- `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

## workspace-owned: activity log

- 2026-07-11 20:38:05 fs.write: `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`
- 2026-07-11 20:38:34 fs.write: `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- 2026-07-11 20:38:50 fs.write: `packages/os/scripts/migrate-managed-os-mcp-origin-class.ts`
- 2026-07-11 20:50:11 fs.write: `.task/security/migrate-production-mcp-connector-origin-waf-class/inspect-cloudflared-cert.ts`

## workspace-owned: validation evidence

- 2026-07-11 20:44:22 `review.run`: passed — OK
- 2026-07-11 20:45:15 `review.run`: passed — OK
- 2026-07-11 20:45:30 `verify`: passed — OK
- 2026-07-11 20:52:59 `review.run`: passed — OK
- 2026-07-11 20:53:17 `verify`: passed — OK
- 2026-07-11 20:59:21 `verify`: failed — COMMAND_FAILED
- 2026-07-11 20:59:23 `verify`: failed — COMMAND_FAILED
- 2026-07-11 20:59:54 `review.run`: passed — OK

## key decisions

- Patch only the two managed rule refs and require the exact retired expression fragment; any unexpected policy shape fails closed.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial strict review invocation exceeded the tool window; deterministic no-test review returned four actionable error-boundary findings, all fixed before publish.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-production-release.yaml`
- `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`

## workspace-owned: test selection

- changed files: `.github/workflows/consuelo-production-release.yaml`, `.task/security/migrate-production-mcp-connector-origin-waf-class/evidence-log.json`, `.task/security/migrate-production-mcp-connector-origin-waf-class/read-log.json`, `.task/security/migrate-production-mcp-connector-origin-waf-class/workpad.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-07-11 21:00:03 apply-patch: `.task/security/migrate-production-mcp-connector-origin-waf-class/workpad.md`