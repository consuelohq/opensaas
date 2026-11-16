# Synthetic provider evaluation — 2026-11-16

This is a model/provider-pair experiment for the frozen synthetic life-insurance Script selector. It is not an ASR, customer-speech, carrier, production, or real-user capacity acceptance result. No recording or live transcription was enabled.

## Frozen protocol

- 72 original scenarios (60 positive, 12 negative) and 36 separately authored scenarios (24 positive, 12 negative).
- Existing windows, labels and thresholds are unchanged: 45/60 original hits, 18/24 separately authored hits, 24/24 negative abstentions and zero wrong/late visible cues.
- One bounded, closed-set selection request per scenario; the runtime can display the existing rule cue independently. Combined-system hits must not all be attributed to the model.
- Seed 17, 20 logical synthetic sessions, at most four physical provider requests. This is not proof of 20 simultaneous live users.
- Strict JSON schema and existing approved source content: v1 selected card/slot IDs; v2 selects card/evidence and derives the complete layout locally. Maximum512 output tokens, no retries/fallback, reasoning disabled. The initial transport deadline becomes a full receipt-to-commit deadline in v2.
- American inference companies and pinned US-labelled endpoints; this is not a claim about residency of all OpenRouter gateway processing. No paid regional-routing plan was purchased.
- Report successful, rejected and failed attempts; missing cost/cache/reasoning information is unknown rather than zero. Account balance changes are cross-checks, not request-level receipts.

## First attempt: DeepSeek / Wafer US

Model `deepseek/deepseek-v4.1-flash-1017`, endpoint `wafer/us` (MXFP4). Fingerprint `b54c85c6ad1e3476f0840718d7ec7939d178ba63dd083f2139b8886db73b4554`.

| Observation                             |                     Result |
| --------------------------------------- | -------------------------: |
| Approved maximum                        |          108 requests / $2 |
| Physical requests sent                  |                         71 |
| Accepted response + usage reports       |                         19 |
| Unknown charge reservations             |                         52 |
| Further requests refused by budget      |                         37 |
| Known reconciled cost                   |               $0.000655339 |
| Unknown reserved ceiling                |               $1.976246272 |
| Account balance decrease during the run | approximately $0.002366432 |
| Combined runtime timely positive hits   |                      42/84 |
| Accepted model card promotions          |                          1 |
| Wrong/late visible cues                 |                          0 |
| Operational negative abstentions        |                      24/24 |

**Inconclusive provider-quality result.** The same source's carrier-free rule baseline remains 31/60 original and 10/24 separately authored positives at logical concurrency 1, 5 and 20. Most visible cues above are baseline rules. A failed provider request is not evidence that the model chose to abstain. The run is incomplete and does not pass the quality gate.

The first transport only emitted billing metadata after validating the output. Thus billed-but-rejected answers could not be reconciled, and their rejection boundary was not recorded. The budget correctly retained those unknown reservations. Do not rewrite that artifact or call its account-balance delta a fully reconciled cost. Subsequent source changes add separate numeric attempt diagnostics and preserve strict answer validation.

## Follow-up authorization

The user authorized at most 8 DeepSeek diagnostics plus the 108-scenario Luna comparison, with a **new shared $1 cap**. Diagnostics initially reserved at most $0.31. After all eight costs settled with no outstanding reservation, unused allowance returned to the same pool: Luna's maximum became $0.999702200, so diagnostic cost plus worst-case Luna exposure still cannot exceed $1. Each gets a fresh one-shot directory and fingerprint. Source/metadata preflight must pass again before sending anything.

### Eight-request DeepSeek diagnostic

Fingerprint `b576db5401ff774ebcb7d5dcb96a4ebc1af16f664a6ea98c2c8ec93d8a5cd1b5`. All eight requests executed and reconciled. All returned HTTP 200 and finish reason `stop`; four selections passed validation, three failed the slot-reference check and one failed the evidence-reference check. None was truncated. Rejected answers stayed off-screen. This diagnoses this sample; it does not retrospectively classify every rejection in the first attempt.

Conservatively reconciled cost was $0.000297800 (including the numeric rounding margin), with no outstanding charges or budget refusals. There were 12,132 input tokens, 188 output tokens, and eight explicit reports of 8,960 cached input tokens, zero cache-write tokens and zero reasoning tokens. Cached reads covered 73.85% of input in this small repeated-playbook sample; that is not a forecast of production cache coverage.

This eight-case subset is diagnostic, not a new quality gate or a complete model comparison. The CLI's strict `complete` flag remains false because only four selections validated; all eight physical requests nevertheless finished with known costs.

Luna is `openai/gpt-6-luna` on `amazon-bedrock/us-east-1`. Full-context reservations include documented long-prompt/cache-write/output pricing tiers, even though the actual synthetic prompts are short. Its conservative per-request reservation is $0.289172400; the shared remaining cap allows at most three simultaneous requests, versus four for Wafer. Admission must queue within that derived limit rather than immediately refusing otherwise affordable work. The same 20 logical sessions and original visibility windows remain in use, but this is not a fair comparison of raw provider speed at an identical physical concurrency. Price ceilings remain explicit. These configurations and credentials are private and are not runtime defaults.

### Luna / Bedrock US East full cohort

Fingerprint `e61acde9264445a298124587b4de4189658ff2eb8279aaf80a421acf6fd3f814`. All 108 physical requests returned HTTP 200, finish reason `stop`, structurally valid selections and validated same-request billing. There were no retries, refusals, unknown charges or occupied slots at finish. The strict completion flag passed; the quality gate did not.

| Original unchanged criterion      | Rules baseline | Luna combined runtime, actual wall time |       Required |
| --------------------------------- | -------------: | --------------------------------------: | -------------: |
| Original positive hits            |          31/60 |                                   38/60 | at least 45/60 |
| Separately authored positive hits |          10/24 |                                   14/24 | at least 18/24 |
| Negative abstentions              |          24/24 |                                   23/24 |          24/24 |
| Wrong visible cues                |              0 |                                       1 |              0 |
| Late visible cues                 |              0 |                                      10 |              0 |

The false interruption was frozen historical-coverage case S035. The ten late cues arrived about 5.13–6.00 seconds after transcript ingest, beyond their original five-second window. Selector metrics reported 29 discarded results and 54 applied checkpoints; discarded results are not automatically provider errors. Queue wait is included in these session timings, while the transport's own deadline starts later. Do not interpret the roughly 4.82-second median session settle time as model-only inference latency. The overall first-cue median is dominated by immediate rule cues and is not a model-latency median either.

Virtual-clock scoring produced 45/60 original and 17/24 separately authored positive hits, with the same false interruption. It is useful for diagnosis, not a substitute for the wall-time gate. No thresholds, windows or labels were relaxed.

Conservatively reconciled Luna cost was $0.009209173, including the numeric rounding margin. Reported tokens were 184,311 input and 4,930 output, with 148,927 cache reads (80.80% of input), 35,168 cache writes and zero reasoning tokens, each counter reported for all 108 requests. These observed cache writes matter to cost even without explicit cache directives in the request. Diagnostic plus Luna reconciled cost was $0.009506973, below one cent and well within the new shared $1 authorization.

The account balance decreased about $0.011873274 across all three runs, consistent with the first attempt's approximate account-level delta and the two fully reconciled follow-up runs. That does not retrospectively release the first artifact's unknown request-level reservations. No new inference is authorized merely because most of the cap remains unused: all 8+108 authorized follow-up requests have been consumed.

**No production model selected.** Luna was structurally reliable in this run and improved timely hits, but current-topic correctness and queue-to-cue timing remain blockers. DeepSeek's incomplete cohort and eight-case diagnostic do not establish an apples-to-apples full quality comparison or prove that a different provider/quantization would behave identically. Further paid iterations require their own bounded authorization.

## Interpretation

Use cost per correct, timely, useful cue and measured full-response timing, including rejected/failed work. Token prices and generic intelligence indices are shortlist inputs. Neither a low published token rate nor a short time-to-first-token establishes a good coaching result. Cache-read prices are not measured cache-hit rates; observe actual usage counters before estimating savings. These provisional labels still need human adjudication and broader audio scenarios before a launch decision.

## V2 correction and controlled comparison

The user approved continuing the repairs and bounded synthetic evaluation. This continuation has a new shared $2 ceiling and at most 324 physical requests across two full panels and one optional confirmation panel. Prior run directories remain immutable; old unknown reservations are not recycled. Within this new scope only reconciled unused allowance can return to the pool.

V2 fixes a contract mismatch: the conversation reducer requires a complete approved card layout, whereas v1 allowed model-selected subsets of slots. The model now returns only an approved card ID plus exact evidence ID/revision pairs. The SDK supplies every approved point in source order. Independent Ajv checks the transmitted schema; the decoder still checks identity, exact keys, membership, unique evidence and cancellation. No arbitrary wording is generated.

A process-monotonic receipt deadline now covers queue admission, provider wait and commit. Repeated same-party text cannot renew old evidence; fresh meaningful queued speech can receive its own deadline. Expired logical work does not release a still-running physical transport. Current-evidence exclusions reject clear historical, reported, quoted or withdrawn mentions while preserving unfamiliar current language and deficits. Referenced evidence is checked independently from the current required/forbidden context; later required context does not incorrectly disqualify an earlier current evidence turn.

Private results now preserve at most 20 numeric request observations per session: queue wait, actual request-plus-validation settlement when known, logical decision duration, total receipt age, catalog/evidence indices and a closed outcome enum. Null physical duration means it was unsettled when sampled. These are backend callback measurements, not ASR, network-only inference, rendered UI or carrier latency.

Both v2 panels used 20 logical scopes and exactly the same maximum four physical requests, reasoning disabled and the unchanged five-second windows. Public metadata and source fingerprints were refreshed. All 108 logical cases remain scored; ten declined locally before inference, including one positive case. These are operational local abstentions, not model abstentions.

| V2 wall-time result                   |                DeepSeek / Wafer US | Luna / Bedrock US East |
| ------------------------------------- | ---------------------------------: | ---------------------: |
| Original positive hits                |                              52/60 |                  58/60 |
| Separate positive hits                |                              21/24 |                  23/24 |
| Negative abstentions                  |                              22/24 |                  20/24 |
| Wrong / late visible cues             |                              2 / 0 |                  4 / 0 |
| Physical requests                     |                                 98 |                     98 |
| Validated responses and cost receipts |                                 95 |                     98 |
| Expired or cancelled logical requests |                                  3 |                      0 |
| Unknown charges retained              |                                  3 |                      0 |
| Known reconciled cost                 |                       $0.003185725 |           $0.007111410 |
| Outstanding reservation ceiling       |                       $0.114014208 |                     $0 |
| Queue wait p50 / p95                  |                     2468 / 3397 ms |         2449 / 3136 ms |
| Request plus validation p50 / p95     | 602 / 1139 ms (95 settled samples) |          683 / 1137 ms |
| Reported input / output tokens        |                      149655 / 2718 |          162012 / 3207 |
| Reported cached reads / writes        |                         136960 / 0 |         133785 / 28031 |

Fingerprints: DeepSeek `0707142a4d6e07796810ce85367b33fee777102a42587aa493734542cf5d3641`; Luna `32c1b9bd42f56549bc4e64c34505fe1755f61e2cd30a2461364a93f15e612d42`. Both include a private 75-file source manifest. DeepSeek had no invalid returned references; 95 completed outputs passed structural validation, while three aborted requests retained unknown billing exposure. Its strict completion flag failed. Luna completed all eligible inference requests, including correct local no-request cases, so completion passed. Neither passed semantic acceptance.

The combined runtime retains 41 immediate rule hits. DeepSeek added 32 timely correct cues and two false interruptions; Luna added 40 timely correct cues and four false interruptions. The larger combined score cannot all be credited to the model. DeepSeek's known cost is not a complete cost per useful result while three charges are unknown.

Observed errors distinguish a denied situation from a current difficulty. For example, missing employer coverage must not activate a card about possessing employer coverage; negative grammar can still express an affordability concern. A generic polarity clarification and past-aspect regression were checked in one final DeepSeek confirmation without changing aliases, fixtures, labels or windows. The conservative history exclusion also misses a synthetic positive describing an earlier purchase; do not silently relabel it.

Both routes remain evaluation-only. Neither model is selected as a production default.

### Final DeepSeek confirmation and local policy replay

After the generic full-proposition/polarity instruction and past-aspect fix, fingerprint `8950b1a5b9ac39ac971e67ba8a7b46ff99db3e5262bea229f0bb587f2df79851` scored 57/60 original and 23/24 separate positives. Eleven cases abstained locally before inference; all 97 physical requests completed with HTTP 200, finish `stop`, valid references and same-request cost receipts. No unknown charges, refusals, transport failures or occupied slots remained in this confirmation. Its source manifest contains 76 files.

The actual paid run still failed the unchanged gate: 22/24 negative abstentions, four wrong visible transitions, one churn transition and zero late transitions. A positive case can count as a hit and still emit a later wrong cue; the observer correctly preserves that error. Cost was $0.003624721, with 158712 input tokens, 2884 output, 135808 cached reads, zero cache writes and zero reasoning tokens. Queue p50/p95 was 2264/2761 ms; request-plus-validation p50/p95 was 543/1133 ms. These do not meet the separate provisional 250 ms context-response target.

One error revealed a second policy defect: after dwell, a lower-priority contextual choice could replace a stronger current authored match. A new failing regression demonstrated this, then the commit guard was corrected. It compares the current authored rule, not an indefinitely retained priority from an old topic. After that final source change, a private **cached numeric-decision replay** at logical concurrency 1/5/20 retained 57/60 + 23/24 hits and blocked that one override. Three wrong visible transitions remained (two negative interruptions and one wrong positive card), with zero churn. This is free local policy/mechanics evidence using recorded decisions, not a new paid-model, latency or 20-user result. No later provider evaluation of this exact final source is claimed.

Across the three v2 panels, 293 physical requests executed. Known conservative reconciled cost totals **$0.013921856**. The account cross-check decreased approximately $0.013921547; three reservations from the first v2 DeepSeek run still retain a $0.114014208 unknown ceiling. Known cost plus retained exposure is $0.127936064, below the new shared $2 cap. The confirmation reused only known unused allocation from that scope. All planned panels are now closed; unused allowance is not another retry cohort.

**Next acceptance work:** add reviewed card-applicability guidance that distinguishes possession from absence and a current unmet need from denial of a topic; cover that through authoring, immutable publishing and semantic evaluation rather than one-off frozen-fixture aliases. Preserve the history-purchase miss and the related provisional-label ambiguity for adjudication; do not silently rewrite its oracle. Re-run a properly bounded panel only after a substantive reviewed change. Actual Pi integration, audio-to-rendered-cue timing, signed live authority and customer/multi-user QA remain later dependencies. Neither provider is activated.
