# Worker 02: Immutable Runtime-Bundle Builder and Customer Package Boundary

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` completely. Then read repository steering and both OS senior-engineer/task skills. Start a task from `stream/os-distribution` and preserve its task session.

You are not alone in the repository. Work with concurrent changes and never revert unrelated edits.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Create one explicit, testable runtime-bundle contract used by hosted installation, Bun compilation, mandatory clean-host tests, and later native packages. Stop treating broad source-directory copies as the customer distribution definition. “Artifact” remains the OS user-content concept.

## Current facts to verify

- `install-state.ts` currently treats `scripts`, `src`, `tooling`, `manifests`, and `hooks` as product package directories.
- `packages/os/Dockerfile` copies only a subset of runtime inputs.
- Customer-facing provider tools must remain possible.
- Consuelo release/WAF/route administration must not ship to customers.
- Multiple tool-manifest surfaces may currently compete.
- Worker 26 owns canonical tool-package and manifest layout. Consume that contract when integrated and do not create a competing manifest authority.

## Design requirements

The archive contract is independent of its eventual host install path. It must
not embed or prescribe `~/.consuelo/os/`. Worker 04 activates verified bundles
at `~/.consuelo/runtime/releases/<bundle-id>/` and advances
`~/.consuelo/runtime/current`; `node/`, `workspaces/`, and `components/` remain
outside the release tree.

Introduce a versioned runtime-bundle specification and builder with:

- platform and architecture;
- source commit and semantic/product version;
- a deterministic version-neutral `releaseFingerprint` over the classified customer runtime closure;
- content-addressed bundle ID;
- complete file allowlist with per-file digest, mode, and role;
- migration list;
- minimum updater version;
- signature metadata boundary;
- build provenance;
- deterministic ordering and reproducible archive output where practical.

The builder never chooses or increments a version. It first exposes the version-neutral release fingerprint to Worker 03. When Worker 03 supplies the single allocated SemVer, the builder produces each platform archive once and writes that exact version into every runtime-bundle manifest. A repeated build with the same source, fingerprint, version, platform, and inputs must be byte-identical.

Classify content by role rather than name:

```text
runtime
managed-skill
managed-tool
managed-site-template
platform-adapter
customer-provider
operator-only
test-only
source-only
```

The builder must fail if:

- an unclassified file enters the runtime bundle;
- a required runtime input is missing;
- an operator-only script is included;
- absolute machine paths or known internal test hosts are embedded;
- manifest and archive contents differ;
- two authoritative customer tool manifests disagree.

Define the exact Bun entrypoint and package-script keys the integration worker must wire. Do not edit shared/root package scripts in this parallel task; Worker 24 owns final script wiring and mechanical ordering.

## Customer/operator distinction

Do not remove Railway merely because its implementation is currently internal. Preserve the customer capability boundary and let the provider stream replace the implementation.

Explicitly exclude Consuelo-only release commands, WAF migration tooling, live route seeding, and production account defaults from customer runtime bundles.

## Owned files

- New runtime-bundle manifest/schema/builder modules under `packages/os/scripts/lib/distribution/` or an equivalent cohesive directory.
- New runtime-bundle contract tests.
- `packages/os/Dockerfile` only as needed to consume the shared runtime-bundle contract.
- The task-owned Bun entrypoint required to invoke the builder directly.
- A generated runtime-bundle inventory only if generation and drift checks are deterministic.

## Forbidden scope

- Do not implement channel publication or GitHub promotion.
- Do not implement updater activation/rollback.
- Do not rewrite provider adapters.
- Do not remove customer-facing capabilities to make the runtime bundle smaller.
- Do not include secrets in provenance.

## TDD and validation

Start with failing tests for missing required input, accidental operator file, digest drift, deterministic ordering, version-neutral fingerprint stability, supplied-version propagation, and clean-host/runtime-bundle parity. Then implement.

Run focused tests, build runtime bundles twice and compare their inventories/digests, inspect archive contents, and run relevant existing manifest/package tests.

## Completion output

Provide the runtime-bundle schema, exact allowlist policy, included/excluded category counts, commands, test evidence, and integration contract for channel and lifecycle workers.
