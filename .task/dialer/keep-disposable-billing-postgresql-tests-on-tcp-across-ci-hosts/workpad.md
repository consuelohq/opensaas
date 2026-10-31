# Keep disposable billing PostgreSQL tests on TCP across CI hosts

branch: `task/dialer/keep-disposable-billing-postgresql-tests-on-tcp-across-ci-hosts`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2727/keep-disposable-billing-postgresql-tests-on-tcp-across-ci-hosts
github pr: https://github.com/consuelohq/opensaas/pull/2727
started: 2026-10-31

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

- none yet

## workspace-owned: validation evidence

- 2026-10-31 01:50:36 `verify`: passed — OK

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
Behavior: disposable PostgreSQL uses TCP loopback only and never relies on host-level Unix socket directory permissions.
Focused red evidence: GitHub Consuelo / verify run41156669950, native billing suite3 fail; all three pg_ctl18 server startups failed on Linux while matching tests passed on macOS.
Existing local pattern: isolated pg_config/initdb/pg_ctl fixtures connect pg.Pool to127.0.0.1 random port.
Changed tests: existing native+legacy checkout and upgrade PostgreSQL acceptance fixtures, no implementation-mirroring unit test.
Green command: bun packages/dialer-server/scripts/verify-native-billing.ts, then exact-head full verify/CI.
Scope: test harness only. No application billing behavior, live database, tenant data, call or payment mutation.
Nx Cloud connection check absent; use GitHub CI logs, not a competing Nx self-healing loop.
