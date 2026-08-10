# sync documentation stream with main after Secure merge

branch: `task/documentation/sync-documentation-stream-with-main-after-secure-merge`
stream: `stream/documentation`
pr: https://github.com/consuelohq/opensaas/pull/1473
started: 2026-07-13

## acceptance criteria

- [x] Merge current `origin/main` into the documentation stream through this isolated task.
- [x] Preserve the intentional stream deletion of `packages/documentation/src/content/docs/os/tools/browser-tools.mdx` when resolving the one known conflict.
- [x] Introduce no new product edits beyond the merge reconciliation and task metadata.
- [x] Reproduce the failed CI dependency install and identify its remaining upstream owner. Current main still contains the missing `twenty-emails` workspace dependency; cleanup PRs #1460 and #1469 own that unrelated fix.
- [x] Re-run documentation validation, combined contracts, translation, package boundary, foundation browser regression, Secure browser regression, and production build.
- [x] Run strict review and full verification.
- [ ] Push and merge PR #1473 into `stream/documentation`, refresh stream PR #1448, and confirm the stream is no longer dirty against main.
- [ ] Verify the merged stream from an isolated checkout, then finish and clean up the task.

## discovery

- Secure PR #1472 merged successfully into `stream/documentation` at `7fbd43b1cc0122a00744abc46925c3371a5a55d8`.
- Stream PR #1448 subsequently reported `mergeStateStatus: DIRTY` and a failed `danger-js` check.
- Failed workflow run `29286392555`, job `86940041165`, stopped during `yarn --immutable --check-cache` with `twenty-emails@workspace:*: Workspace not found`.
- Current `main` at `87f8b7967051dd64de230112d178b115c8668087` contains the tooling cleanup needed to remove that stale workspace dependency.
- The earlier direct stream-sync worktree entered a stale merge against main with one unresolved modify/delete conflict at `packages/documentation/src/content/docs/os/tools/browser-tools.mdx`.
- The documentation stream intentionally deleted that legacy page in an earlier approved docs branch. This reconciliation must preserve the deletion.

## test-first contract

This task is merge reconciliation rather than new product behavior, so there is no useful new red unit test to add. The exact failing CI command is the regression contract:

```bash
yarn --immutable --check-cache
```

It failed on the current stream because `twenty-emails@workspace:*` could not be resolved. After merging current main and preserving the intentional docs deletion, that command must pass. Existing documentation contracts and browser tests provide the behavior regression gate.

## plan

1. Fetch current main and stream refs.
2. Merge `origin/main` into this task branch.
3. Resolve only the known browser-tools modify/delete conflict by preserving deletion.
4. Commit the merge and inspect the exact conflict resolution.
5. Run the failed Yarn command plus all relevant documentation gates.
6. Run strict review and full verification.
7. Push, merge PR #1473 to the stream, confirm PR #1448 state/checks, verify an isolated merged-stream checkout, then finish and clean up.

## current status

- Current `origin/main` was merged at `bba06a7aa44c4f10dc723caeff5584aa645922db`.
- The one modify/delete conflict was resolved by preserving the intentional documentation-stream deletion of `os/tools/browser-tools.mdx`.
- All documentation gates pass after the reconciliation. Strict review found zero issues and full verification produced a publish-valid stamp.
- The repository-level immutable Yarn install still reproduces the same missing `twenty-emails` workspace error because current main itself still contains that stale workspace and server dependency. Open cleanup PRs #1460 and #1469 own the broader removal; this documentation sync does not duplicate or import that unmerged cleanup work.
- Push, merge, stream-state verification, and cleanup remain.

## files changed

- `.task/documentation/sync-documentation-stream-with-main-after-secure-merge/workpad.md`

## workspace-owned: files changed

- `.task/documentation/sync-documentation-stream-with-main-after-secure-merge/workpad.md`

## workspace-owned: validation evidence

- Failing upstream CI reproduced locally: `yarn --immutable --check-cache` still reports `twenty-emails@workspace:*: Workspace not found`. Current main still lists `packages/twenty-emails` and `packages/twenty-server` still depends on it; the package directory is absent.
- Documentation validation passed for 83 selected pages.
- Combined documentation contracts passed: 54 tests, 1,453 assertions.
- Translation and package-boundary contracts passed.
- Foundation browser regression passed with seven global groups, 632px prose measure, and zero tablet/mobile overflow.
- Secure browser regression passed all nine HTML and Markdown routes with zero tablet/mobile overflow.
- Production build passed and Pagefind indexed 86 HTML files.
- Strict review found zero issues and zero blockers.
- Full verification passed and wrote a publish-valid stamp.
- 2026-07-13 21:37:42 `review.run`: passed — OK
- 2026-07-13 21:37:56 `verify`: passed — OK

## key decisions

- Use current main as the source for repository dependency/tooling reconciliation.
- Preserve the documentation stream deletion of the obsolete browser-tools page.
- Do not modify Secure content or unrelated main changes during reconciliation.

- 2026-07-13 21:33:56 write: `.task/documentation/sync-documentation-stream-with-main-after-secure-merge/workpad.md`

## workspace-owned: activity log

- 2026-07-13 21:33:56 fs.write: `.task/documentation/sync-documentation-stream-with-main-after-secure-merge/workpad.md`

## workspace-owned: test selection

- changed files: `.github/workflows/ci-breaking-changes.yaml`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/current.json`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/evidence-log.json`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/read-log.json`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/session.json`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/verify.json`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/workpad.md`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/current.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/evidence-log.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/read-log.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/session.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/verify.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/workpad.md`, `.task/consuelo-website/refine-pricing-interactions-and-homepage-polish/current.json`, `.task/consuelo-website/refine-pricing-interactions-and-homepage-polish/session.json`, `.task/consuelo-website/refine-pricing-interactions-and-homepage-polish/verify.json`, `.task/consuelo-website/refine-pricing-interactions-and-homepage-polish/workpad.md`, `.task/documentation/sync-documentation-stream-with-main-after-secure-merge/current.json`, `.task/documentation/sync-documentation-stream-with-main-after-secure-merge/session.json`, `.task/documentation/sync-documentation-stream-with-main-after-secure-merge/workpad.md`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/current.json`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/evidence-log.json`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/read-log.json`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/session.json`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/verify.json`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/workpad.md`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/current.json`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/evidence-log.json`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/read-log.json`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/session.json`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/verify.json`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/workpad.md`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/current.json`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/evidence-log.json`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/read-log.json`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/session.json`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/verify.json`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/workpad.md`, `.task/security/restore-connector-route-exclusion-task/current.json`, `.task/security/restore-connector-route-exclusion-task/session.json`, `.task/security/restore-connector-route-exclusion-task/verify.json`, `.task/security/restore-connector-route-exclusion-task/workpad.md`, `.task/tasks/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents.json`, `.task/tasks/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main.json`, `.task/tasks/consuelo-website/refine-pricing-interactions-and-homepage-polish.json`, `.task/tasks/documentation/sync-documentation-stream-with-main-after-secure-merge.json`, `.task/tasks/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration.json`, `.task/tasks/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates.json`, `.task/tasks/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier.json`, `.task/tasks/security/restore-connector-route-exclusion-task.json`, `.task/tasks/tooling/address-browser-review-findings.json`, `.task/tasks/tooling/address-pr-1389-review-findings-and-merge-to-main.json`, `.task/tasks/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails.json`, `.task/tasks/tooling/remove-stale-twenty-emails-breaking-change-dependency.json`, `.task/tasks/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff.json`, `.task/tasks/tooling/resolve-tooling-main-sync-contract-conflicts.json`, `.task/tooling/address-browser-review-findings/current.json`, `.task/tooling/address-browser-review-findings/evidence-log.json`, `.task/tooling/address-browser-review-findings/read-log.json`, `.task/tooling/address-browser-review-findings/session.json`, `.task/tooling/address-browser-review-findings/verify.json`, `.task/tooling/address-browser-review-findings/workpad.md`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/current.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/evidence-log.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/read-log.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/session.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/verify.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/workpad.md`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/current.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/evidence-log.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/read-log.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/session.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/verify.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/workpad.md`, `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/current.json`, `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/evidence-log.json`, `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/read-log.json`, `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/session.json`, `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/verify.json`, `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/workpad.md`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/current.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/session.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/verify.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/workpad.md`, `.task/tooling/resolve-tooling-main-sync-contract-conflicts/current.json`, `.task/tooling/resolve-tooling-main-sync-contract-conflicts/evidence-log.json`, `.task/tooling/resolve-tooling-main-sync-contract-conflicts/read-log.json`, `.task/tooling/resolve-tooling-main-sync-contract-conflicts/session.json`, `.task/tooling/resolve-tooling-main-sync-contract-conflicts/verify.json`, `.task/tooling/resolve-tooling-main-sync-contract-conflicts/workpad.md`, `package.json`, `packages/consuelo-website/.gitignore`, `packages/consuelo-website/DESIGN.md`, `packages/consuelo-website/astro.config.mjs`, `packages/consuelo-website/bun.lock`, `packages/consuelo-website/functions/t/[action].ts`, `packages/consuelo-website/package.json`, `packages/consuelo-website/public/consuelo-os-og-20260713.png`, `packages/consuelo-website/public/images/home/dither/cloud-1.png`, `packages/consuelo-website/public/images/home/dither/cloud-2.png`, `packages/consuelo-website/public/images/home/dither/cloud-3.png`, `packages/consuelo-website/public/images/home/dither/cloud-4.png`, `packages/consuelo-website/scripts/generate-dither-clouds.mjs`, `packages/consuelo-website/scripts/generate-social-card.ts`, `packages/consuelo-website/src/assets/icons/IconDiscord.svg`, `packages/consuelo-website/src/components/ArticleToc.astro`, `packages/consuelo-website/src/components/BackButton.astro`, `packages/consuelo-website/src/components/Footer.astro`, `packages/consuelo-website/src/components/Header.astro`, `packages/consuelo-website/src/components/SeoHead.astro`, `packages/consuelo-website/src/components/Socials.astro`, `packages/consuelo-website/src/components/home/HomeCloudCta.astro`, `packages/consuelo-website/src/components/home/HomeFaq.astro`, `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/src/components/site/SiteHeader.astro`, `packages/consuelo-website/src/constants.ts`, `packages/consuelo-website/src/content/blog/software-is-becoming-decision-infrastructure.md`, `packages/consuelo-website/src/data/pricing-content.ts`, `packages/consuelo-website/src/layouts/Layout.astro`, `packages/consuelo-website/src/layouts/MarketingLayout.astro`, `packages/consuelo-website/src/layouts/PostDetails.astro`, `packages/consuelo-website/src/pages/pricing.astro`, `packages/consuelo-website/src/plugins/remarkOpenToc.mjs`, `packages/consuelo-website/src/styles/blog.css`, `packages/consuelo-website/src/styles/tokens.css`, `packages/consuelo-website/tests/blog-refresh.test.mjs`, `packages/consuelo-website/tests/blog-toc-responsive.test.mjs`, `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`, `packages/consuelo-website/tests/pricing-interactions.test.mjs`, `packages/consuelo-website/tests/site-header.test.mjs`, `packages/consuelo-website/tests/social-card.test.mjs`, `packages/consuelo-website/tests/website-structure.test.js`, `packages/os/SCRIPTS.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/package.json`, `packages/os/scripts/browser.js`, `packages/os/scripts/lib/browser/cli.ts`, `packages/os/scripts/lib/browser/config.ts`, `packages/os/scripts/lib/browser/errors.ts`, `packages/os/scripts/lib/browser/process.ts`, `packages/os/scripts/lib/browser/service.ts`, `packages/os/scripts/lib/browser/types.ts`, `packages/os/scripts/lib/connector-origin-hostname.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`, `packages/os/scripts/lib/stream-lifecycle.js`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/scripts/stream-cleanup.js`, `packages/os/scripts/task-start.js`, `packages/os/scripts/tools-search.ts`, `packages/os/skills/browser/SKILL.md`, `packages/os/skills/skills.json`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/browser-service.test.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/connector-origin-hostname.test.ts`, `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/os/tests/fixtures/skills/browser-workspace.SKILL.md`, `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`, `packages/os/tests/os-device-authority-connector-provisioning.test.ts`, `packages/os/tests/tools-search-v2.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/package.json`, `packages/workspace/scripts/browser.js`, `packages/workspace/scripts/lib/browser/cli.ts`, `packages/workspace/scripts/lib/browser/config.ts`, `packages/workspace/scripts/lib/browser/errors.ts`, `packages/workspace/scripts/lib/browser/process.ts`, `packages/workspace/scripts/lib/browser/service.ts`, `packages/workspace/scripts/lib/browser/types.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/stream-lifecycle.js`, `packages/workspace/scripts/stream-cleanup.js`, `packages/workspace/scripts/task-start.js`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/browser-review-contract.test.ts`, `packages/workspace/tests/browser-service.test.ts`, `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/stream-lifecycle.test.ts`, `packages/workspace/tests/tools-search-v2.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-task-session`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace task session tests`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace task session tests` passed, `workspace audit tests` passed
- failed suites: none

## external blocker

The root immutable Yarn failure is not introduced by the documentation stream or this reconciliation. Current main has the same inconsistent workspace state. Cleanup PR #1460 and its follow-up PR #1469 are actively removing the obsolete package and migrating server email templates. Pulling those unmerged changes into the documentation stream would cross task ownership and duplicate active work, so this branch records the blocker rather than hiding it.
