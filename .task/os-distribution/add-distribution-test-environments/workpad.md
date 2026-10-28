# add distribution test environments

branch: `task/os-distribution/add-distribution-test-environments`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1544/add-distribution-test-environments
github pr: https://github.com/consuelohq/opensaas/pull/1544
started: 2026-07-21

## acceptance criteria

- [x] Add a portable structured environment probe that runs on Linux, macOS, and Windows.
- [x] Prove isolated `CONSUELO_HOME`, writable filesystem access, atomic replacement, and cleanup without user- or machine-specific hardcoding.
- [x] Add a local runner that prefers Apple Container, falls back to Docker, and reports a clear skip when neither engine is available.
- [x] Add mandatory GitHub jobs for a clean OCI environment, native Linux, native macOS, and native Windows.
- [x] Keep existing installer, steering, MCP, and security regression coverage unchanged and green locally.
- [x] Create GitHub environments for dev, canary, beta, and stable without copying production secrets.
- [x] Record the exact local and hosted environment coordinates in the local-only OS environment registry.

## plan

1. Characterize the existing OS test and CI boundaries.
2. Write focused distribution environment tests first and confirm the expected red state.
3. Implement the portable probe, fixture services, and local container runner.
4. Add the cross-platform GitHub workflow without weakening existing regressions.
5. Run focused tests, existing regressions, typecheck, strict review, full verify, and a real Apple Container smoke test.
6. Publish to `stream/os-distribution` after the review and CI matrix are green.

## test-first plan

- Behavior: one Bun entrypoint emits redacted structured JSON for an isolated home and proves filesystem operations.
- Existing pattern: Vitest tests and Bun-owned scripts under `packages/os`.
- Focused coverage: environment probe, fixture harness, lifecycle contracts, local runner, and workflow contract.
- Initial red proof: focused tests failed because the new testing modules did not exist.
- Unchanged contracts: installer, steering, MCP, security, bootstrap, and runtime regressions remain owned by their existing suites.

## current status

- Implementation and local validation are complete.
- The first GitHub matrix passed clean OCI, native Linux, native macOS, distribution regressions, and repo-wide checks.
- Native Windows caught one POSIX-only test expectation while the implementation itself returned the correct Windows path.
- The assertion now uses Node's platform path resolver. Focused tests, strict review, and full verify pass locally; the PR matrix needs the follow-up commit and rerun.

## files changed

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `packages/os/scripts/testing/distribution/environment-probe.ts`
- `packages/os/scripts/testing/distribution/fake-platform-service.ts`
- `packages/os/scripts/testing/distribution/fixtures.ts`
- `packages/os/scripts/testing/distribution/local-container-runner.ts`
- `packages/os/scripts/testing/distribution/runtime-fixture-server.ts`
- `packages/os/tests/distribution/environment-probe.test.ts`
- `packages/os/tests/distribution/fixture-harness.test.ts`
- `packages/os/tests/distribution/lifecycle-contract.test.ts`
- `packages/os/tests/distribution/local-container-runner.test.ts`
- `packages/os/tests/distribution/workflow-contract.test.ts`
- task metadata and this workpad

## workspace-owned: files changed

- No workspace-owned source files beyond task metadata.

## workspace-owned: activity log

- Started the task with the underlying Bun task workflow after the workspace facade became unavailable after bootstrap.
- Published the initial implementation to PR #1544.
- Recovered the task after a host restart into `/Users/kokayi/Dev/opensaas-worktrees/task-os-distribution-add-distribution-test-environments`.
- Fixed the Windows assertion after the native Windows runner exposed a POSIX-only expectation.

## workspace-owned: validation evidence

- Red: focused tests failed on missing distribution test modules before implementation.
- Focused distribution suite: 12 passed, 10 future lifecycle contracts marked todo.
- Existing OS regressions: 76 passed, 5 skipped.
- `bun run typecheck`: passed.
- Apple Container 1.1.0 OCI smoke: passed on Linux arm64 with Bun 1.3.14.
- Local-only plan validator: 30 workers referenced, no structural or forbidden failures.
- Strict review: 0 findings after explicit error-boundary fixes.
- Full verify: passed with a publish-valid verification stamp.
- First GitHub matrix: all jobs passed except native Windows, which reported `D:\\tmp\\opensaas:/workspace:ro` against a POSIX-only expected string. The test now derives the expected host path with `node:path.resolve`.

## key decisions

- Apple Container is the preferred local clean-Linux engine on supported Macs.
- Docker remains an optional local fallback and the authoritative OCI engine in GitHub's Ubuntu runner.
- Native GitHub runners are the cross-platform source of truth.
- The existing `consuelo / production` GitHub environment and its secrets remain untouched.
- Durable task worktrees live under `/Users/kokayi/Dev/opensaas-worktrees`, not macOS temporary storage.
- A future `task.start` development-environment check must separate fast idempotent checks from one-time privileged host setup.

## notes for ko

- GitHub environments now exist for `consuelo-os-dev`, `consuelo-os-canary`, `consuelo-os-beta`, and `consuelo-os-stable`; they contain no copied production secrets.
- The Cloudflare development token is intentionally deferred until the live web-security worker needs it.
- The local Apple Container installer is retained under `/Users/kokayi/Downloads/Consuelo Development/`.

## improvements noticed

- The task workflow should default to a durable worktree root instead of the host temporary directory.
- A future OS development-environment tool should report prerequisites and perform only bounded, explicit setup.

## issues and recovery

- The workspace MCP facade was unavailable after the mandatory bootstrap, so Ko approved the underlying Bun task scripts for this work.
- A computer restart removed the default temporary worktree, but the pushed commit and PR remained safe.
- Recovery with `task:start --pr 1544 --worktree-root /Users/kokayi/Dev/opensaas-worktrees` restored the task into a durable location.
- Recovery regenerated this workpad template; the completed evidence was reconstructed before the follow-up push.
- Native Windows found a test portability issue, not a runtime implementation defect.

---

## publish checklist

```bash
bun run task:push -- --message "test(os): make container assertion platform-aware" --changed
bun run task:pr
bun run task:finish
```
