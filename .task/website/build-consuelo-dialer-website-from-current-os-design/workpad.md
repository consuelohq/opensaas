# Branch 1 — Consuelo Dialer website

## Goal and ownership
Ko approved Branch 1 to clone the current website, preserve its blue/cloud/editorial design, and replace OS positioning with original sales-focused Dialer copy. Work in stream/website is established by this website branch approval. Own packages/dialer-website and the minimal test-selection wiring for that package. Preserve packages/consuelo-website, packages/documentation, backend code, production routes, and Branch 2 docs ownership. Branch 3 owns domain cutover and final onboarding integration. No calls, charges, OAuth registration changes, production-domain changes, or main merge in this task.

## Dependency graph
Current remote main -> Branch 1 website preview + independently Branch 2 docs -> Branch 3 integration/domain cutover. Start from current main; do not copy the stale root checkout. Existing website provides layout, styles, fonts, clouds and accessible FAQ. New package is independently buildable with Bun. No shared design extraction or new framework.

## Research and positioning
Reviewed https://www.kixie.com/ and https://www.nooks.ai/ on 2026-10-28. Kixie foregrounds calls/routing and Nooks broadens to revenue execution. Use their clarity of outcome, not their sentences, logos, customer claims, features or performance figures. Original direction: Turn more leads into live conversations. Explain multi-line outbound, inbound allocation, GoHighLevel context, analytics and optional transcription. No unsupported numerical lift or zero-latency claims.

## Commercial evidence
Read selected public commercial settings from the deployed Railway service: Single $59/month, Standard $99/month, Power $159/month; one number included per seat, additional number $1.99/month; caps 1/3/10 numbers; Single 1388 included connected minutes. Verify matching Stripe price amounts/currency/interval before using. Never include secret values, provider budgets, customer records or credentials.

## Availability boundary
The current controlled live carrier attempt was rejected (21216); GHL session refresh remains unresolved. Label this preview and route Get started through an honest setup request/guide, not a forged install URL or a live checkout. Inbound is in controlled rollout; live coaching and transcript-upload review are planned, not verified available. Groq/Whisper transcription is optional, configured per workspace/plan. Keep implementation details out of the primary sales funnel.

## Test-first contract
Behavior: independent Dialer package and preview deployment, correct public branding/navigation, three verified monthly plans, safe plan-aware setup flow, accessible FAQ, no OS installer or legacy OAuth links, no production-domain mutation. Existing pattern: Astro static marketing package with tokens/primitives and Playwright browser checks.
New tests: package/preview boundary and rendered-site contracts plus real browser navigation, FAQ behavior, plan selection/query safety and responsive overflow/CTA visibility (including 568x320 and 667x375).
Focused red command: bun test packages/dialer-website/tests/marketing-contract.test.ts.
Expected red: new package config/build output is absent before clone/implementation.
No-test waiver: no per-sentence copy tests; visual and copy-only changes are reviewed through built HTML/screenshots. Structural/navigation behavior gets real contract/browser coverage.

## Scaffold decision
Nx list shows no installed Astro clone generator. Existing website and docs are independently Bun-owned Astro packages. Preserve this exact stack and clone tracked source/assets rather than generate a React/Vite app. No new shared workspace imports/dependencies are needed.

## workspace-owned: validation evidence

- 2026-10-28 21:24:51 `review.run`: passed — OK
- 2026-10-28 21:26:14 `review.run`: passed — OK

## Implementation / validation progress

- Focused delivery tests failed red with missing package/build outputs; first implementation passed 4 tests / 29 assertions.
- Verified active Stripe USD licensed monthly prices match configured 5900/9900/15900 cents. No charge or price mutation performed.
- Cloned current website source and preserved layout, tokens, fonts, clouds, FAQ and closing reveal. Removed unused clone OS routes, starter-kit source, blog/media, OS installer code, stale OAuth links, inherited Pages Functions, extra npm lock and editor launch files. Original package unchanged.
- Added five feature stories, monthly plans, safe plan-aware setup email flow, local guides/how-it-works/contact and cloned company policies. No promises of automatic activation or measured conversion lift.
- Reproducible build restores 4 clouds and 2 new share cards from checked-in encoded sources. Preview has no production routes, no secrets and noindex in meta, robots and response headers.
- Browser checks caught the longer Dialer/Get started mobile header collision at 320px; adjusted only clone mobile tokens/header/hero spacing. All 8 viewport checks, FAQ interactions, plan flow, malicious plan queries, 79 internal links and motion checks reported pass. A full browser run is collecting the terminal receipt separately because the complete matrix exceeds the short tool request budget.
- Root critical test selection explicitly installs locked Bun dependencies, builds this package and runs delivery contracts. No docs/OS/backend ownership changes.

## Final validation

- Full verify: result pass, mode full, publishValid true at 2026-10-28T21:28:05.509Z. All 4 selected suites passed (root selector contracts, locked package installation, Astro check/build, rendered delivery contracts). Astro: 0 errors / 0 warnings; two inherited inline-script hints remain.
- Complete browser terminal receipt: /tmp/consuelo-dialer-website-browser/full-run.json, status complete, exitCode 0, no stderr. Chromium passed 320x568, 375x812, 430x932, 568x320, 667x375, 768x1024, 1024x768 and 1440x960. Checked images, header clearance, no horizontal overflow, native FAQ mutual exclusion, closing CTA reachability, pricing-to-setup, untrusted plan query behavior, 79 local links, noindex and reduced/normal motion. All owned browser contexts and the HTTP server closed.
- Source audit proves no changes to existing OS website, documentation, OS runtime, Dialer backend or LeadConnector packages. git.diff reports the isolated clone and critical selector wiring.
- Social assets regenerated with inherited fonts/clouds and the new Dialer identity; original files remain unchanged.
- Dedicated blank Cloudflare Pages project consuelo-dialer-website-preview created. No production custom domains/routes, billing resources, OAuth settings, calls or recordings changed.

## Copyable coordinator handoff

Branch 1 owns packages/dialer-website only plus its critical test-selection rule/registry. The current OS website remains packages/consuelo-website. Branch 2 can clone docs independently and use CLAIMS.md as the capability/pricing boundary. Branch 3 must validate Marketplace onboarding, connect the new docs destination, plan production canonicals/indexing, map old URLs, preserve OS authentication and calls webhooks, then cut over domains. The current preview deliberately uses local guides and an email setup request; no live subscription starts. Inbound remains controlled rollout; live coaching and transcript upload remain planned.
