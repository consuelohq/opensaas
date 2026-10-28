# Consuelo Dialer website

Branch 1 public marketing preview, cloned from packages/consuelo-website at main 03aca1b5bb80cceeaba63a23c640d17ce411d22b. Existing OS website and docs remain unchanged.

## Run

Use Bun in this directory: bun install; bun run build; bun run preview -- --host 127.0.0.1. Run bun test tests/marketing-contract.test.ts and bun run test:browser. Browser checks default to bundled Playwright Chromium; set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to an existing browser when needed.

## Deploy preview

Cloudflare Pages project consuelo-dialer-website-preview; deploy dist using Wrangler Pages. No production routes or domains are declared. All previews are noindex/nofollow. Public onboarding opens an email setup request, not a payment or an unverified Marketplace redirect. No secrets are included in this package.

## Handoff

Branch 2 owns Dialer documentation. Branch 3 replaces local /guides links with the verified new docs destination, validates the current Marketplace install flow, maps legacy routes, updates canonicals/indexing and attaches production domains. It must preserve OS authentication, calls.consuelohq.com webhooks and existing installations. Do not cut over domains as part of this branch.

See CLAIMS.md for current public capability and pricing evidence. The cloned company policy text is retained, with the obsolete product description/address placeholder removed; final company policy ownership stays with the launch coordinator.
