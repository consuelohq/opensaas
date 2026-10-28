# Worker 28: Repository, Product, Brand, License, And Package-Manager Audit

## Mandatory context

Bootstrap with `os.get_steering()`, then read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` and this brief in full. Use a read-only task session from `stream/repository-architecture`. Do not rename, move, delete, relicense, or extract code in this task.

## Mission

Produce the evidence-backed decision for keeping and reorganizing the monorepo versus extracting Consuelo OS, while mapping the GTM/dialer product, inherited Twenty code, branding, licensing, package managers, generated code, deployments, and history constraints.

## Current facts to verify

- The repository is named `opensaas`, while the root README now presents Consuelo OS as the main product.
- OS lives in `packages/os`; the GTM/dialer and inherited Twenty platform remain in the same Nx/Yarn monorepo.
- Many package and symbol names still include `twenty-*`.
- Root licensing is inherited AGPL/commercial text, while `packages/os` and `packages/workspace` currently contain Apache-2.0 licenses. Do not assume the whole repository can simply become MIT.
- `packages/cli` mixes dialer/GTM and OS commands under one `consuelo` binary.
- The repo uses Yarn/Nx broadly while OS tooling uses Bun heavily.
- Cloudflare, GitHub Actions, Railway, docs, install URLs, npm/package names, source download paths, and local installs may reference the current repo or paths.

## Required inventory

1. Product ownership for every top-level package: OS, GTM/dialer, shared, inherited Twenty runtime, docs/site, internal/operator, generated, deprecated, or unknown.
2. Dependency graph showing what `packages/os` imports from outside its intended boundary and what imports OS.
3. Build/test/release/deployment workflow ownership.
4. Git history and contributor/license provenance for extraction candidates.
5. Root and package-level license, code-of-conduct, contributing, security, copyright, and brand text.
6. Every `Twenty`, `OpenSaaS`, `Consuelo HQ`, old URL, repository, package, installer, and CLI reference that would change.
7. Yarn, Bun, npm, Corepack, Nx, lockfile, Docker, and CI usage by product boundary.
8. Generated/vendor/upstream code that should retain upstream naming and notices.
9. Current production/development systems that resolve GitHub paths or package names.

## Decisions to produce

Compare at least:

- reorganize the existing monorepo into explicit product/shared/legacy boundaries;
- extract OS to a dedicated repository while leaving GTM/dialer here;
- staged hybrid: prove a standalone runtime-bundle boundary now, reorganize monorepo, extract later only if shared dependencies shrink.

Score each on release safety, history, licensing, contributor clarity, developer workflow, cross-product reuse, CI cost, deployment risk, issue/PR continuity, public branding, and future open-source contribution.

## Target organization proposal

Provide an exact proposed tree for the recommended option. It must distinguish:

- Consuelo OS product source;
- GTM/dialer product source;
- truly shared libraries;
- inherited Twenty platform code still required by GTM;
- archived/deprecated code;
- operator-only infrastructure;
- generated/vendor sources.

Do not recommend mass-renaming upstream/vendor internals merely to remove the word Twenty. Rename owned product boundaries first and retain required attribution.

## Brand and legal guardrail

Treat “Consuelo” versus “Consuelo HQ” as a product/brand decision requiring Ko's explicit final choice. Treat MIT relicensing as a legal/provenance decision, not a text replacement. Identify what can be MIT, what is currently Apache-2.0, what remains AGPL/commercial/inherited, and what counsel or copyright-holder approval is required.

## Yarn-to-Bun assessment

Do not promise a one-shot monorepo migration. Identify blockers by Nx project, package manager features, patch protocol, lockfile, workspace constraints, Docker, Railway, generated code, and CI. Produce bounded phases with rollback and mixed-mode boundaries if needed.

## Acceptance gates

- Every active package has an owner/classification.
- OS extraction dependencies and history/license constraints are explicit.
- The recommended option has a staged migration and rollback path.
- No claim assumes MIT compatibility without evidence.
- CLI split, package renames, repo rename, URL redirects, docs, and deployments are all mapped.
- Ko can approve or reject the recommendation without another discovery task.

## Review and completion

Save the inventory and ADR in the workpad, request CodeRabbit only if repository files were added, and run Grok 4.5 against the plan, brief, evidence, and recommendation. No source migration occurs in this task.
