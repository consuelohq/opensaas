# Synthetic coaching replay

This directory contains synthetic LIFE INSURANCE text, provisional acceptable
card IDs and visibility windows, a bounded replay scheduler, and a closed-schema
observer. The labels are authored hypotheses; they have not been adjudicated by
insurance experts or measured against customer calls. Holdout paraphrases are
separately authored from calibration examples, but come from the same synthetic
playbook and are not an independent sample from a real customer population.

Current checks:

```sh
bun run --cwd packages/conversation build
bun test packages/dialer-server/src/coaching-replay
# Enable the isolated local PostgreSQL round trip (requires pg_config/initdb).
CONSUELO_RUN_COACHING_POSTGRES=1 LC_ALL=C bun test packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts
# Supply a new, owner-only directory for six non-overwriting reports.
bun packages/dialer-server/src/coaching-replay/compare.ts /path/to/private-directory
```

The transcript fixture drives the published conversation timeline reducer
through revision, duplicate, out-of-order, gap, reconnect, unknown role, scope
and terminal cases. Scheduler tests use a stub port and prove scheduling and
cleanup only. The observer test injects wrong cues and checks the failure is
reported. The comparison uses the real compiler and Script session with normal
UI-default heading triggers and fixture authority. Its mock selector always
chooses the first eligible card; it is deliberately naive, not a model quality
comparison. The separate PostgreSQL test calls the actual UI API adapters and
Hono routes with fixture authority and outbox data. It is not a browser test.
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
