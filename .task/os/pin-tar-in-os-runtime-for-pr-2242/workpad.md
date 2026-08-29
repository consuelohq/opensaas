# Pin tar in OS runtime for PR 2242

branch: `task/os/pin-tar-in-os-runtime-for-pr-2242`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2244/pin-tar-in-os-runtime-for-pr-2242
github pr: https://github.com/consuelohq/opensaas/pull/2244
started: 2026-08-28

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

- 2026-08-28 02:48:30 fs.write: `.task/os/pin-tar-in-os-runtime-for-pr-2242/workpad.md`
- 2026-08-28 02:49:12 fs.write: `.task/os/pin-tar-in-os-runtime-for-pr-2242/workpad.md`

## workspace-owned: validation evidence

- none yet

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

behavior under test: the published Consuelo OS dependency graph resolves tar 7.5.22 rather than tar 7.5.13
existing local pattern: package-level Bun override plus regenerated packages/os/bun.lock; release packaging consumes packages/os/package.json and packages/os/bun.lock
new or changed tests: exact manifest/lockfile resolution assertion plus existing runtime-bundle publication tests
focused red command: inspect packages/os/package.json and packages/os/bun.lock before edit
expected red failure: packages/os/package.json has no override and packages/os/bun.lock resolves tar@7.5.13
no-test waiver: dependency metadata only; existing release tests, typecheck, exact resolution assertion, and audit are the behavioral gates

## Scope

- Add tar 7.5.22 to packages/os/package.json overrides.
- Regenerate packages/os/bun.lock.
- Address GitHub Codex P1 on PR #2242 without expanding into unrelated advisories.

- 2026-08-28 02:48:30 append: `.task/os/pin-tar-in-os-runtime-for-pr-2242/workpad.md`

## Validation evidence

- Red confirmed on stream head: no OS override and tar@7.5.13 in packages/os/bun.lock.
- Green: OS package override and lockfile both resolve tar@7.5.22.
- Runtime bundle/publication tests: 23 pass, 0 fail.
- OS typecheck/syntax: passed.
- Previous focused production audit after the identical correction reported no tar finding; unrelated OS advisories remain outside this release correction.

- 2026-08-28 02:49:12 append: `.task/os/pin-tar-in-os-runtime-for-pr-2242/workpad.md`
