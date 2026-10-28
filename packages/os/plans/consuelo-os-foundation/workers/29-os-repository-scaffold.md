# Worker 29: Gated Consuelo OS Repository Scaffold And Extraction

## Mandatory gate

Do not start unless Ko explicitly approves Worker 28's repository decision and Worker 24 has proven the standalone runtime-bundle boundary. Bootstrap with `os.get_steering()`, read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md`, this brief, and the approved ADR in full.

## Mission

If and only if the approved decision is to extract OS, create the dedicated Consuelo OS repository/scaffold without creating two source authorities, losing required history/attribution, changing product URLs, or breaking the existing release system.

## Preconditions

- Approved repository name and owning organization.
- Approved brand name: Consuelo or Consuelo HQ.
- Approved license and provenance for every extracted file.
- Proven dependency closure for OS.
- Proven runtime-bundle build independent of the monorepo checkout.
- Migration window and rollback plan.
- Explicit decision for issues, PRs, releases, tags, docs, security policy, and contributor guidance.

## Required approach

1. Create a clean scaffold using Bun workspace conventions only where they match the approved architecture; do not invoke `bun create` blindly and then reshape it.
2. Preserve relevant Git history with an approved history-filter/subtree strategy.
3. Move source once. During transition, one repository is read-only/mirrored and one is authoritative; both are never independently editable.
4. Establish package names, lockfile, tests, CI, release branches, GitHub Releases, Cloudflare publication, security policy, contribution docs, and ownership.
5. Repoint installer source metadata and workflows without changing the public curl URL.
6. Update dependent monorepo imports through versioned packages or an explicit development link contract.
7. Preserve GTM/dialer in its approved repository boundary.
8. Archive or remove the old OS source only after parity and rollback gates pass.

## Tests

- Source/history/license inventory matches the approved extraction set.
- Standalone clean clone can build, test, and publish an identical runtime bundle.
- Bundle digest parity with the final monorepo release candidate.
- Hosted installer and updater resolve the new release metadata while keeping public URLs stable.
- OS task workflow, Grok review, CodeRabbit, channel promotion, and security checks work in the new repository.
- GTM/dialer builds are unaffected.
- Rollback to the monorepo release source is rehearsed before cutover.

## Acceptance gates

- One authoritative OS source exists at every step.
- History and attribution are preserved.
- Licensing is accurate.
- Public install/OAuth/workspace URLs remain stable.
- The same runtime bundle is produced before and after extraction.
- Ko explicitly approves final cutover.

## Out of scope

- Broad GTM rewrite.
- Mass Twenty renaming outside the approved extraction boundary.
- Whole-monorepo Yarn-to-Bun migration.
- Changing the public curl installer command.

## Review and completion

Request CodeRabbit and run Grok 4.5 on the extraction diff and migration evidence. Stop at the cutover checkpoint for Ko; do not create, rename, transfer, archive, or delete a GitHub repository without explicit approval.
