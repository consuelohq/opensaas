# add distribution test environments

branch: `task/os-distribution/add-distribution-test-environments`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1544/add-distribution-test-environments
github pr: https://github.com/consuelohq/opensaas/pull/1544
started: 2026-07-21

## acceptance criteria

- [x] Add one portable, structured OS distribution environment probe that runs with Bun on Linux, macOS, and Windows.
- [x] Prove isolated `CONSUELO_HOME`, writable filesystem, atomic replacement, and cleanup behavior without user or machine hard-coding.
- [x] Add a local clean-host runner that prefers Apple Container, falls back to Docker, and skips clearly when neither engine is available.
- [x] Add mandatory GitHub OCI/Linux plus native macOS and Windows jobs using the same probe and focused tests.
- [x] Keep the existing installer, steering, MCP, and security regression contracts unchanged and green locally.
- [x] Create GitHub deployment environments for `dev`, `canary`, `beta`, and `stable` without copying production secrets.
- [x] Populate the local-only environment registry with exact runner, workflow, fixture, command, and account coordinates.

## plan

1. Characterize the current OS test and CI boundaries.
2. Write focused probe and local-runner tests first and confirm the expected red failure.
3. Implement the smallest portable probe and local container runner.
4. Add a dedicated cross-platform GitHub Actions workflow.
5. Run focused tests, existing regression suites, local probe, and optional local container smoke.
6. Publish the task to `stream/os-distribution` after review and verification.

## test-first contract

- Behavior under test: one Bun entrypoint emits a redacted JSON report for an isolated Consuelo home and proves the filesystem operations required by later install/update workers.
- Existing pattern: Vitest tests under `packages/os/tests`, Bun scripts under `packages/os/scripts`, and OS contract jobs in `.github/workflows/consuelo-ci.yaml`.
- New tests: `packages/os/tests/distribution/environment-probe.test.ts` and `packages/os/tests/distribution/local-container-runner.test.ts`.
- Focused red command: `bun x vitest run tests/distribution/environment-probe.test.ts tests/distribution/local-container-runner.test.ts` from `packages/os`.
- Expected red failure: imports for the not-yet-created distribution probe and local container runner cannot resolve.
- Broader unchanged contracts: bootstrap source, install state, steering trace/raw steering, MCP gateway, security gateway, and workspace gateway suites.

## current status

- Implementation and local validation complete. Publishing the task so GitHub can prove the native and OCI matrix.

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

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red: focused tests failed because the probe and runner modules did not exist.
- Green: distribution suite passed with 12 tests and 10 explicit lifecycle TODO contracts.
- Green: 76 existing installer, steering, MCP, security, and workspace-gateway tests passed; 5 existing tests were skipped.
- Green: `bun run typecheck` completed the OS workspace syntax checks.
- Green: Apple Container `1.1.0` initialized successfully and ran the pinned `docker.io/oven/bun:1.3.14` OCI probe under Linux/arm64.
- Green: local planning validator found all 30 worker prompts, no missing references, and no structural or forbidden-content failures.

## key decisions

- Apple Container is the preferred local clean-Linux loop on Apple Silicon/macOS 26.
- Docker is an optional local fallback and the authoritative OCI engine in the GitHub Ubuntu job; it is not a customer runtime dependency.
- GitHub-hosted `ubuntu-24.04`, `macos-26`, and `windows-2025` runners are the cross-platform source of truth.
- Existing `consuelo / production` secrets and release behavior remain untouched.

## notes for ko

- Local-only planning lives at `packages/os/.workspace/consuelo-os-foundation/` and is excluded through `.git/info/exclude`.

## improvements noticed

- A later dev-environment tool should make lightweight environment checks part of `task.start`, while keeping privileged or expensive one-time host initialization explicit.

## issues and recovery

- The workspace MCP facade is not exposed in this Codex tool session. After the mandatory steering bootstrap succeeded earlier, repo work continued through the user-approved underlying Bun task scripts in the isolated worktree.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```
