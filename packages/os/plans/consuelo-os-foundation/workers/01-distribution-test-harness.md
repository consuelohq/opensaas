# Worker 01: Distribution Test Harness and Acceptance Contract

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` completely before taking any action. Then read repository steering, `packages/os/skills/senior-engineer/SKILL.md`, and `packages/os/skills/task/SKILL.md`.

You are not alone in the repository. Do not revert unrelated changes. Start an isolated task from `stream/os-distribution`, capture its task session, and use it for every task-scoped operation.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Build the test foundation that proves clean install, update, repair, rollback, retention, and cross-platform runtime-bundle behavior before later workers implement those systems. Populate the exact environment registry in section 11.1 of the master plan; this is the sole remaining gate before the other implementation workers may be dispatched.

This task owns tests and test harnesses, not the production lifecycle implementation.

## Required investigation

- Inventory current installer, bootstrap, release, health, MCP, steering, and service tests.
- Treat existing behavioral suites as regression contracts, especially steering, install state, skills registry, MCP gateway, and security gateway tests. Record which assertions are characterization versus an explicitly approved behavior change.
- Verify whether Docker and Apple `container` are currently referenced anywhere.
- Identify test seams that avoid network, live Cloudflare, Google, or real user credentials.
- Record current behavior for repeated hosted installs and release accumulation.

## Implementation scope

Create a distribution test harness under a dedicated OS-owned path such as:

```text
packages/os/tests/distribution/
packages/os/scripts/testing/distribution/
```

The harness must support:

- isolated temporary `CONSUELO_HOME` values;
- fake signed channel and runtime-bundle manifests;
- local fixture runtime-bundle servers or injected fetch implementations;
- deterministic fake platform-service adapters;
- failure injection at download, verification, migration, activation, health, and rollback stages;
- redacted diagnostics assertions;
- test fixtures representing no install, current install, N-1 install, modified managed content, interrupted install, and corrupted current link;
- a portable runner interface usable directly on macOS, inside an OCI-compatible container, and in GitHub Linux/macOS/Windows runners.

The clean OCI lane is mandatory in CI. Local container execution is opportunistic: detect Apple `container`, then Docker, otherwise return a clear local skip while preserving the mandatory CI gate. Do not require Ko to install or repair a local container engine.

Populate the master environment registry with the exact workflow files, job names, runner/image labels, fixture commands and locations, Cloudflare test resource names/TTL/cleanup, and symbolic test identities. Verify every coordinate works before removing the dispatch gate. Record secret names only, never values.

## Required failing specifications

Add behavioral tests that remain failing or explicitly pending only where production implementation belongs to later tasks:

1. Clean install activates one verified runtime bundle.
2. Existing install updates without onboarding.
3. Failed post-activation health check restores the previous runtime bundle.
4. Interrupted download never changes `current`.
5. Signature or digest mismatch fails closed.
6. Retention keeps current, previous, and pinned only.
7. Uninstall preserves user-owned content by default.
8. Modified managed content is never overwritten silently.
9. Channel promotion cannot rebuild or mutate runtime-bundle bytes.
10. Structured diagnostics contain no representative tokens or provider secrets.

Mark cross-task pending tests with an issue/task reference and a clear owner. Do not weaken assertions to make the suite green prematurely.

## Owned files

- New files under `packages/os/tests/distribution/`.
- New files under `packages/os/scripts/testing/distribution/`.
- Direct Bun test entrypoints inside the owned harness. Defer shared/root package-script wiring to Worker 24 so Wave 0 remains parallel-safe.

## Forbidden scope

- Do not implement production install/update/rollback behavior.
- Do not edit Cloudflare Workers, auth routes, provider tools, native app code, or site routing.
- Do not add Docker as a required customer runtime.
- Do not hard-code Ko's filesystem paths or machines.

## Validation

- Run all new harness tests.
- Run existing installer/bootstrap tests that touch the same test helpers.
- Run the existing steering and gateway regression suites unchanged. Where a later approved task must alter an assertion, leave a named pending contract rather than weakening it here.
- Prove direct Bun-hosted fixtures work without a local container engine.
- Add and run the mandatory GitHub OCI/Linux lane plus macOS and Windows runner contracts. If Docker or Apple `container` is locally available, run the same OCI fixture and record evidence; local absence is not a task failure.

## Completion output

Report changed files, fixture architecture, pending-contract tests and their owners, exact commands/results, and any limitation that later lifecycle workers must respect.
