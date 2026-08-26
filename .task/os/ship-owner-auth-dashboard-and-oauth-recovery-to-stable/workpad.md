# Ship owner auth dashboard and OAuth recovery to stable

branch: `task/os/ship-owner-auth-dashboard-and-oauth-recovery-to-stable`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2162/ship-owner-auth-dashboard-and-oauth-recovery-to-stable
github pr: https://github.com/consuelohq/opensaas/pull/2162
started: 2026-08-19

## acceptance criteria

- [x] Established canonical users can approve a device after the original membership verification window without weakening first-claim freshness.
- [x] OAuth denials return distinct stable codes, safe messages, appropriate status, and a correlation ID.
- [x] The owner-only internal dashboard exposes a bounded workspace enrollment reset without deleting the canonical user.
- [x] The reset proxy requires the internal workspace session, Access authorization, exact same origin, an action header, strict payload validation, and the Device Authority internal secret.
- [x] Focused OAuth, dashboard, control-plane, universal-login, and surrounding security contracts pass.
- [ ] Land through the task/stream review flow and promote the signed runtime to stable.

## plan

1. Add red regressions for established-user OAuth and owner-only enrollment reset.
2. Implement the smallest OAuth and dashboard/edge changes.
3. Run focused security tests, syntax/type checks, and local review.
4. Push the task PR, complete one Codex and one CodeRabbit review, merge to stream, then validate and promote stable.

## current status

- Implementation and focused verification are complete. Local review is clean after one fix. Awaiting task PR push and hosted reviews.

## files changed

- OAuth identity/denial handling in Device Authority.
- Owner dashboard enrollment-reset UI and same-origin edge proxy.
- Dashboard device projection/fixtures include workspace host.
- Focused OAuth, dashboard, and integration regressions.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-19 00:19:31 fs.write: `.task/os/ship-owner-auth-dashboard-and-oauth-recovery-to-stable/workpad.md`

## workspace-owned: validation evidence

- 2026-08-19 00:38:33 `review.run`: passed — OK
- 2026-08-19 00:39:12 `review.run`: passed — OK
- 2026-08-19 00:40:20 `verify`: failed — COMMAND_FAILED
- 2026-08-19 00:41:08 `verify`: failed — COMMAND_FAILED

## key decisions

- Membership freshness gates only a first workspace claim. Existing canonical and legacy device mappings remain usable while their matching membership is still present and valid.
- Owner-menu visibility remains local configuration; server-side workspace-session and Access authorization are the security boundary.
- Enrollment reset is POST-only and narrowly revokes the routed workspace enrollment while preserving the canonical user.

## notes for ko

- The stream already contains the Device Authority reset primitive; this task supplies the dashboard/edge integration and will be validated again after task-to-stream merge.
- `consuelo sites refresh` still needs the owner-only launcher overlay restored locally. The agent sandbox can inspect but cannot write `~/.consuelo/consuelo.yaml`.

## improvements noticed

- Full OS verification should isolate worker-pool/reload tests from the live MCP supervisor; the current all-tests path can wedge the same workers carrying verification.

## issues and recovery

- Nx/Yarn does not recognize `packages/os` as a workspace inside this task worktree, so focused tests used the package-declared Vitest binary directly.
- Focused gates: 53/53 changed-path tests passed; surrounding security slice: 205 passed, 10 skipped, one unrelated pre-existing Caddy worker-port assertion failed.
- The package-wide run was non-actionable in this sandbox: 299 suites passed and 38 failed, primarily from loopback/socket EPERM, Node not resolving `bun:sqlite`, shared resource locks, and unrelated stale snapshots/contracts. It also reproduced the live worker-pool wedge.
- `review.run --no-tests` initially found one `CATCH_TYPING` issue; fixed and rerun clean with zero findings.
- `verify` was attempted twice, but the live supervisor became unavailable during its test phase and no stamp was written. Use the explicitly logged no-verify push only with the focused evidence above.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- An established active, non-revoked workspace membership remains eligible for device enrollment after its original verification timestamp is older than 15 minutes.
- OAuth/device authorization preserves a stable rejection code and correlation ID while keeping sensitive server detail out of the browser response.
- The released internal dashboard can inspect enrollment state and invoke the bounded enrollment reset/reconcile operation without deleting the canonical user.
- Missing local agents and unavailable cloud device login remain recoverable and do not abort a local install.

existing local pattern:
- packages/os/tests/os-device-authority-worker.test.ts exercises device authority routes and store coordination.
- packages/os/tests/internal-user-dashboard*.test.ts exercises dashboard routing and HTML/API contracts.
- packages/os/tests/local-agent-connectivity.test.ts and installer tests cover nonfatal local-agent/device-login behavior.

new or changed tests:
- Add focused canonical device identity tests for established versus first-claim verification freshness.
- Add OAuth route tests for distinct rejection code and correlation ID.
- Extend dashboard/worker tests for enrollment inspection and reset/reconcile, reusing the stream/os reset implementation where sound.
- Retain existing installer recovery tests; only change them if a current regression is demonstrated.

focused red command:
- yarn nx show project os --json (discover exact targets), then run the narrow OS Vitest files through the declared target.

expected red failure:
- Current main rejects an active established membership when verifiedAt exceeds 15 minutes, collapses device authorization rejection into a generic forbidden response, and lacks the stable enrollment reset/dashboard integration.

no-test waiver: not applicable

## Scope boundaries

- Preserve unrelated worker-drain and repository changes.
- Do not delete canonical users or broad D1 records.
- Keep owner authorization enforced server-side; menu visibility is convenience, not the security boundary.
- Report unrelated validation failures separately.

- 2026-08-19 00:19:31 append: `.task/os/ship-owner-auth-dashboard-and-oauth-recovery-to-stable/workpad.md`

## workspace-owned: files read

- `packages/os/skills/task/SKILL.md`
