# install OS dependencies in contract CI

branch: `task/security/install-os-dependencies-in-contract-ci`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1410/install-os-dependencies-in-contract-ci
github pr: https://github.com/consuelohq/opensaas/pull/1410
started: 2026-07-11

## acceptance criteria

- [x] Install the package-local OS Bun dependencies before the OS contract test step.
- [x] Preserve the root Yarn install and all existing OS contract commands.
- [x] Add a contract proving the package-local frozen install precedes tests.
- [x] Pass workflow security validation, focused tests, strict review, and verify.
- [ ] Promote into `stream/security`, refresh PR #1406, and merge after CI is green.

## plan

1. Add a workflow-order regression contract and reproduce the missing install.
2. Add the same package-local frozen Bun install already used by production release.
3. Run the focused test, OS typecheck, workflow security checker, strict review, and verify.
4. Publish, promote, wait for PR #1406 CI, merge, and verify production release.

## test-first contract

- Failure reproduced from GitHub OS contracts: Bun subprocesses could not resolve `hono` because the root Yarn action does not include `packages/os` as a workspace.
- New assertion: `local-os-server-review-findings.test.ts` requires `bun install --frozen-lockfile` in `packages/os` before `Run OS contract tests`.
- Initial red result: 1 workflow-contract failure and 13 existing passes.
- Safety: the test only reads workflow YAML and contains no destructive command literals.

## current status

- Root cause fixed. The focused contract, OS typecheck, workflow policy check, and strict review are green; verification and publication remain.

## files changed

- `.github/workflows/consuelo-ci.yaml`
- `packages/os/tests/local-os-server-review-findings.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-11 04:43:43 `review.run`: passed — OK
- 2026-07-11 04:44:05 `verify`: passed — OK

## key decisions

- Mirror production release's package-local frozen Bun install instead of adding `packages/os` to the root Yarn workspace.
- Keep the existing root Yarn action because other repository contract dependencies still rely on it.

## notes for ko

- This is a CI-install correction discovered after the seven review findings were already fixed and promoted.

## validation evidence

- Initial workflow contract: 1 expected failure and 13 existing passes.
- Final focused suite: 14 passed.
- `bun run --cwd packages/os typecheck`: passed.
- Workflow security checker: passed with no findings.
- Strict review against `origin/stream/security`: 0 findings.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-ci.yaml`
- `packages/os/tests/local-os-server-review-findings.test.ts`

- 2026-07-11 04:43:02 apply-patch: `.task/security/install-os-dependencies-in-contract-ci/workpad.md`
- 2026-07-11 04:43:02 apply-patch: `packages/os/tests/local-os-server-review-findings.test.ts`
- 2026-07-11 04:43:02 apply-patch: `.github/workflows/consuelo-ci.yaml`

- 2026-07-11 04:43:54 apply-patch: `.task/security/install-os-dependencies-in-contract-ci/workpad.md`

## workspace-owned: test selection

- changed files: `.github/workflows/consuelo-ci.yaml`, `.task/security/install-os-dependencies-in-contract-ci/current.json`, `.task/security/install-os-dependencies-in-contract-ci/evidence-log.json`, `.task/security/install-os-dependencies-in-contract-ci/read-log.json`, `.task/security/install-os-dependencies-in-contract-ci/session.json`, `.task/security/install-os-dependencies-in-contract-ci/workpad.md`, `.task/tasks/security/install-os-dependencies-in-contract-ci.json`, `packages/os/tests/local-os-server-review-findings.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
