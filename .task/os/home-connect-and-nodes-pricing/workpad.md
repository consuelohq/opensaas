# Home Connect and Nodes Pricing

branch: `task/os/home-connect-and-nodes-pricing`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2043/home-connect-and-nodes-pricing
github pr: https://github.com/consuelohq/opensaas/pull/2043
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/managed-cloud-pricing.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/scripts/lib/google-cloud-public-pricing-refresh.ts`
- `packages/os/scripts/lib/managed-cloud-public-pricing.ts`
- `packages/os/scripts/lib/nodes-site.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/managed-cloud-public-pricing.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/services/managed-cloud-pricing.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/scripts/lib/google-cloud-public-pricing-refresh.ts`
- `packages/os/scripts/lib/managed-cloud-public-pricing.ts`
- `packages/os/scripts/lib/nodes-site.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/managed-cloud-public-pricing.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-08-15 07:35:56 fs.write: `.task/os/home-connect-and-nodes-pricing/workpad.md`
- 2026-08-15 07:40:50 fs.write: `.task/os/home-connect-and-nodes-pricing/workpad.md`
- 2026-08-15 07:41:43 fs.write: `packages/os/scripts/lib/nodes-site.ts`
- 2026-08-15 07:49:12 fs.write: `packages/os/scripts/lib/managed-cloud-public-pricing.ts`
- 2026-08-15 07:55:37 fs.write: `packages/os/scripts/lib/google-cloud-public-pricing-refresh.ts`
- 2026-08-15 08:01:16 fs.write: `.task/os/home-connect-and-nodes-pricing/workpad.md`
- 2026-08-15 08:06:17 fs.write: `.task/os/home-connect-and-nodes-pricing/workpad.md`
- 2026-08-15 08:10:00 fs.write: `.task/os/home-connect-and-nodes-pricing/workpad.md`
- 2026-08-15 08:20:10 fs.write: `.task/os/home-connect-and-nodes-pricing/workpad.md`
- 2026-08-15 08:26:18 fs.write: `.task/os/home-connect-and-nodes-pricing/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 08:03:57 `verify`: failed — COMMAND_FAILED
- 2026-08-15 08:05:07 `verify`: failed — COMMAND_FAILED
- 2026-08-15 08:06:08 `verify`: passed — OK
- 2026-08-15 08:21:38 `verify`: failed — COMMAND_FAILED
- 2026-08-15 08:24:51 `verify`: failed — COMMAND_FAILED
- 2026-08-15 08:25:58 `verify`: failed — COMMAND_FAILED

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/managed-cloud-billing.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/scripts/lib/google-cloud-public-pricing-refresh.ts`
- `packages/os/scripts/lib/managed-cloud-pricing.ts`
- `packages/os/scripts/lib/managed-cloud-public-pricing.ts`
- `packages/os/scripts/lib/nodes-site.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/launcher-nodes-control-plane.test.ts`
- `packages/os/tests/launcher-nodes-materialization.test.ts`
- `packages/os/tests/managed-cloud-checkout-observability.test.ts`
- `packages/os/tests/managed-cloud-pricing.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/test-selection.test.js`

## Test-first contract

Acceptance criteria:
- [ ] Rename the visible workspace surface from `Overview` to `Home` while preserving the existing `/configuration` route and root/default-route behavior owned by the current launcher shell.
- [ ] Add a `Connect` route-menu section immediately before `Guides`, with two external cards only: ChatGPT -> `https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins` and Claude -> `https://claude.ai/customize/connectors`.
- [ ] Keep the Connect cards explicit about adding Consuelo as a custom MCP connector; do not invent unsupported Claude GitHub/file-upload setup steps.
- [ ] Redesign Nodes into a compact, responsive inventory with clear status/default-node actions and a focused `+ Add node` flow, without leaking provider machine types, provider costs, margin policy, or credentials.
- [ ] Replace the `Price available soon` dead-end with authoritative managed-cloud quotes derived from current Google Cloud public pricing. Keep Stripe as checkout/payment execution using the computed Consuelo monthly quote rather than as the infrastructure cost source.
- [ ] Pricing must fail closed for provisioning: stale/missing quotes cannot create a paid node, and quote provenance/versioning must remain enforced.
- [ ] Preserve current auth, CSRF, idempotency, workspace isolation, and provider-internal redaction contracts.
- [ ] Do not modify the Secrets implementation from the parallel Secrets task.

TDD plan:
1. Add focused route-menu/Home + Nodes surface tests and Google Cloud pricing-adapter tests first.
2. Run only those tests and capture the expected RED failures before production edits.
3. Implement the smallest Home/Connect chrome changes, isolate Nodes UI where practical, and add a server-side Google Cloud pricing adapter with bounded caching/fallback semantics.
4. Run focused GREEN suites, browser/surface contracts, pricing/billing/provisioning contracts, then formal review + verify.
5. Push the task branch, promote through the task PR workflow, and report the exact delivery state.

Research findings before edits:
- `Price available soon` is not caused by Stripe. The Nodes pricing endpoint returns no quotes when `managedCloudPricing` is absent; production currently builds that runtime only from `OS_MANAGED_CLOUD_PRICING_POLICY_JSON` + `OS_MANAGED_CLOUD_RATE_CARDS_JSON`, and the checked-in Worker `wrangler.toml` publishes neither variable.
- Stripe Checkout already receives `monthlyPriceCents` as inline recurring `price_data`; Stripe is the payment rail, while Consuelo's managed-cloud quote is the price authority.
- Google documents the Cloud Billing Catalog/Pricing APIs as the source of current public SKU pricing. The public Catalog API requires the Cloud Billing API enabled and an API key; account-specific contract pricing uses the Pricing API/IAM.
- Anthropic's official connector flow for Pro/Max is `claude.ai/customize/connectors` -> add custom connector -> remote MCP URL. ChatGPT uses the exact deep link supplied by Ko.

Issues / recovery:
- Initial `task.start` call omitted the required title and failed; retried with `Home Connect and Nodes Pricing` and created PR #2043.
- A parallel `git show stream/os:...` inspection failed because the local stream ref does not contain `workspace-chrome.ts`; this was a read-only branch-inspection failure and did not modify the task tree. Use the task's main-starting state plus current task/PR safety instead of guessing missing stream content.

- 2026-08-15 07:35:56 append: `.task/os/home-connect-and-nodes-pricing/workpad.md`

TDD RED (UI): `bun --cwd packages/os test tests/settings-site.test.ts` failed exactly on the new Home/Connect and compact Nodes contracts (`trc_b02a1d0c88e1`): current shell still renders `Overview`, has no Connect/Guides destinations, Nodes has no searchable row inventory, and still contains `Price available soon`.

- 2026-08-15 07:40:50 append: `.task/os/home-connect-and-nodes-pricing/workpad.md`

- 2026-08-15 07:41:43 write: `packages/os/scripts/lib/nodes-site.ts`

- 2026-08-15 07:49:12 write: `packages/os/scripts/lib/managed-cloud-public-pricing.ts`

- 2026-08-15 07:55:37 write: `packages/os/scripts/lib/google-cloud-public-pricing-refresh.ts`

## Implementation / validation update

- UI TDD RED: `trc_b02a1d0c88e1` proved the existing shell still rendered Overview, lacked Connect/Guides destinations, and Nodes still used the old pricing dead-end. Focused Home/Connect/Nodes GREEN: `trc_70bc4552b5a3` (settings surface 10/10).
- Added isolated `nodes-site.ts` for searchable responsive node inventory, default-node actions, compact `+ Add node` flow, current-quote gating, and fail-closed provisioning copy. Shared settings renderer only imports the isolated surface and renames the page to Home.
- Added ChatGPT (exact Ko-supplied deep link) + Claude (`claude.ai/customize/connectors`) cards in a Connect group immediately before Guides/Documentation. The cards describe Consuelo as a custom MCP connector and avoid the unrelated GitHub/file-upload flow.
- Pricing root cause: Stripe was already checkout execution; the pricing endpoint intentionally returned zero quotes because production had no managed-cloud pricing runtime. Added a versioned Google public pricing runtime plus a live release-time refresh from official Google Compute, disk, NAT, and VPC pricing pages.
- Live pricing refresh RED `trc_1501b06436bd`; parser/fetch GREEN `trc_ad3170bf75b2`. Real Google fetch/parser proof `trc_645114befced`: standard E2 hourly micros 67012 (us-east1/us-central1/us-west1), 75471 (us-east4), 73716 (europe-west1), disk 100000/GiB-month, snapshot 50000, NAT 6400/hour + 45000/GiB, egress 120000/GiB.
- Real derived customer quotes `trc_e08d4d6b81fa`: US base regions Starter/Standard/Performance/Power/Max = $93/$137/$224/$398/$747 monthly; us-east4 = $98/$148/$246/$442/$835; europe-west1 = $97/$145/$241/$433/$817. Stripe still receives the resulting `monthlyPriceCents` as the payment amount.
- Production-release pricing injection RED `trc_a8c089ffbe62`; GREEN `trc_12670d6613a3`. Release logs initially exposed internal pricing JSON (`trc_e4077fcd97d2`); command logging now redacts managed-cloud pricing payloads and regression is GREEN `trc_8f1530840000`.
- Focused current implementation validation: syntax `trc_4ff0e662d8d1`; 89 managed-cloud/UI/Worker tests `trc_ab1ddb017aef`.
- Test-selection TDD RED `trc_edb9c23c7008` showed new pricing/Nodes files fell through to the broad OS package suite. Extended the existing critical managed-cloud rule, regenerated the registry, focused GREEN `trc_8959d15f2a52`, full registry GREEN `trc_b76a0362ca4d` (37/37), and current selection has no broad OS package suite (`trc_b7771e4297d3`).
- The Google Cloud Billing Catalog API was not usable from this machine without interactive Google re-auth / a configured API key. The release-time official Google pricing-page refresh removes that new secret dependency while still failing closed if required regional/rate data disappears; the checked-in versioned baseline prevents an empty pricing UI when no explicit Worker override exists.

- 2026-08-15 08:01:16 append: `.task/os/home-connect-and-nodes-pricing/workpad.md`

## Final pre-publish validation

- Post-redaction device-authority release dry run is GREEN: `trc_c08dccb076df`. It materializes the current Home/Nodes/Connect snapshots, bundles the Worker, carries both managed-cloud pricing vars, and logs the pricing JSON only as `<redacted-pricing>`.
- First full selected-suite pass exposed the expected stale local-agent integration title plus one transient handshake assertion (`trc_44a639548ff2`). The standalone local-agent suite showed the only deterministic issue was the old `Overview` title contract (`trc_f5984985fbf4`); updated that contract to `Home` and the suite is GREEN 14/14 (`trc_9810b883612e`).
- Full internal workspace-shell suite is GREEN 71/71 (`trc_e9ea6a61c9f1`). The intentionally corrupt managed-component fixture logs its expected JSON parse exception but the test suite exits 0.
- Full registry-selected task suite is GREEN with all 11 selected suites and no failures: `trc_66bb09e8d8d5` (workspace selection, release freshness, workspace-edge dry run, 71 shell tests, syntax, 103 managed-cloud tests, 31 Worker tests, CI policy contracts).
- First formal verifier pass found only three mechanical async error-boundary findings (`trc_68549954a9e5`). Added explicit error boundaries without changing fail-closed semantics; focused syntax/pricing/release tests GREEN (`trc_4a3246324763`).
- Final formal verifier: `trc_877c409f2f5c` — review 0 findings, DB guard 0 risks/findings, all selected suites passed, `publishValid: true`.

- 2026-08-15 08:06:17 append: `.task/os/home-connect-and-nodes-pricing/workpad.md`

## Follow-up: route preload + Work/Code navigation polish

Test-first contract:
- Behavior under test: the shared workspace route menu exposes the existing `/artifacts` and `/diffs` surfaces in the first (Observe) section, eagerly warms Home (`/configuration`), intent-prefetches other same-origin workspace pages, and primes a short-lived, non-raw recent-trace preview so Tracing can paint rows before its normal live refresh finishes.
- UI polish: keep the orange active/focus treatment, but remove the square focus outline around the route trigger; use a borderless rounded/background + underline-style focus treatment instead.
- Existing local pattern: `workspace-chrome.ts` owns shared route chrome/client behavior; `observability-traces-site.ts` owns the tracing client and must keep trace data out of the static snapshot.
- Changed tests: extend `settings-site.test.ts` for Artifacts/Code routes, Home/menu prefetch behavior, trace prefetch intent, and focus styling; extend `observability-traces-site.test.ts` for one-shot short-lived prefetched trace consumption.
- Focused RED command: `bun --cwd packages/os test tests/settings-site.test.ts tests/observability-traces-site.test.ts`.
- Expected RED: current menu has no `/artifacts` or `/diffs`, no route/trace prefetch code, and tracing always starts from an empty feed; trigger focus still uses the 1px outline.
- Privacy boundary: any trace prefetch must request `includeRawPayload=false`, stay in `sessionStorage` only briefly, be size-bounded, and be removed when Tracing consumes it. Static HTML must remain trace-free.

- 2026-08-15 08:10:00 append: `.task/os/home-connect-and-nodes-pricing/workpad.md`

Follow-up TDD evidence:
- RED `trc_d471391b4fdf`: new Artifacts/Code menu + trace preview contracts failed because the shared chrome had no route prefetch/trace preview and Tracing always started empty.
- Route integrity RED `trc_bbffe011a639`: caught an intervening Home link pointing at `/` even though `/` is intentionally the durable Nodes root. Locked Home back to `/configuration` and kept Nodes at `/`.
- GREEN `trc_9de9a5bfb1e2`: 18/18 focused settings + Trace Burn surface tests pass. Home is primary + eagerly prefetched, Observe now includes Artifacts (`/artifacts`) and Code (`/diffs`), same-origin menu routes prefetch on intent/open, Tracing consumes a bounded one-shot non-raw preview before its live refresh, and the orange trigger focus uses an inset underline/background instead of a square outline.

- 2026-08-15 08:20:10 append: `.task/os/home-connect-and-nodes-pricing/workpad.md`

## Follow-up publish validation

- Route/trace preload + menu polish GREEN: `trc_f984393850ae` (18/18 focused tests).
- Wider shell/navigation coverage GREEN: `trc_7f9e3d07f221` (29/29) and syntax `trc_e28472b71229`.
- Reconciled release-managed site refresh and durable Nodes root after the full gate exposed concurrent contract drift: `trc_45c77978b1e3` (release 14/14), `trc_9ceb83994ea1` (local agents 14/14), syntax `trc_01b4d9d72dd9`.
- Full verification stamp is publish-valid: `.task/os/home-connect-and-nodes-pricing/verify.json`, verified 2026-08-15T08:25:24Z. All 11 selected suites passed; review has 0 findings; DB guard has 0 findings and one expected database-script warning for the route-registry refresh helper.

- 2026-08-15 08:26:18 append: `.task/os/home-connect-and-nodes-pricing/workpad.md`
