# Synthetic provider evaluation — 2026-11-16

This is a model/provider-pair experiment for the frozen synthetic life-insurance Script selector. It is not an ASR, customer-speech, carrier, production, or real-user capacity acceptance result. No recording or live transcription was enabled.

## Frozen protocol

- 72 original scenarios (60 positive, 12 negative) and 36 separately authored scenarios (24 positive, 12 negative).
- Existing windows, labels and thresholds are unchanged: 45/60 original hits, 18/24 separately authored hits, 24/24 negative abstentions and zero wrong/late visible cues.
- One bounded, closed-set selection request per scenario; the runtime can display the existing rule cue independently. Combined-system hits must not all be attributed to the model.
- Seed 17, 20 logical synthetic sessions, at most four physical provider requests. This is not proof of 20 simultaneous live users.
- Strict JSON schema, existing approved card/slot IDs, maximum 512 output tokens, five-second response deadline, no retries/fallback, reasoning explicitly disabled.
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

| Original unchanged criterion | Rules baseline | Luna combined runtime, actual wall time | Required |
| --- | ---: | ---: | ---: |
| Original positive hits | 31/60 | 38/60 | at least 45/60 |
| Separately authored positive hits | 10/24 | 14/24 | at least 18/24 |
| Negative abstentions | 24/24 | 23/24 | 24/24 |
| Wrong visible cues | 0 | 1 | 0 |
| Late visible cues | 0 | 10 | 0 |

The false interruption was frozen historical-coverage case S035. The ten late cues arrived about 5.13–6.00 seconds after transcript ingest, beyond their original five-second window. Selector metrics reported 29 discarded results and 54 applied checkpoints; discarded results are not automatically provider errors. Queue wait is included in these session timings, while the transport's own deadline starts later. Do not interpret the roughly 4.82-second median session settle time as model-only inference latency. The overall first-cue median is dominated by immediate rule cues and is not a model-latency median either.

Virtual-clock scoring produced 45/60 original and 17/24 separately authored positive hits, with the same false interruption. It is useful for diagnosis, not a substitute for the wall-time gate. No thresholds, windows or labels were relaxed.

Conservatively reconciled Luna cost was $0.009209173, including the numeric rounding margin. Reported tokens were 184,311 input and 4,930 output, with 148,927 cache reads (80.80% of input), 35,168 cache writes and zero reasoning tokens, each counter reported for all 108 requests. These observed cache writes matter to cost even without explicit cache directives in the request. Diagnostic plus Luna reconciled cost was $0.009506973, below one cent and well within the new shared $1 authorization.

The account balance decreased about $0.011873274 across all three runs, consistent with the first attempt's approximate account-level delta and the two fully reconciled follow-up runs. That does not retrospectively release the first artifact's unknown request-level reservations. No new inference is authorized merely because most of the cap remains unused: all 8+108 authorized follow-up requests have been consumed.

**No production model selected.** Luna was structurally reliable in this run and improved timely hits, but current-topic correctness and queue-to-cue timing remain blockers. DeepSeek's incomplete cohort and eight-case diagnostic do not establish an apples-to-apples full quality comparison or prove that a different provider/quantization would behave identically. Further paid iterations require their own bounded authorization.

## Interpretation

Use cost per correct, timely, useful cue and measured full-response timing, including rejected/failed work. Token prices and generic intelligence indices are shortlist inputs. Neither a low published token rate nor a short time-to-first-token establishes a good coaching result. Cache-read prices are not measured cache-hit rates; observe actual usage counters before estimating savings. These provisional labels still need human adjudication and broader audio scenarios before a launch decision.
