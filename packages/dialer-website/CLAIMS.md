# Dialer website claim ledger

Verified 2026-10-28 against main 03aca1b5bb80cceeaba63a23c640d17ce411d22b and deployed public commercial configuration. This is an early-access marketing preview, not carrier acceptance evidence.

| Claim | Evidence | Status / public treatment |
| --- | --- | --- |
| Multi-line selection, local presence, bounded line capacity | packages/dialer SDK; dialer-server plans/entitlements.ts | Implemented; no fixed answer-rate or latency improvement claimed |
| GoHighLevel embedded calling/context | packages/lead-connector embed and standalone bootstrap | Implemented; setup must validate session behavior; no claim all CRMs work |
| Inbound routing and fallback policies | dialer-server inbound contracts / PG harness | Controlled rollout; explicitly labeled; real carrier activation not established here |
| Call history and outcomes | server call-history application/contracts | Implemented; no invented team results or dashboard stats |
| Recording/transcription | plan catalog, call operations, Groq adapter | Optional per plan/workspace; not represented as always enabled |
| Live coaching / transcript uploads | Not established by scoped current implementation audit | Planned; explicitly described as in development |
| Single/Standard/Power monthly pricing | Read-only deployed configuration and Stripe active USD licensed monthly prices agree at 5900/9900/15900 cents | Display $59/$99/$159 per seat/month; no charge is started by the preview |
| Number quantities / line limits | Deployed public settings 1/3/10; entitlements derive lines from active numbers; fixed caller ID caps at one | Describe up to 1/3/10, with active-number/selection condition |
| Included number / extra number / Single minutes | Deployed public settings: 1 included, 199 cents/month extra, 1388 connected minutes | State plainly; no unlimited-usage claim |

Competitor positioning references only: https://www.kixie.com/ and https://www.nooks.ai/. No competitor assets, testimonials, metrics or proprietary copy are used.
