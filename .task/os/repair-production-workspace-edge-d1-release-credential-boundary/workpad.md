# repair production workspace edge d1 release credential boundary

branch: `task/os/repair-production-workspace-edge-d1-release-credential-boundary`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2118/repair-production-workspace-edge-d1-release-credential-boundary
github pr: https://github.com/consuelohq/opensaas/pull/2118
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 03:39:39 fs.write: `.task/os/repair-production-workspace-edge-d1-release-credential-boundary/workpad.md`
- 2026-08-16 03:42:08 fs.write: `.task/os/repair-production-workspace-edge-d1-release-credential-boundary/workpad.md`
- 2026-08-16 03:44:31 fs.write: `.task/os/repair-production-workspace-edge-d1-release-credential-boundary/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 03:42:35 `review.run`: passed — OK
- 2026-08-16 03:43:37 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: A production OS release must use a Cloudflare credential that is authorized for both the Device Authority release path and the Workspace Edge D1 migration/deploy path; the release must fail before partial cloud mutation when the required Workspace Edge/D1 credential is absent or mis-scoped.
existing local pattern: `Consuelo Production Release` invokes the canonical OS release script; Device Authority snapshot/R2/Worker publication succeeds before Workspace Edge migration today, so a D1-incompatible token can strand a partially updated release.
new or changed tests: inspect existing production-release credential contract tests first; if the workflow has a code-level credential selection/fail-fast gap, add a focused RED assertion covering the dedicated Workspace Edge credential and preflight ordering. If the repository contract is already correct and only the configured secret value is stale, record a no-code waiver and manually converge with the authorized local Wrangler session.
focused red command: pending discovery of the existing production release workflow test.
expected red failure: production workflow either reuses a token that cannot query Workspace Edge D1, or does not preflight the D1 permission before publishing R2/Device Authority assets.
no-test waiver: only if repository code already enforces the correct credential boundary and the failure is purely external secret configuration.

- 2026-08-16 03:39:39 append: `.task/os/repair-production-workspace-edge-d1-release-credential-boundary/workpad.md`

## RED to GREEN evidence

- Production run 31924469591 published the new immutable site snapshots, deployed Device Authority, refreshed the workspace route registry, and then failed at the Workspace Edge D1 migration with Cloudflare authorization code 7403.
- Root cause in repository contract: the production workflow allowed the dedicated Workspace Edge credential to fall back to the OS provisioning credential, even though provisioning does not guarantee D1 access. It also did not verify D1 access before beginning OS release mutations.
- RED: `bun --cwd packages/os test tests/production-release-mcp-security.test.ts` => 2 pass / 1 fail. New contract failed because the workflow still used the provisioning fallback and lacked a preflight.
- Implementation: production OS release now requires `CLOUDFLARE_WORKSPACE_EDGE_API_TOKEN` directly for full OS releases and runs a read-only `SELECT 1 AS ok` against the Workspace Edge route-registry D1 before invoking `os:release`. Manual `os-device-auth`-only releases remain exempt because they intentionally do not release Workspace Edge.
- GREEN: same focused suite => 3 pass / 0 fail.

## current status
- Durable credential-boundary fix is implemented and focused GREEN. Next: strict review/formal verification, merge to stream/main, then manually converge Workspace Edge from an authorized local Wrangler session and finish runtime canary promotion/update/restart.

- 2026-08-16 03:42:08 append: `.task/os/repair-production-workspace-edge-d1-release-credential-boundary/workpad.md`

## verification boundary

- Strict review: 0 issues, 0 blockers.
- Focused production-release security test: 3 pass / 0 fail.
- Full verify selects the entire `packages/os` package test because this new regression lives under `packages/os/tests`; it fails on existing facade assertions unrelated to either changed file. Review and DB guard pass. No task-local failure was reported.
- Proceeding with the already-approved task publish override for unrelated broad-verifier failures; no unrelated facade code will be changed for this release-boundary patch.

- 2026-08-16 03:44:31 append: `.task/os/repair-production-workspace-edge-d1-release-credential-boundary/workpad.md`
