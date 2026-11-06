# Harden dialer provider-effect recovery and reconciliation isolation

branch: `task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2764
started: 2026-11-02

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/callback-telephony.ts`
- `packages/dialer-server/src/inbound/outbound-capacity.ts`
- `packages/dialer-server/src/inbound/telephony-commands.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/dialer-website/.gitignore`
- `packages/dialer-website/AGENTS.md`
- `packages/dialer-website/BILLING-ECONOMICS.md` (deleted)
- `packages/dialer-website/CLAIMS.md`
- `packages/dialer-website/COMPONENTS.md`
- `packages/dialer-website/DESIGN.md`
- `packages/dialer-website/animations.md`
- `packages/dialer-website/assets/encoded/consuelo-dialer-pricing-og-20261030.png.base64` (deleted)
- `packages/dialer-website/package.json`
- `packages/dialer-website/public/images/technology/LICENSE.md` (deleted)
- `packages/dialer-website/public/images/technology/SOURCES.md` (deleted)
- `packages/dialer-website/public/images/technology/bun.svg` (deleted)
- `packages/dialer-website/public/images/technology/cloudflare.svg` (deleted)
- `packages/dialer-website/public/images/technology/github.svg` (deleted)
- `packages/dialer-website/public/images/technology/hono.svg` (deleted)
- `packages/dialer-website/public/images/technology/postgresql.svg` (deleted)
- `packages/dialer-website/public/images/technology/redis.svg` (deleted)
- `packages/dialer-website/public/images/technology/twilio.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/SOURCES.md` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/SVGL-LICENSE` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/bun.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/claude.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/cloudflare.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/github.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/groq.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/hono.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/openai.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/opencode.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/pi.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/postgresql.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/redis.svg` (deleted)
- `packages/dialer-website/public/images/technology/wordmarks/twilio.svg` (deleted)
- `packages/dialer-website/scripts/checkout-browser-fixture.mjs` (deleted)
- `packages/dialer-website/scripts/generate-social-card.ts`
- `packages/dialer-website/scripts/materialize-public-assets.ts`
- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/scripts/test-pricing-browser.mjs` (deleted)
- `packages/dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/dialer-website/src/components/home/HomeFaq.astro`
- `packages/dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/dialer-website/src/components/pricing/PricingAddons.astro` (deleted)
- `packages/dialer-website/src/components/pricing/PricingComparison.astro` (deleted)
- `packages/dialer-website/src/components/pricing/PricingIcon.astro` (deleted)
- `packages/dialer-website/src/components/pricing/PricingTechnology.astro` (deleted)
- `packages/dialer-website/src/components/site/SiteFooter.astro`
- `packages/dialer-website/src/components/site/SiteHeader.astro`
- `packages/dialer-website/src/components/site/StripeCheckoutLauncher.astro` (deleted)
- `packages/dialer-website/src/components/visuals/CloudField.astro`
- `packages/dialer-website/src/data/dialer-content.ts`
- `packages/dialer-website/src/data/pricing-content.ts`
- `packages/dialer-website/src/data/site-links.ts`
- `packages/dialer-website/src/data/site-navigation.ts`
- `packages/dialer-website/src/layouts/MarketingLayout.astro`
- `packages/dialer-website/src/lib/checkout-selection.ts` (deleted)
- `packages/dialer-website/src/lib/direct-checkout.ts` (deleted)
- `packages/dialer-website/src/lib/purchase-confirmation.ts` (deleted)
- `packages/dialer-website/src/lib/site-smooth-scroll.ts`
- `packages/dialer-website/src/pages/get-started.astro`
- `packages/dialer-website/src/pages/how-it-works.astro`
- `packages/dialer-website/src/pages/index.astro`
- `packages/dialer-website/src/pages/pricing.astro`
- `packages/dialer-website/src/styles/pricing.css` (deleted)
- `packages/dialer-website/src/styles/tokens.css`
- `packages/dialer-website/tests/checkout-selection.test.ts` (deleted)
- `packages/dialer-website/tests/direct-checkout.test.ts` (deleted)
- `packages/dialer-website/tests/interaction-lifecycle.test.ts` (deleted)
- `packages/dialer-website/tests/marketing-contract.test.ts`
- `packages/dialer-website/tests/pricing-catalog.test.ts` (deleted)
- `packages/dialer-website/tests/pricing-refinement.test.ts` (deleted)
- `packages/dialer-website/tests/purchase-confirmation.test.ts` (deleted)
- `packages/os/SCRIPTS.md`
- `packages/os/TOOLS.md`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/search/explore-failure.js` (deleted)
- `packages/os/scripts/lib/steering-snapshot-cache.ts`
- `packages/os/scripts/lib/tool-scope-authorization.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/linear.js`
- `packages/os/scripts/os.ts`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tests/explore-output-contract.test.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/linear-tooling-regression.test.ts` (deleted)
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- `packages/os/tools/linear/handler.ts`
- `packages/os/tools/linear/schema.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/linear.js`


## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/dialer-server/package.json`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/callback-telephony.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/inbound/outbound-capacity.ts`
- `packages/dialer-server/src/inbound/telephony-commands.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony.ts`
- `packages/os/definitely-missing.json`

## Wave 1 scope and acceptance criteria
- Prevent definite local preflight failures from being treated as ambiguous provider effects, while preserving ownership and reconciliation of actual unknown Twilio operations.
- Ensure invalid/orphan pending telephony effects cannot starve valid effects in a bounded worker scan.
- Isolate outbound session and callback obligation recovery so failure of one does not abort unrelated sessions; surface error counts without sensitive payloads.
- Include deterministic regression tests, crash/restart proofs, focused typechecks, formal review and managed verification. Publish only into stream/dialer; do not merge main or deploy; no provider calls or billing changes.

## Test-first contract
- Behavior under test: missing local endpoint/number/session, orphan pending effects, two-session mixed good/bad recovery, callback mixed good/bad recovery, and valid unknown provider timeout retained as protected.
- Existing local pattern: `packages/dialer-server/src/inbound/{telephony.integration.test.ts,callback-telephony.integration.test.ts}` with mocked carrier/Postgres isolation, plus small unit tests when resource-backed tests unavailable.
- New or changed tests: regression cases in the existing inbound telephony and callback suites (or isolated deterministic harnesses) that fail under current behavior, then pass under change.
- Focused red command: `bun test packages/dialer-server/src/inbound/telephony.integration.test.ts packages/dialer-server/src/inbound/callback-telephony.integration.test.ts` against explicitly isolated local test database; if unavailable use newly added mock unit tests first.
- Expected red failure: exceptions strand pending work and abort an unrelated session, local errors result in protected unknown state instead of definitive failed/no-effect.
- No-test waiver: none. Do not call real provider APIs; Twilio interfaces mocked in tests.

## Plan updates
1. Reconcile task base with latest stream tip safely, without modifying parallel branches.
2. Inspect current interfaces and existing tests, add failing regression tests first.
3. Implement smallest preflight/isolated-recovery changes and protect genuine uncertain provider outcomes.
4. Run deterministic restart and focused suites, typechecks, review, verify, push and promote task PR to stream/dialer only.

- 2026-11-02 02:31:24 append: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-02 02:31:24 fs.write: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/workpad.md`
- 2026-11-02 02:34:23 apply-patch: `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- 2026-11-02 02:34:32 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- 2026-11-02 02:35:28 fs.write: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/workpad.md`
- 2026-11-02 02:40:24 fs.trash: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/local-pg`
- 2026-11-02 02:40:40 fs.write: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/workpad.md`
- 2026-11-02 02:43:34 fs.trash: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/local-pg`
- 2026-11-02 02:43:44 fs.write: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/workpad.md`

## Red test evidence (2026-11-02)
- Isolated task-owned PostgreSQL 17 cluster on loopback :55473 (LC_ALL=C required for startup; no existing databases/services touched).
- `bun test packages/dialer-server/src/inbound/telephony.integration.test.ts packages/dialer-server/src/inbound/callback-telephony.integration.test.ts --test-name-pattern 'locally unconfigured|drains orphaned|later outbound sessions|healthy callback'` with RD5/RD6 PG ports=55473: **0 passed / 4 failed**, all expected. Missing endpoint became unknown, 105 pending orphans persisted, first outbound carrier failure aborted later session, first malformed callback aborted subsequent cancellation recovery.
- Merge `origin/stream/dialer` into isolated task branch was clean (prechecked merge-tree), leaving other worktrees and branches unchanged; task HEAD 5b88cb02f8 before code changes.

- 2026-11-02 02:35:28 append: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/workpad.md`

- 2026-11-02 02:35:36 apply-patch: `packages/dialer-server/src/inbound/telephony-commands.ts`

- 2026-11-02 02:35:57 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.ts`
- 2026-11-02 02:36:01 apply-patch: `packages/dialer-server/src/inbound/outbound-capacity.ts`
- 2026-11-02 02:36:10 apply-patch: `packages/dialer-server/src/inbound/telephony.ts`
- 2026-11-02 02:36:10 apply-patch: `packages/dialer-server/src/runtime/inbound.ts`

- 2026-11-02 02:37:21 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- 2026-11-02 02:37:51 apply-patch: `packages/dialer-server/src/inbound/telephony-commands.ts`
- 2026-11-02 02:37:51 apply-patch: `packages/dialer-server/src/inbound/telephony.ts`
- 2026-11-02 02:37:52 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.ts`
- 2026-11-02 02:37:58 apply-patch: `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- 2026-11-02 02:37:59 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- 2026-11-02 02:38:41 apply-patch: `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- 2026-11-02 02:38:41 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`

- 2026-11-02 02:39:00 apply-patch: `packages/dialer-server/src/inbound/telephony-commands.ts`
- 2026-11-02 02:39:00 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.ts`
- 2026-11-02 02:39:16 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.ts`

## Implementation and latest validation
- Updated `inbound/telephony-commands.ts` to fail pending orphan effects and invalid local configurations before carrier dispatch, settle affected durable commands, and classify local URL/TwiML construction errors as no-effect rather than unknown. Provider create timeouts and uncorrelated effects still retain protection.
- Updated `inbound/callback-telephony.ts` to distinguish local preflight and definitively rejected customer creates from uncertain carrier effects; a failed customer create does not release an accepted rep until the rep's provider leg is terminal. Callback command execution and callback reconciliation now catch/report per-obligation failures and continue unrelated work.
- Updated `inbound/outbound-capacity.ts` for per-session recovery isolation; `inbound/telephony.ts` and `runtime/inbound.ts` aggregate partial failure counts in existing structured worker telemetry.
- New tests in `inbound/telephony.integration.test.ts` and `inbound/callback-telephony.integration.test.ts` cover restart missing config, invalid URL/TwiML without external carrier attempt, 105 orphaned pending records ahead of a valid offer, outbound recovery after a missing carrier lookup, callback recovery after corrupt prior obligation, missing callback configuration, and definitively rejected customer create with safe rep drain.
- Test-first evidence: initial 4 tests failed as expected (0/4), and two additional local malformed URL tests failed as expected (0/2) before corrections. Final focused suite: **47 pass / 2 filtered / 0 fail, 276 assertions** on task-owned isolated Postgres 17 with simulated carrier, command `bun test packages/dialer-server/src/inbound/telephony.integration.test.ts packages/dialer-server/src/inbound/callback-telephony.integration.test.ts --test-name-pattern '^(?!.*(?:rolls an empty telephony schema|refuses rollback while)).*'` under `CONSUELO_RD5_PG_PORT=55473 CONSUELO_RD6_PG_PORT=55473`.
- `bun run --cwd packages/dialer-server typecheck`: PASS (`tsc --noEmit`).
- Two pre-existing schema-rollback tests fail on latest stream baseline because they attempt to roll back an older migration while the migration registry now adds forward-only newer schema markers (coaching scripts/native billing). Those tests have no production changes in this task and are excluded from scoped runtime suite; no billing/migration code changed.
- Task-only ephemeral PostgreSQL server was stopped cleanly, and the temporary `local-pg` cluster was moved to task-local trash. Do not include its files in the PR. No live calls, provider traffic, credentials, billing, or deployment work was performed.
- No unrelated worktree, stream, or main branch was modified. This task merged the remote stream tip into its own isolated branch to avoid an outdated implementation base.

## Remaining actions
- Inspect strict formal review findings and managed verification; address attributable failures, update this workpad, and publish scoped changes through managed task PR into stream/dialer only. No main merge or deployment.

- 2026-11-02 02:40:40 append: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/workpad.md`

## workspace-owned: validation evidence

- 2026-11-02 02:40:59 `review.run`: passed — OK
- 2026-11-02 02:42:24 apply-patch: `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- 2026-11-02 02:42:48 apply-patch: `packages/dialer-server/src/inbound/telephony-commands.ts`
- 2026-11-02 02:43:07 apply-patch: `packages/dialer-server/src/inbound/telephony-commands.ts`
- 2026-11-02 02:44:00 `review.run`: passed — OK

## Self-review addendum and final scoped test proof
- Found that an orphaned `terminate` effect is distinct from an orphaned `offer`/`bridge`: a previously known provider SID may still be live even if shared capacity ownership has disappeared. Added a red restart-style test (1 fail), then guarded termination dispatch so known SIDs remain eligible for cleanup without previous owner or number config. Preserve unknown outcome for any attempted termination; never release capacity without terminal proof.
- Read-only inspection found 118 unrelated file differences introduced by the workflow's bootstrap from main versus the dialer stream (OS, website, workspace tool changes). Reverted **only those 118 differences inside this isolated task worktree** to the exact `origin/stream/dialer` snapshot. No changes to any other branch or worktree, and no dialer-server source was among those 118. This keeps the eventual stream PR scoped to the seven dialer-server source/test files plus task tracking artifacts and prevents accidental propagation of unrelated main content.
- Final deterministic PostgreSQL 17 + simulated carrier run: **48 pass, 2 filtered pre-existing migration rollback tests, 0 fail, 278 expectations**. Command same as above using RD5/RD6 isolated ports and `--test-name-pattern` negative lookahead excluding the two forward-only migration rollback tests. `bun run --cwd packages/dialer-server typecheck`: PASS after the final termination fix.
- Second temporary task-only PostgreSQL cluster stopped cleanly and moved to trash. No live carrier calls or production database access.
- Initial strict `review.run` reported 0 blocking / 0 owned findings; it occurred before removal of the unrelated main/bootstrap delta. Rerun formal review and managed verification on final exact diff before publish.

- 2026-11-02 02:43:44 append: `.task/dialer/harden-dialer-provider-effect-recovery-and-reconciliation-isolation/workpad.md`
