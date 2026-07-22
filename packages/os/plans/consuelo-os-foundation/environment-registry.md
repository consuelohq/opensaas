# Consuelo OS environment registry

Updated: 2026-07-22

## Local development

| Coordinate | Value |
| --- | --- |
| Primary internal node | Mac Mini, channel `dev` |
| Real-machine acceptance node | MacBook Air, channels `canary` then `beta`; Ko controls availability and install checkpoints |
| Preferred local clean-host engine | Apple Container `1.1.0` on Apple Silicon/macOS 26 |
| Verified installer asset | `container-1.1.0-installer-signed.pkg` |
| Verified installer SHA-256 | `0ca1c42a2269c2557efb1d82b1b38ac553e6a3a3da1b1179c439bcee1e7d6714` |
| Durable installer copy | `~/Downloads/Consuelo Development/container-1.1.0-installer-signed.pkg` |
| Installed CLI | `/usr/local/bin/container` |
| Persistent service state | `~/Library/Application Support/com.apple.container/` |
| Local fallback | Docker CLI, optional; daemon currently stopped |
| Host probe | `bun packages/os/scripts/testing/distribution/environment-probe.ts --json` |
| Local OCI probe | `bun packages/os/scripts/testing/distribution/local-container-runner.ts` |
| OCI image | `docker.io/oven/bun:1.3.14` |
| Durable task worktree root | `~/Dev/opensaas-worktrees/` |
| Independent review wrapper | `bun run --cwd packages/os subagent -- --provider grok --model grok-4.5 --bundle core --policy read --instruction-path <task-worktree>/packages/os/.tmp-reviews/<task>/grok-prompt.md --cwd <task-worktree> --task-session <task-session> --timeout-ms 900000 --output-format json --workspace-only preferred`; read policy enforces Grok plan mode with bounded turns |

Verified 2026-07-22: Apple Container system initialization completed, the service reported `running`, and the local OCI probe passed under Linux/arm64 with Bun `1.3.14`.

## Future dev-environment automation

The later dev-environment tool should run a lightweight environment check from `task.start` and return structured missing-capability data. It must separate:

- idempotent per-task checks and fixture creation;
- explicit one-time host setup such as installing Apple Container or its kernel;
- optional capabilities such as Docker;
- cleanup scoped to the current task or run ID.

It must not silently install privileged host software, initialize a large VM/kernel, or mutate another real node during ordinary task startup. This registry is the input contract for that later tool; Worker 01 does not implement the tool itself.

## Environment failure policy

If a registered lane, OS task session, workspace-first route, provider/model authentication, GitHub posting path, or required fixture is broken, unavailable, or mismatched, the worker stops and records the exact failure on its PR. It fixes or realigns the environment before product implementation continues. There is no environment fallback to another machine, provider, production resource, or unscoped tool.

## GitHub compatibility matrix

Workflow: `.github/workflows/consuelo-os-distribution-environments.yaml`

| Lane | Job | Runner/image | Artifact |
| --- | --- | --- | --- |
| OCI clean host | `oci-clean-host` | `ubuntu-24.04` + `docker.io/oven/bun:1.3.14` | `consuelo-os-distribution-oci-<run-id>` |
| Linux native | `native-runtime` / `linux` | `ubuntu-24.04` | `consuelo-os-distribution-linux-<run-id>` |
| macOS native | `native-runtime` / `macos` | `macos-26`, Apple Silicon arm64 | `consuelo-os-distribution-macos-<run-id>` |
| Windows native | `native-runtime` / `windows` | `windows-2025` | `consuelo-os-distribution-windows-<run-id>` |
| Existing regressions | `regression-contracts` | `ubuntu-24.04` | GitHub job logs |

Focused test command:

```bash
bun x vitest run tests/distribution
```

Existing regression command is encoded in the workflow and retains bootstrap, install-state, steering, MCP, security, and workspace-gateway suites unchanged.

Verified on PR `#1544` at commit `77e0e2ebdeaceafd26b1c376daacdec30b0a3875`: clean OCI, native Linux, native macOS, native Windows, existing distribution regressions, OS contracts, workflow security, and full workspace verification all passed.

The cleanup hardening in PR `#1550` allocates every probe beneath a `mkdtemp`-owned directory and removes only that directory. Caller-supplied `--home` parents, including home-like, normalized-parent, repository-like, and isolated `.consuelo` paths, remain intact. The task and environment harness were promoted through stream PR `#1548` and merged into `main` at `92fdaf6129a644b02d5baff5a1884189527171c1`; the fresh stream matrix and full workspace verification passed before merge.

## Promotion environments

These GitHub deployment environments exist and intentionally contain no copied production secrets:

- `consuelo-os-dev`
- `consuelo-os-canary`
- `consuelo-os-beta`
- `consuelo-os-stable`

The existing `consuelo / production` environment remains unchanged. Later release workers attach immutable artifacts and promotion approvals to the new environments.

## Runtime-bundle fixtures

| Coordinate | Value |
| --- | --- |
| Fixture root | `packages/os/scripts/testing/distribution/` |
| Fixture server | `bun packages/os/scripts/testing/distribution/runtime-fixture-server.ts` |
| Channel endpoint | `/channels/dev.json` |
| Bundle endpoint | `/bundles/runtime.tar.gz` |
| Signing key source | Public deterministic test-only key embedded in `fixtures.ts`; never a production key |
| Failure injection | `DistributionFailureInjector` phases: download, verification, migration, activation, health, rollback |
| Platform service adapter | `FakePlatformService` |
| Teardown | `SIGINT` or `SIGTERM`; test API uses `await fixture.close()` |

## Cloudflare integration boundary

Worker 01 uses the local fixture server and injected adapters so ordinary tests require no Cloudflare account or user credentials. The live integration lane is reserved as follows and remains blocked until its dedicated least-privilege test token is added:

| Coordinate | Reserved value |
| --- | --- |
| GitHub environment | `consuelo-os-dev` |
| Secret name | `CLOUDFLARE_OS_TEST_API_TOKEN` |
| Account variable | `CLOUDFLARE_ACCOUNT_ID` |
| Worker prefix | `consuelo-os-dist-test-<run-id>` |
| R2 prefix | `consuelo-os-dist-test/<run-id>/` |
| D1 fixture prefix | `consuelo-os-dist-test-<run-id>` |
| Hostname prefix | `os-dist-<run-id>.consuelohq.com` |
| Maximum TTL | 6 hours |
| Cleanup owner | Worker 17 web/security integration harness; cleanup must run under `always()` and delete only the current run ID |

No live Cloudflare test resources were created by Worker 01. Later workers must not reuse production workspace records, routes, tunnels, D1 rows, or R2 objects as test fixtures.

## Symbolic identities

- account: `os-dist-account`
- workspace: `os-dist-workspace`
- dev node: `os-dist-node-dev`
- canary node: `os-dist-node-canary`
- beta node: `os-dist-node-beta`

These are fixture labels only. Tests must never embed personal identifiers, real workspace hosts, or secrets.

## Remaining gates

- Add the dedicated Cloudflare test token only when Worker 17 implements the live integration lifecycle; do not reuse production release credentials.
