# gate internal dashboard routing on complete access config

branch: `task/os/gate-internal-dashboard-routing-on-complete-access-config`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2149/gate-internal-dashboard-routing-on-complete-access-config
github pr: https://github.com/consuelohq/opensaas/pull/2149
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

- 2026-08-16 22:29:59 fs.write: `.task/os/gate-internal-dashboard-routing-on-complete-access-config/workpad.md`
- 2026-08-16 22:32:10 fs.write: `.task/os/gate-internal-dashboard-routing-on-complete-access-config/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 22:32:26 `verify`: passed — OK

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

behavior under test: when the internal dashboard has no Access configuration, its shared-host paths must fall through to normal workspace routing instead of returning dashboard 401/403; complete configuration enables dashboard interception; partial configuration fails closed without falling through.
existing local pattern: install-control-plane docs state Access prerequisites must be satisfied before enabling the internal dashboard; the edge Worker already receives the three optional authorization bindings.
new or changed tests: add edge integration coverage for absent, complete, and partial dashboard Access configuration; remove unconditional deployment-secret requirements so a disabled dashboard does not block restoring the shared workspace Worker.
focused red command: cd packages/os && bun vitest run tests/internal-dashboard-integration.test.ts tests/cloudflare-worker-release-readiness.test.ts
expected red failure: absent dashboard bindings still intercept `/` and `/users`; release readiness currently treats an optional disabled dashboard as a hard deployment failure.
no-test waiver: not applicable

- 2026-08-16 22:29:59 append: `.task/os/gate-internal-dashboard-routing-on-complete-access-config/workpad.md`

## Implementation and verification

- Added explicit dashboard Access states: disabled when all three bindings are absent, configured only when all three are present (or a test authorizer is injected), and partial otherwise.
- Disabled state falls through to canonical workspace routing, so an incomplete dashboard rollout cannot seize `/`, `/users`, or other shared-host routes.
- Partial state returns `workspace_auth_unavailable` 503 before dashboard data or handlers run.
- Configured state preserves workspace-session validation, HTML login redirect, and Cloudflare Access operator authorization.
- Removed the unconditional dashboard secret requirement from Worker deployment readiness because absence now means safely disabled; the existing core edge secrets remain mandatory.
- Red: focused suites failed 3 assertions (disabled route received 403 instead of fallthrough 404, partial config received 403 instead of 503, optional-disabled deploy was rejected).
- Green: `internal-dashboard-integration`, `install-control-plane-cloudflare`, and `cloudflare-worker-release-readiness` passed 14/14.
- Green: `yarn nx run consuelo-os:typecheck` passed.

- 2026-08-16 22:32:10 append: `.task/os/gate-internal-dashboard-routing-on-complete-access-config/workpad.md`
