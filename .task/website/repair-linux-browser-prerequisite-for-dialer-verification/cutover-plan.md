# Authentication-safe public-site cutover

Status: preparation and first repair wave only; no production domain or auth routing changed. Captured 2026-10-28 America/New_York. Ko confirmed a signed-in read-only Consuelo OS tool call succeeds from the main ChatGPT agent before cutover.

## Desired public surfaces

| Address | Destination |
| --- | --- |
| https://consuelohq.com and www | Dialer website |
| https://docs.consuelohq.com | Dialer documentation |
| https://os.consuelohq.com/docs/ | OS documentation |
| OS website | Product decision pending: /about/ while retaining the current root login, or root homepage with a separate login entry point |
| https://calls.consuelohq.com | Existing Dialer application, API and webhooks |
| https://os.consuelohq.com/mcp | Existing authenticated ChatGPT/agent MCP service |

Recommendation: retain the existing OS root login and mount OS marketing under /about/. Narrow public path routes can then coexist with the existing authentication route; no auth front-door replacement is needed. If root marketing is selected instead, preserve an explicit login entry point and prove root session/redirect behavior before activating it.

## Invariants

- Preserve https://os.consuelohq.com as the OAuth issuer and the /mcp resource/audience.
- Preserve Google callbacks /login/google/callback and /oauth/google/callback, Google client registrations, cookies, signing secrets, existing bearer/refresh tokens and the current Durable Object namespace and D1 registry.
- Preserve /login/*, /oauth/*, /.well-known/*, /mcp and /mcp/*, /auth/*, /onboarding/*, /workspace/*, /internal/*, /managed-cloud/*, /webhooks/* and /health with their existing methods, bodies, headers, status/redirect behavior and no-store policy.
- Preserve workspace-edge internal/gateway/wildcard routing, WAF/MCP source-IP policy, installer/device verification and all calls.consuelohq.com routes.
- Public content must not expose auth through a workers.dev preview or become an alternate origin that bypasses the MCP WAF policy. Static/content routing must never catch arbitrary authentication paths.
- Do not rotate credentials, export token stores, purchase numbers, charge Stripe, or initiate a carrier test as part of this cutover.

## Verified current state

- Main: 508441ced8a275b12d5855dec414fa17a1c92ad9.
- OS authority route os.consuelohq.com/* points to consuelo-os-device-authority; current version 2ddfd3b1-71be-452c-938c-503b2fe5df03.
- OAuth metadata and both protected-resource metadata paths return the existing OS issuer/resource. Google start returns a Google authorization redirect whose callback remains on the OS origin.
- Anonymous Mac requests to /mcp receive Cloudflare 403. This is not evidence that the signed-in ChatGPT path is broken; Ko verified that path separately.
- Root website is the consuelo-website Pages project. Rollback deployment: 528c6d1c-5cc0-4bc8-b712-2d1845ec2171.
- Old OS docs are the consuelo-docs Worker, with docs.consuelohq.com as a custom domain and an explicit no-script docs.consuelohq.com/* route. Current OS docs version: 2520525d-b010-405c-bc23-8eddf69ebbf7.
- Dialer previews: https://consuelo-dialer-website-preview.pages.dev/ and https://consuelo-dialer-docs.kokayi-90b.workers.dev/.
- Private, credential-free deployment/route/binding baseline: /private/tmp/consuelo-domain-cutover-preflight/baseline.json. It records identities and secret names, never secret values.
- Current Wrangler authorization can read/manage Worker routes and Pages; DNS record reads return 403. Do not assume DNS mutation permissions. Prefer existing bindings and provider-native routes; acquire a narrowly scoped permission only if the final implementation actually needs it.

## Repairs already published to review

Task tsk_a6d011c41eb2, task PR #2655 merged into shared review PR #2651. Main was integrated without losing the Dialer docs/phone-budget work. Both test-selector rules were retained.

1. Clean website builds failed because Bun test types leaked in from the developer's parent checkout. Added package-owned types and proved a frozen standalone install/build outside the monorepo.
2. Two committed PNG icons were corrupted UTF-8 representations. Generate ignored PNG outputs from committed SVG and validate decoded dimensions.
3. Initial and cross-page fragment navigation reset scroll position. Preserve fragment targets; real normal-motion browser coverage now proves the behavior.
4. The critical website gate omitted the browser contract. Added it and repaired Linux installed-browser detection after the first real CI run exposed the missing downloaded Playwright browser.
5. The production workflow redeployed OS authentication on every main push. Added a separate tested public/OS release classifier while keeping existing Dialer classifier/release jobs byte-for-byte unchanged. Website/docs-only changes now leave the OS release lane off. Runtime/dependency changes and explicit manual release controls remain supported.

These repairs prepare release safety. They do not yet change which package supplies the public production website/docs.

## Frozen dependency graph

```text
Authenticated ChatGPT baseline (confirmed) + live route/state baseline (saved)
  -> Delivery and CI repairs (published; final Linux CI confirmation pending)
  -> Decide OS root/login placement
  -> Stage OS website and OS docs on isolated deployments with the chosen base paths
  -> Prove links, assets, search, Markdown, translation paths and old OS URLs
  -> Publish exact validated routing/deployment source
  -> Mount OS public content without changing authentication identity/state
  -> Verify Google login + existing ChatGPT tool call
  -> Point root website and docs domain to Dialer content
  -> Verify both products + existing ChatGPT tool call again
  -> Promote temporary redirects/caching only after acceptance
```

## Required staging work

- Keep the original OS website/docs packages and deploy OS copies beside existing services before changing a public binding.
- Make base paths explicit in Astro configuration and custom links, assets, sidebar/breadcrumb matching, search, Markdown links and translation endpoints/source normalization. A successful root build is not proof of /docs/ correctness. Do not rely on wholesale HTML string replacement.
- Update OS canonical/social/sitemap and docs/login links so the moved site does not identify itself as the new Dialer root or send Sign in back to its own marketing page.
- Update Dialer preview-only canonicals, noindex/robots and guide links only for its production build; keep previews noindex.
- Preserve old OS documentation URLs with an explicit route map. Shared OS/Dialer slugs need deliberate ownership; do not redirect every old URL to the new Dialer homepage.
- Ensure production release jobs deploy the intended package to each product's service. A manual cutover without updating deployment ownership would be reverted by a later release.
- Finish/revalidate applicable docs review fixes before promoting that preview. DEV-1631 then DEV-1634/DEV-1635 are the current grouped owners. DEV-1632/DEV-1633 overlap those groups and must not be assigned independently without consolidation.
- Get started currently requests onboarding rather than charging Stripe. Marketplace onboarding and live Dialer acceptance remain separate gates; publishing marketing does not prove them.

## Acceptance and rollback

Before changing any route, re-read current main, exact deployment IDs and route owners. Reject stale plans/concurrent changes. Stage without production routes, run browser tests against actual deployed previews, then change one public surface at a time. Keep authenticated responses out of public caches and pass auth through unchanged where applicable.

Require: responsive public pages; correct canonicals; all declared assets decodable; deep links; search; Markdown actions after client navigation; API paths and trailing slash/query handling; no leaked preview URLs or credentials; unchanged auth metadata/callbacks; same auth state-binding identities; a real signed-in ChatGPT tool call and Google sign-in behavior.

If authentication or routing regresses, immediately revert only the newly changed public route/binding/deployment to its recorded predecessor. Restore the prior root Pages deployment and docs route owner as appropriate. Do not delete/recreate authentication services, roll back token state, change OAuth clients or disable WAF to make a smoke test pass.
