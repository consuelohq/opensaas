# Pricing economics and publication gate

Draft 2026-10-30. Owner: DEV-1644. This is an executable assumption model for pricing review, not a claim of measured gross margin.

## Source rates and topology

[Twilio US Voice pricing](https://www.twilio.com/en-us/voice/pricing/us) was checked on Oct 30: local outbound $0.014/min; local inbound $0.0085/min; browser leg $0.004/min; conference from $0.0018/participant/min; local number $1.15/month. Recording $0.0025/min and storage $0.0005/min/month are additional. AMD is $0.0075/call. Streaming and transcription have separate charges. List rates vary by destination; Alaska and toll-free costs do not fit a simple contiguous-US assumption.

A connected customer minute is not one provider minute. A simple two-participant conference baseline is:
- Browser outbound: 0.014 + 0.004 + 2×0.0018 = $0.0216.
- Forwarded-phone outbound: 2×0.014 + 2×0.0018 = $0.0316.
- Browser inbound: 0.0085 + 0.004 + 2×0.0018 = $0.0161.
- Forwarded-phone inbound: 0.0085 + 0.014 + 2×0.0018 = $0.0261.

These calculations assume the app actually uses that topology and matching durations. Reconcile against runtime invoices. They exclude queue/hold time, rejected/losing attempts, endpoint rounding, provider fees, recording, storage duration, model inference, support and fixed infrastructure. Parallelism can make per-connected-minute costs substantially higher. Unlimited use cannot be made profitable merely by naming a minute budget.

## Base-plan stress

At full 5,000-minute utilization, plus included local numbers:

| Plan | Browser outbound baseline | Forwarded-phone outbound baseline | Revenue |
| --- | ---: | ---: | ---: |
| Agency / 10 numbers | $119.50 | $169.50 | $149 |
| Enterprise / 30 numbers | $142.50 | $192.50 | $199 |

This does **not** establish healthy margins. Agency is already negative in the second scenario. No website task changes the requested allowances automatically. Resolve measured mix, safe provider budgets, overage/forwarding charges, BYOC or different allowances with Ko before activation. Do not apply an annual discount until unit economics and the commercial policy are agreed.

## Proposed packs

| Spend | Minutes | Sale rate/min | Gross margin at $0.05 variable cost/min |
| --- | ---: | ---: | ---: |
| $10 | 100 | $0.1000 | 50% |
| $50 | 600 | $0.0833 | 40% |
| $100 | 1,400 | $0.0714 | 30% |

The $0.05 stress envelope is an assumption, not a guaranteed upper bound. Re-estimate using measured attempts per connected call, median/boundary talk durations, forwarding mix, recording retention and inference usage. Longer-tail costs can exceed it. Mercury is separately quoted; no unbounded coaching inference is funded by minute packs.

Larger packs beat every cheaper-pack combination at the same spend: five $10 packs give 500 minutes versus 600; two $50 packs give 1,200 versus 1,400. Bun tests enumerate combinations and validate the margin envelope.

Additional local numbers: 1/$3, 10/$28, 50/$125 monthly. A 25% reserve over $1.15 vendor cost leaves modeled margins of 52.1%, 48.7%, 42.5%. Specialized number costs, regulatory fees and number inventory must be priced separately. Number packs expand the pool, not parallel line limits.

## Unresolved commercial policies

- Annual prices currently use the same monthly equivalent, billed ×12 up front; confirm this and the shared inbound/outbound seat assumption.
- Confirm taxes/fees, renewal/cancellation/proration, credit expiration/rollover/refunds and trial conversion. Do not invent favorable terms in FAQ copy.
- Version the new catalog and active Stripe prices; protect existing subscribers from unapproved changes.
- Prove usage limits and reconciled billing with idempotent provider events and failed/unknown purchase outcomes.
- Audit product claims and close DEV-1645/1646/1647 before public launch. Draft copy stays noindex.
