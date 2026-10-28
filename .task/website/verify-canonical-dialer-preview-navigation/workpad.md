# Canonical preview verification follow-up

## Scope
Same approved Branch 1 website work. The original task PR #2647 merged and its remote branch was removed by the workflow. This task publishes only the browser-harness correction and current deployment evidence into the existing stream review PR #2651. No application UI, domain, backend, docs or billing changes.

## Test-first contract
Behavior: the same setup page is accepted with or without Cloudflare's canonical trailing slash. All query, FAQ, pricing and link checks remain. The existing live test reproduced red on /get-started/ versus expected /get-started after a successful CTA navigation. The test contract was too literal; application behavior is correct.
Change the existing browser assertion to the two valid paths and cache repeated reads of identical immutable targets, preserving all 79 link-occurrence checks. Use Node/Playwright as before; no new test layer is necessary for this test-only correction. No production edit.
Green evidence already collected against the actual published build: /tmp/consuelo-dialer-website-live-browser/final-run.json, complete, exitCode 0, empty stderr. This task will run its full verify before publishing.

## Preview evidence
Stable: https://consuelo-dialer-website-preview.pages.dev/
Immutable: https://d858c572.consuelo-dialer-website-preview.pages.dev/
Cloudflare deployment d858c572-ad40-4896-a219-3c775a1f62ea succeeded from source 8c33606da5c4897935585525490aa1e5359bd6dd. Public HTML/cloud/share assets returned 200 and noindex headers; share bytes matched the build. The stable alias returns 200. OS apex, docs and sign-in still return the original titles and routes.

## Coordinator handoff
Branch 1 website is implemented and previewed in packages/dialer-website. Branch 2 owns the independent Dialer docs clone. Branch 3 owns Marketplace onboarding, final docs links, canonicals/indexing, redirect mapping and production domain cutover. Preserve OS auth and calls webhooks. Inbound remains controlled rollout; live coaching/transcript upload are planned. Plans are $59/$99/$159 per seat/month, verified against active Stripe and deployed configuration. Preview starts no subscription.

## Final validation

Full verify pass / full / publishValid at 2026-10-28T21:39:00.185Z: locked dependencies, Astro build and delivery contracts all passed; review passed. The actual HTTPS browser run completed exit 0 with no stderr. Only the browser harness and task evidence differ from the original preview source; no application redeployment is needed for this correction.
