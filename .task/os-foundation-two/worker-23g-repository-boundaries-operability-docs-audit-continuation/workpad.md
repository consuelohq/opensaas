# Worker 23g repository boundaries, operability, and documentation audit

Candidate: ef2530b136ec2a170915b583abfb2341899bd6ab
Authorized fallback: PR #1674
Task session: tsk_083b6b6e0036
Review-only PR: unavailable; baseline SHA unavailable.

## Intent-lineage matrix

| Original prompt | Exact requirement | Authoritative domain / secondary seam | Implementation lineage | Current location | Initial evidence state |
|---|---|---|---|---|---|
| 26-tool-package-layout.md | Mission: one canonical tool-package architecture and generated manifest resolver | 23G; secondary 23E | PR 1561, PR 1575, PR 1674 | packages/os/tools and packages/os/manifests | reviewed below |
| 26-tool-package-layout.md | Current facts: scripts/tooling/tools inventory and mixed authorities | 23G; secondary 23E | PR 1561, PR 1575 | packages/os/scripts, packages/os/tooling, packages/os/tools | reviewed below |
| 26-tool-package-layout.md | Target structure: tools domains, manifests config/schemas/generated, workflows source/generated, scripts entrypoints | 23G; secondary 23E | PR 1561, PR 1575 | packages/os/tools, manifests, workflows, scripts | reviewed below |
| 26-tool-package-layout.md | Req 1: inventory every manifest tool to implementation/schema/tests/dependencies/directory | 23G; secondary 23E | PR 1561, PR 1575 | generated manifests and tool packages | reviewed below |
| 26-tool-package-layout.md | Req 2: classify every top-level script as handler/lifecycle/generator/operator/test/dead | 23G; secondary 23E | PR 1561 | packages/os/scripts and audit fixture | reviewed below |
| 26-tool-package-layout.md | Req 3: one contribution schema and deterministic aggregate generator | 23G; secondary 23E | PR 1561, PR 1575 | manifests/manifest.config.ts and generator | reviewed below |
| 26-tool-package-layout.md | Req 4: migrate active handlers in bounded vertical slices without broad rewrite | 23G; secondary 23E | PR 1561, PR 1674 | packages/os/tools | reviewed below |
| 26-tool-package-layout.md | Req 5: preserve IDs/schemas/scopes/approvals/behavior; remove stale four-entry surface without aliases | 23G; secondary 23E | PR 1561, PR 1575 | generated manifests, tools, tests | reviewed below |
| 26-tool-package-layout.md | Req 6: full catalog plus explicit core; parity without fixed product limit; only full/core ship | 23G; secondary 23E | PR 1561, PR 1575 | manifests/generated | reviewed below |
| 26-tool-package-layout.md | Req 7: workflow source/output under workflows and separate from tool manifest | 23G; secondary 23E | PR 1561, PR 1575 | packages/os/workflows | reviewed below |
| 26-tool-package-layout.md | Req 8: parity fixture internal; schemas under manifests/schemas; exclude both from runtime | 23G; secondary 23E | PR 1561 | tests/audit/fixtures, manifests/schemas, runtime classifier | reviewed below |
| 26-tool-package-layout.md | Req 9: remove manifest-sources and delete packages/os/tooling only after consumers/tests cut over | 23G; secondary 23E | PR 1561, PR 1575 | packages/os/tooling and repository references | reviewed below |
| 26-tool-package-layout.md | Req 10: classify legacy Python tools and migrate/retain/delete with proof | 23G; secondary 23E | PR 1561 | packages/os/tools and runtime bundle | reviewed below |
| 26-tool-package-layout.md | Req 11: runtime allowlist includes handlers/full/core/workflows and excludes source/schema/audit fixtures | 23G; secondary 23E | PR 1561, PR 1571, PR 1574 | runtime-bundle classifier/tests | reviewed below |
| 26-tool-package-layout.md | Constraints: no handler rewrite, mass ID/schema sweep, duplicate manifests, shims, lifecycle migration, deletion, tooling reintroduction | 23G; secondary 23E | PR 1561, PR 1575, PR 1674 | history/imports/manifests/scripts | reviewed below |
| 26-tool-package-layout.md | Tests: resolver uniqueness, no orphan/unknown, deterministic bytes, drift CI, behavior/scopes/discovery parity | 23G; secondary 23E | PR 1561, PR 1575 | packages/os/tests and CI | reviewed below |
| 26-tool-package-layout.md | Tests: workflows green, stale sources absent, allowlist correct, no tooling runtime/import refs | 23G; secondary 23E | PR 1561, PR 1575 | workflows/tests/runtime classifier | reviewed below |
| 26-tool-package-layout.md | Acceptance: one authority, clear ownership, justified scripts, tooling removed, facade parity | 23G; secondary 23E | PR 1561, PR 1575, PR 1674 | canonical manifests and consumers | reviewed below |
| 28-repository-product-boundary-audit.md | Mission/current facts: monorepo boundaries, inherited Twenty, mixed CLI, licensing, Yarn/Bun, deployment references | 23G; secondary 23E | PR 1562, PR 1576, PR 1577 | packages, manifests, workflows, docs | reviewed below |
| 28-repository-product-boundary-audit.md | Inventory 1: classify every active top-level package and owner | 23G; secondary 23E | PR 1562, PR 1576 | package tree and metadata | reviewed below |
| 28-repository-product-boundary-audit.md | Inventory 2: dependency graph across packages/os and OS consumers | 23G; secondary 23E | PR 1562, PR 1576 | package manifests/imports/bundle | reviewed below |
| 28-repository-product-boundary-audit.md | Inventory 3: build/test/release/deployment workflow ownership | 23G; secondary 23E | PR 1562, PR 1576 | Nx, GitHub workflows, Docker, deploy | reviewed below |
| 28-repository-product-boundary-audit.md | Inventory 4: git history and contributor/license provenance | 23G | PR 1562, PR 1576 | history, notices, vendor trees | reviewed below; live copyright validation unavailable |
| 28-repository-product-boundary-audit.md | Inventory 5: root/package licenses, policy docs, copyright, brand text | 23G | PR 1562, PR 1576 | licenses and package docs | reviewed below; counsel approval unavailable |
| 28-repository-product-boundary-audit.md | Inventory 6: Twenty/OpenSaaS/Consuelo HQ/old URL/repo/package/installer/CLI references | 23G; secondary 23E | PR 1562, PR 1576 | repository-wide source/docs/workflows | reviewed below |
| 28-repository-product-boundary-audit.md | Inventory 7: Yarn/Bun/npm/Corepack/Nx/lockfile/patch/Docker/Railway/CI usage | 23G; secondary 23E | PR 1562, PR 1576 | manifests, lockfiles, CI, Docker | reviewed below |
| 28-repository-product-boundary-audit.md | Inventory 8: generated/vendor/upstream naming and notices retained | 23G | PR 1562, PR 1576 | twenty trees, upstream/vendor | reviewed below; complete provenance signoff unavailable |
| 28-repository-product-boundary-audit.md | Inventory 9: production/development systems resolving GitHub paths/package names | 23G; secondary 23E | PR 1562, PR 1576 | workflows, Cloudflare/Railway, installer URLs | reviewed below |
| 28-repository-product-boundary-audit.md | Decision: compare monorepo, extraction, staged hybrid on release/history/legal/CI/deploy/brand | 23G; secondary 23E | PR 1562, PR 1576, PR 1577 | audit plan/workpad | reviewed below; future approval unavailable |
| 28-repository-product-boundary-audit.md | Target tree: OS, dialer, shared, inherited Twenty, archive, operator, generated/vendor | 23G; secondary 23E | PR 1562, PR 1576 | packages tree and docs | reviewed below |
| 28-repository-product-boundary-audit.md | Guardrail: Ko chooses Consuelo vs Consuelo HQ; MIT is legal/provenance decision | 23G | PR 1562, PR 1576 | license/brand docs | reviewed below; Ko/counsel approval unavailable |
| 28-repository-product-boundary-audit.md | Yarn-to-Bun: no one-shot promise; blockers and bounded rollback phases | 23G; secondary 23E | PR 1562, PR 1576 | package manifests, CI, Docker | reviewed below |
| 28-repository-product-boundary-audit.md | Acceptance: owner classification, extraction/history/license constraints, rollback, URL/docs/deploy map, Ko-ready decision | 23G; secondary 23E | PR 1562, PR 1576, PR 1577 | audit docs and current code/docs | reviewed below |
| 30-cli-product-split.md | Current behavior: packages/cli mixes sales/GTM, Twenty/Twilio/coaching, deploy, and OS | 23G; secondary 23E | PR 1647 and PR 1674 | packages/cli and command registrations | reviewed below |
| 30-cli-product-split.md | Target: consuelo lifecycle only; consuelo-dialer preserves sales/GTM | 23G; secondary 23E | PR 1647 and PR 1674 | packages/cli and intended dialer package | reviewed below |
| 30-cli-product-split.md | Req 1: OS binary is a thin lifecycle adapter | 23G; secondary 23A | PR 1647 commits 2041cd1, 7f9517, ccc886, 07936b | packages/cli/src/commands/os and OS scripts | reviewed below |
| 30-cli-product-split.md | Req 2: sales/GTM registration under dialer binary | 23G; secondary 23C/23E | PR 1647 and follow-ups | packages/cli/src and intended dialer package | reviewed below |
| 30-cli-product-split.md | Req 3: separate OS and dialer config namespaces | 23G; secondary 23A | PR 1647 | CLI config/loaders and OS config | reviewed below |
| 30-cli-product-split.md | Req 4: preserve JSON/quiet/error behavior | 23G; secondary 23A | PR 1647, b60dae0 | CLI entrypoints/tests | reviewed below |
| 30-cli-product-split.md | Req 5: restart delegates to Worker 04 lifecycle | 23G; secondary 23A/23D | PR 1647, 2041cd1, 07936b | restart command and reload script | reviewed below |
| 30-cli-product-split.md | Req 6: preserve public curl installer unchanged | 23G; secondary 23E | PR 1647 | installer docs/scripts/workflows | reviewed below |
| 30-cli-product-split.md | Req 7: delete old consuelo os registration after cutover, no shim | 23G; secondary 23A/23E | PR 1647, ad453d3, 2041cd1 | CLI registration/tests/docs | reviewed below |
| 30-cli-product-split.md | Req 8: no publish/global install from worker | 23G; secondary 23E | PR 1647 | package scripts/release workflows | reviewed below; registry side effects unavailable |
| 30-cli-product-split.md | Tests: OS excludes dialer/Twenty/Twilio/coaching; dialer unchanged; no old refs; bundle split | 23G; secondary 23A/23E | PR 1647 | CLI/OS tests and runtime classifier | reviewed below |
| 30-cli-product-split.md | Acceptance: consuelo unambiguously OS; dialer preserved; install/update excludes dialer; no CLI deletion | 23G; secondary 23A/23E | PR 1647 and PR 1674 | package manifests, binaries, lifecycle docs/tests | reviewed below |

## Coordinate notes

The matrix was recorded before implementation judgment. PR #1674 is merged and is used only because Ko explicitly authorized it as the immutable fallback. No Worker 29 approval was found.


## workspace-owned: validation evidence

- 2026-07-28 06:38:35 `review.run`: passed — OK
- 2026-07-28 06:39:42 `verify`: failed — COMMAND_FAILED

## workspace-owned: test selection

- changed files: `.task/os-foundation-two/worker-23g-repository-boundaries-operability-docs-audit-continuation/current.json`, `.task/os-foundation-two/worker-23g-repository-boundaries-operability-docs-audit-continuation/session.json`, `.task/os-foundation-two/worker-23g-repository-boundaries-operability-docs-audit-continuation/workpad.md`, `.task/tasks/os-foundation-two/worker-23g-repository-boundaries-operability-docs-audit-continuation.json`, `packages/os/plans/consuelo-os-foundation/reviews/final/23g-report.md`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
