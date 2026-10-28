# Dialer docs claim ledger

Source baseline: main 03aca1b5bb80cceeaba63a23c640d17ce411d22b. Research informs writing; current code, focused contracts and controlled runtime evidence establish behavior. No new live carrier or paid billing action is performed by this task.

| Claim | Public pages | Source | Test evidence | Runtime verification | Status |
| --- | --- | --- | --- | --- | --- |
| Direct and pipeline-stage intent, requested fanout 1–3 | Start, Outbound | packages/lead-connector/src/embed/controller.ts; state-machine.ts; api-client.ts | controller.test.ts; state-machine.test.ts; api-client.test.ts | Prior location activation does not certify self-service install; new browser checks validate docs only | preview |
| Local-presence selection and caller-ID locks | Outbound/local-presence | packages/dialer/src/services/local-presence.ts; caller-id.ts | Corresponding SDK tests | No new live call; no performance uplift claimed | preview |
| Readiness, fenced offers and distinct connecting state | Inbound, Team | packages/lead-connector/src/embed/inbound-operator.ts; packages/dialer-server/src/inbound/operator.ts | inbound-operator.test.ts; telephony.integration.test.ts | Live acceptance remains a separate release gate | preview |
| Callback, overflow and voicemail require explicit configuration | Inbound | packages/dialer-server/src/inbound/callback-telephony.ts; telephony-config.ts; telephony-twiml.ts | callback-telephony.integration.test.ts; telephony.integration.test.ts | Disabled in the previous controlled proof; not generally active | preview |
| Stored call history and transcript status | Analytics | packages/dialer-server/src/routes/calls.ts; call-operations/application.ts | call-history-application.test.ts; call-operations/application.test.ts | No claim that every customer dashboard is complete | preview |
| Groq/Whisper transcription is conditional | Analytics/transcripts | packages/dialer-server/src/call-operations/groq.ts; runtime/railway.ts | groq.test.ts; transcription-boundary.test.ts | No transcription enabled by this task | preview |
| Live coaching and uploaded-transcript feedback | Analytics/transcripts | No supported workflow established in the scoped source audit | None establishing product availability | Not verified | planned |
| Three monthly catalog tiers and their feature flags | Billing | packages/dialer-server/src/plans/catalog.ts | commercial.acceptance.test.ts | No live price/Stripe mutation; no hardcoded public prices | preview |
| Authenticated read routes and rejected generic policy PATCH | Reference/http-api | packages/dialer-server/src/routes/calls.ts; voice.ts; inbound-operator.ts | Hono contract suites | Repository contracts; hosted API availability remains separately verified | preview |
| Shell, search, themes, Markdown and translation | All pages | Clone of packages/documentation components/lib/pages | This package's contract, translation and browser checks | Local rendered checks recorded in task workpad | preview |
