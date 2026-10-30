# Dialer website claim ledger

## Pricing launch draft — 2026-10-30

Ko requested launch-ready wording in this isolated pricing draft. These are **target offers**, not proof that deployed Stripe entitlements or every product workflow already match. Keep this redesign on the noindex preview until the launch issues are resolved. Do not publish these target claims to the indexed company site as current capabilities without evidence.

| Target | Source / current evidence | Launch gate |
| --- | --- | --- |
| Starter: free, 100 lifetime minutes; Professional $99 with 1,000 monthly minutes; Agency $149 and Enterprise $199 with 5,000 monthly minutes per seat | Ko's Oct 30 brief and explicit $149 / 5,000 replies; current server still single/standard/power | [DEV-1644](https://linear.app/consuelo/issue/DEV-1644) |
| Paid lines and numbers: 3 / 10 / 30; $3 extra numbers; number packs 10/$28, 50/$125 | Ko specified allowances and $3; discounted bundles are design proposals. Current shared included-number and predictive capacity semantics differ | DEV-1644, DEV-1646 |
| One rep seat covers inbound + outbound; annual billed at monthly rate ×12 | Explicitly recorded draft assumptions while billing questions remain unanswered; no invented annual savings | DEV-1644; confirm policy before checkout |
| Minute packs $10/100, $50/600, $100/1,400 | Proposed from current carrier list pricing, no-arbitrage tests and $0.05 per-minute stress scenario; not active Stripe products | DEV-1644; see BILLING-ECONOMICS.md |
| Predictive dialing, local presence, recordings and transcripts begin at Agency | Ko's requested tier split. Existing SDK algorithms, provider and call-history paths support pieces; commercial enforcement and full workflow must align | DEV-1644 / DEV-1646 |
| Inbound routing, browser + forwarding phone, callback/voicemail, business hours | Existing inbound server/state/harness work. This website task places no calls and does not establish live acceptance | Existing activation proof + DEV-1644 entitlement mapping |
| GoHighLevel integration all plans | Existing lead-connector/embedded boundary; DEV-1642/1643 own trial/caller-ID proof | Preserve their ownership; no universal CRM claims |
| Mercury coaching: uploaded script guidance, live AI suggestions, transcript review | Intended launch add-on; existing transcription is insufficient evidence of a complete coaching workflow | [DEV-1645](https://linear.app/consuelo/issue/DEV-1645) |
| Team analytics/win rate, number management, spam protection, API setup | Existing call-history/number/runtime paths are partial evidence, not a complete commercial dashboard | [DEV-1646](https://linear.app/consuelo/issue/DEV-1646) |
| Authenticated workspace access, admin/rep permissions | middleware/auth.ts, runtime/auth.ts, LeadConnector OAuth/session boundary; audit and negative-test scope remains | [DEV-1647](https://linear.app/consuelo/issue/DEV-1647) |
| Enterprise SSO/provisioning and analytics MCP | Explicitly coming soon on the page | Separate future releases; no certification claims |
| Technology strip | Actual project tools: Twilio, Bun, Hono, PostgreSQL, Redis, Cloudflare, GitHub, Groq | Infrastructure marks, never customer testimonials/endorsements; upstream SVG provenance retained |

Public prices are USD for contiguous US local calling; specialized destinations/number types need a quote. No answer-rate, win-rate, latency or guaranteed spam-label result is invented. No credit-card checkout or automatic charge is implemented by this website task. CTA selections lead to an email setup request.

## Design sources

Figma's pricing layout (https://www.figma.com/pricing/) and Ko's screenshots informed column hierarchy, optional add-ons, expandable comparisons and sticky FAQ labels. All copy, SVG product symbols and page implementation are Consuelo-specific. No Figma assets, customer logos or claimed results were copied.

Earlier positioning references: https://www.kixie.com/ and https://www.nooks.ai/.

## Historical audit

The Oct 28 website verified old deployed prices $59/$99/$159, 1/3/10 capacity, one included number and $1.99 extra numbers. Those values are superseded **only in this launch draft**, not silently in billing. Production domain ownership changed after that audit; current main already includes the separate public-domain cutover. This task preserves those routes and only deploys the preview project.
