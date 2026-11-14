# Synthetic coaching replay

The phrase-only hypothesis was **rejected** by the precommitted gate: the
frozen result was 31/60 original positives and 10/24 independent positives,
below 45/60 and 18/24. The two negative cohorts each had 12/12 abstentions and
no wrong or late visible cues. This is a provisional synthetic result, not a
population accuracy claim. Its labels, thresholds and initial red traces remain
unchanged; ordinary unit tests assert the recorded rejection and test the gate
rather than making unrelated CI permanently red.

This directory contains synthetic LIFE INSURANCE text, provisional acceptable
card IDs and visibility windows, a bounded replay scheduler, and a closed-schema
observer. The labels are authored hypotheses; they have not been adjudicated by
insurance experts or measured against customer calls. Holdout paraphrases are
separately authored from calibration examples, but come from the same synthetic
playbook and are not an independent sample from a real customer population.

The contextual candidate combines the reviewed rules and selector in the real
session. Its offline provider benchmark is opt-in, synthetic-only and has
not been run against a provider. Preflight refreshes public endpoint metadata,
uses a local fake to measure exact serialized request bytes, and binds the
model, provider, prompt revision, pricing, output directory, source and runtime
to a fingerprint. No model or price is implied by default. The Haiku JSON is a
dated draft for review, not permission to spend or a current price guarantee.

A later authorized run requires the reviewed fingerprint, a private fresh
output directory, explicit opt-in, and separately provisioned credentials.
A one-shot 0600 ledger reserves worst-case cost before every send and retains
unsettled reservations; valid same-request costs can release unused reserve.
It enforces 108 maximum attempts, four physical slots, pinned provider and
server price ceilings, no prompt caching or automatic retries. A cap may stop
the run early; all cases stay in the result and incomplete runs cannot pass.
Both virtual offsets and actual wall-time observations are reported; the
original five-second visibility windows apply to wall time too. Local mocks
prove mechanics only, and any later cached-decision replay at 1/5/20 scopes
must be labeled mechanics, not live provider concurrency or model quality.

After a separate authorization to contact the public metadata endpoint, a
reviewer can create a fresh owner-only directory and use:

```sh
bun packages/dialer-server/src/coaching-replay/provider-cli.ts --preflight packages/dialer-server/src/coaching-replay/provider-haiku.draft.json /path/to/private-directory
```

The preflight emits the current fingerprint, exact synthetic request-byte
range, price bounds and proposed cap. It does not access a credential or send
inference. A later paid run requires separate explicit user approval of that
specific configuration, fingerprint, budget and secure credential setup. Its
execution command is `CONSUELO_RUN_COACHING_PROVIDER=1 bun
packages/dialer-server/src/coaching-replay/provider-cli.ts --run <config>
<same-private-directory> <reviewed-fingerprint>`. Provider metadata and
source integrity are rechecked. The dated draft must be refreshed and reviewed
when prices, provider details, code, or date change; an incomplete run is not
an acceptance result.

## Tomorrow's reviewed benchmark

Both draft configs are dated 2026-11-14. Before any benchmark, refresh the
public endpoint metadata and prepare a reviewed, private config dated for that
day. Do not merely change the date: verify the pinned model, provider, current
prices, context limit, strict structured-output support, and reasoning setting.
Stop for review if prices or capabilities changed. The DeepSeek draft pins
`deepseek/deepseek-v4.1-flash-1017` to `deepinfra/fp8` / `DeepInfra` and
explicitly disables reasoning for the first latency comparison. The currently
advertised official DeepSeek endpoint lacks `structured_outputs`; do not
silently fall back to it or weaken the schema.

The user can fund the existing local OpenRouter key and then explicitly request
the bounded benchmark. Adding credit never starts a run. Preflight each reviewed
config and obtain a new fingerprint; use the same frozen cases and five-second
windows, with a separate owner-only output directory and one-shot ledger for
each model. The $2 limit is aggregate for the explicitly approved scope, not
$2 per model; allocate that total across models before approval. Price and cost
comparisons are estimates until validated actual `usage.cost` is available.
A capped or incomplete run is not an acceptance result.

Current checks:

```sh
bun run --cwd packages/conversation build
bun test packages/dialer-server/src/coaching-replay
# Enable the isolated local PostgreSQL round trip (requires pg_config/initdb).
CONSUELO_RUN_COACHING_POSTGRES=1 LC_ALL=C bun test packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts
# Optional offline phrase-only quality gate (returns nonzero when unmet).
CONSUELO_RUN_COACHING_QUALITY=1 bun packages/dialer-server/src/coaching-replay/quality.ts
# Optional loopback component browser fixture; stop with Ctrl-C to shut down PostgreSQL.
CONSUELO_RUN_COACHING_BROWSER_FIXTURE=1 bun packages/dialer-server/src/coaching-replay/browser-fixture.ts
# Supply a new, owner-only directory for twelve non-overwriting reports.
bun packages/dialer-server/src/coaching-replay/compare.ts /path/to/private-directory
```

The transcript fixture drives the published conversation timeline reducer
through revision, duplicate, out-of-order, gap, reconnect, unknown role, scope
and terminal cases. Scheduler tests use a stub port and prove scheduling and
cleanup only. The observer test injects wrong cues and checks the failure is
reported. The comparison retains the original heading-only and mock-selector lanes and
adds a separate reviewed-rules lane that passes the synthetic pack's explicit
rules through the real compiler and Script session. The reviewed lane also
includes 36 separately frozen synthetic scenarios, which are also scored in a
separate heading-only comparison; their labels remain
provisional and are not a sample of customer speech. All lanes use fixture
authority. Its mock selector always
chooses the first eligible card; it is deliberately naive, not a model quality
comparison. The separate PostgreSQL test calls the actual UI API adapters and
Hono routes with fixture authority and outbox data. It is not a browser test.
The optional loopback browser fixture uses the actual authoring renderer,
controller, API, styles, Hono routes and a temporary local PostgreSQL instance.
Its surrounding script selection/import host and identity are fixtures; it does
not exercise the full CRM embed or real authentication.
Virtual cue offsets are fixture clock offsets, not
wall-clock latency. No audio has been transcribed, no provider model has been
called, and these tests establish no ASR quality, carrier delivery or UI timing.

The benchmark schema permits only a version, integer seed, fixed lane and
concurrency, controlled scenario IDs, verdicts, numeric counters, selector
request counts and measured wall times. It rejects free-form fields; never add
transcript text, arbitrary customer identifiers or provider payloads to it.
`writePrivateBenchmark` accepts an existing owner-only directory and uses
exclusive creation with mode 0600 so a previous run is never overwritten.
The scheduler records ingest, first cue callback and settle wall times; these
are not UI or audio-to-cue timings. Source-fidelity, provider billing and
full-path measurement remain unfinished. DEV-1698's
older evidence writer is separate and is not certified by this work.

One seed-17 run of 72 provisional scenarios produced 1/60 positive hits and
12/12 negative abstentions in the rules lane at each concurrency. The naive
mock at concurrency 1 produced 11/60 hits, 49 wrong cards and 12/12 false
interruptions. Its request count fell under the shared selector capacity at
higher concurrency. These are direct in-process sessions, not real carrier
users, production throughput, or a claim about an evaluated model. A 3-second
selector response after a newer final at 2 seconds is discarded by the strict
cursor fence; it is an observed abstention, not an end-to-end latency pass.
Real audio, ASR/provider quality, full wall-clock delivery and broader closed
loop acceptance remain open. Signed live grants, member consent, entitlement
and inbound binding are not established by the fixture (DEV-1707).

Recall is the fraction of positive scenarios with an acceptable cue within its
window. Cue precision is the fraction of distinct non-null cue transitions that
are acceptable and timely. Wrong or late transitions are counted even if a
later transition is acceptable; churn counts transitions after a visible cue.
No-cue cases measure false interruptions and correct abstentions. Report sample
counts and null ratios when a denominator is zero; do not present these small,
synthetic samples as population accuracy or latency guarantees.
