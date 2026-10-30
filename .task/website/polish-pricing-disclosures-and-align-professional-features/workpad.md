# Polish pricing disclosures and align Professional features

branch: `task/website/polish-pricing-disclosures-and-align-professional-features`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2715/polish-pricing-disclosures-and-align-professional-features
github pr: https://github.com/consuelohq/opensaas/pull/2715
started: 2026-10-30

## acceptance criteria

- [x] Scope, test-first contract and plan recorded before editing.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Implementation and focused validation complete; release gate/publication/deployment next.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-10-30 23:10:49 `review.run`: passed — OK
- 2026-10-30 23:14:51 `verify`: passed — OK

## key decisions

- Native disclosures retain keyboard interaction and answer selection; only clickable headings disable user selection. Focus is shown with a soft fill/underline rather than a rectangular blue outline.
- Existing directional arrow paths remain intact; disclosures get distinct round chevrons. Pinned labels progressively move outside the horizontal scroller and synchronize scrollLeft without global scroll handlers.
- Paid Professional gets predictive=true; Starter trial and legacy base catalog keep their previous permissions.

## notes for ko

- Requested Professional features now appear from Professional upward. Prices, recording/transcript tier boundaries, current calling UI and Stripe products are not changed.
- Deployment stays on the isolated preview and the scoped Railway service.

## improvements noticed

- Claim ledger still described setup-email CTAs from the older preview; corrected it to reflect the already verified pay-first checkout and current Professional feature split.

## issues and recovery

- A copy-selection test initially clicked paragraph whitespace on a narrow layout. It now uses a real double-click at the first text word; behavior and CSS remain unchanged.
- Website dependencies installed from its frozen lockfile; root dependencies link to the physical main checkout. Avoid deleting a dependency target borrowed by another active task.

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Scope / acceptance
- Disclosure headings on pricing/home FAQs and feature groups/rows must not select text on double click. Answer/detail text stays copyable. Replace the blue rectangular focus outline with a quiet but perceivable keyboard cue; retain native semantic details/summary and keyboard activation.
- Use dedicated rounded chevrons for disclosure affordances and balanced check/minus badges. Preserve the directional inbound/outbound and CTA arrows.
- Keep the plan-name comparison row pinned to viewport while scrolling within comparison; match horizontal scroll at narrow widths; compact heading padding above its divider. Native no-JS table remains usable.
- Underlined See more FAQs links to /#faq.
- Professional includes predictive dialing, local presence and spam protection; update plan bullets/comparison/claim ledger and paid public-catalog predictive permission. Starter and legacy entitlements stay unchanged. No price, recording/transcript, Stripe product/account or calling UI changes.
- Verify/publish/promote through stream/website, deploy isolated noindex preview and scoped Railway entitlement update; no production-domain cutover, payment or calls.

## Test-first contract
Use the existing pricing browser harness plus Bun catalog and disposable Postgres tests. Add Professional matrix assertions and a behavior regression that proves paid Professional gets predictive three-line capacity while the new Starter trial remains non-predictive and legacy active single retains its policy. Add browser assertions for actual double-click selection, copyable answer, keyboard cue/activation, sticky header at two vertical positions, horizontal alignment, chevron/check markup and underlined link. Run targeted red before implementation, then green, package builds/typechecks and required strict/full gates. Visual polish uses screenshot review at desktop/mobile; no tests mirroring SVG path strings.

## Plan
1. Inspect current source and current remote stream; preserve other owners.
2. Record/run focused red catalog/Postgres/browser contract.
3. Implement scoped presentation and paid Professional permission.
4. Build and run eight-viewport behavior checks, Postgres proof and release gates.
5. Publish to stream, deploy exact source, verify HTTPS/runtime, update review/Linear/handoff.

## Key decisions
- The launch trial reuses single as Starter. Keep its non-predictive policy; paid public purchase catalog explicitly enables predictive for Professional. Legacy catalogs are not modified. Local presence and number-health handling have no separate plan toggle in this service.
- Sticky header is a progressive enhancement: move the existing visual column labels into a CSS sticky sibling, sync native horizontal scroll, and retain semantic table headings/no-JS markup.

## Validation evidence
- Red before implementation: catalog matrix failed at Professional local presence; disposable Postgres failed at Professional predictive permission; browser failed because sticky comparison host did not exist.
- Green: 30 website tests/245 assertions; disposable Postgres1 test/56 assertions including Professional predictive three-line capacity, Starter false, and legacy single false. Server typecheck passed.
- Full pricing browser8 viewports320x568,375x812,430x932,568x320,667x375,768x1024,1024x768,1440x1000 passed with no errors. Actual double-click heading selection, copyable answer, keyboard focus/Space, two vertical sticky positions, mobile horizontal alignment, underlined FAQ link, no-JS fallback and existing checkout/carousel flows. Receipt /tmp/consuelo-pricing-polish-browser.json.
- Desktop/mobile comparison and FAQ screenshot review completed; /tmp/consuelo-pricing-polish-comparison-1440.png and corresponding375/FAQ variants.
- Strict review passed0 issues before final browser formatting. Full managed gate follows.
