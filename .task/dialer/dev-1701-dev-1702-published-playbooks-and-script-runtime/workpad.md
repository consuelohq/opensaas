# DEV-1701 DEV-1702 published playbooks and Script runtime

branch: `task/dialer/dev-1701-dev-1702-published-playbooks-and-script-runtime`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2800
started: 2026-11-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-server/src/coaching/cue-service.ts`
- `packages/dialer-server/src/coaching/review-regressions.test.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/mercury-authoring.ts`
- `packages/lead-connector/src/embed/mercury-feed-api.ts`
- `packages/lead-connector/src/embed/mercury-feed.test.ts`
- `packages/lead-connector/src/embed/mercury-feed.ts`
- `packages/lead-connector/src/embed/state-machine.ts`


## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract and frozen scope

Grouped DEV-1701/1702 server/domain checkpoint on immutable integration aee54abf2f477ae09f5181c9b504a8a61ea48e9d (merged only after main1d31 ancestry/status confirmed). No old1699 task session restoration. Own compiler/publication storage/routes and Script runtime+authorized cue feed. UI owns authoring/feed presentation; STT owns020normalization/outbox and package/Docker linkage. Reserve021 publication/pins extension, registration additive.

Behavior: deterministic source-faithful3–4slot Markdown/TXT compilation; immutable publication with author/admin/workspace/revision races; call pin immune to edits; finalutterance speaker/negation/quoted/history abstention, priority/manual fences; closedselector oneinflight/budget/deadline/Off/consent/cancellation; actual authenticated server route projects only validated approved cues. Focused tests first in coaching/playbooks-engine.test.ts and service routes/isolatedPostgres integration. Red command bun test packages/dialer-server/src/coaching/playbooks-engine.test.ts; expected missing new module. No-test waiver none. Browser authoring acceptance remains UI integration gap, not claimed.

Default runtime live policy must fail closed/manual-reference until signed Mercury capability source exists; no unconditional paidplan override. Authorized fixture service path proves live reducer→cue→delivery, not productionactivation. Outbox source cursor notcorecursor; gaps/reconnect/origin must be authoritative. Longcall capacity explicitfailclosed; no silentcursorreset. No providers/paidinference/calls/realcredentials.

- 2026-11-13 20:48:52 append: `.task/dialer/dev-1701-dev-1702-published-playbooks-and-script-runtime/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/coaching/cue-service.ts`
- `packages/dialer-server/src/coaching/playbook-store.ts`
- `packages/dialer-server/src/coaching/playbooks-engine.test.ts`
- `packages/dialer-server/src/coaching/playbooks.postgres.integration.test.ts`
- `packages/dialer-server/src/coaching/playbooks.ts`
- `packages/dialer-server/src/coaching/README.md`
- `packages/dialer-server/src/coaching/review-regressions.test.ts`
- `packages/dialer-server/src/coaching/script-engine.ts`
- `packages/dialer-server/src/coaching/scripts.ts`
- `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/routes/coaching.ts`
- `packages/dialer-server/src/routes/mercury.ts`
- `packages/dialer-server/src/runtime/coaching.ts`
- `packages/dialer-server/src/runtime/railway.ts`

## workspace-owned: activity log

- 2026-11-13 20:48:52 fs.write: `.task/dialer/dev-1701-dev-1702-published-playbooks-and-script-runtime/workpad.md`
- 2026-11-13 20:50:01 write: `packages/dialer-server/src/coaching/playbooks-engine.test.ts`
- 2026-11-13 20:50:01 fs.write: `packages/dialer-server/src/coaching/playbooks-engine.test.ts`
- 2026-11-13 20:51:52 write: `packages/dialer-server/src/coaching/playbooks.ts`
- 2026-11-13 20:51:52 fs.write: `packages/dialer-server/src/coaching/playbooks.ts`
- 2026-11-13 20:51:53 write: `packages/dialer-server/src/coaching/script-engine.ts`
- 2026-11-13 20:51:53 fs.write: `packages/dialer-server/src/coaching/script-engine.ts`
- 2026-11-13 20:53:29 write: `packages/dialer-server/src/coaching/playbook-store.ts`
- 2026-11-13 20:53:29 fs.write: `packages/dialer-server/src/coaching/playbook-store.ts`
- 2026-11-13 20:53:30 write: `packages/dialer-server/src/coaching/cue-service.ts`
- 2026-11-13 20:53:30 fs.write: `packages/dialer-server/src/coaching/cue-service.ts`
- 2026-11-13 20:55:04 write: `packages/dialer-server/src/routes/mercury.ts`
- 2026-11-13 20:55:04 fs.write: `packages/dialer-server/src/routes/mercury.ts`
- 2026-11-13 20:58:56 write: `packages/dialer-server/src/runtime/coaching.ts`
- 2026-11-13 20:58:56 fs.write: `packages/dialer-server/src/runtime/coaching.ts`
- 2026-11-13 20:59:14 apply-patch: `packages/dialer-server/src/coaching/scripts.ts`
- 2026-11-13 20:59:14 apply-patch: `packages/dialer-server/src/routes/coaching.ts`
- 2026-11-13 20:59:14 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-11-13 20:59:14 apply-patch: `packages/dialer-server/src/database/migrations.ts`
- 2026-11-13 20:59:24 apply-patch: `packages/dialer-server/src/database/migrations.ts`
- 2026-11-13 21:04:32 write: `packages/dialer-server/src/coaching/playbooks.postgres.integration.test.ts`
- 2026-11-13 21:04:32 fs.write: `packages/dialer-server/src/coaching/playbooks.postgres.integration.test.ts`
- 2026-11-13 21:11:23 write: `packages/dialer-server/src/coaching/review-regressions.test.ts`
- 2026-11-13 21:11:23 fs.write: `packages/dialer-server/src/coaching/review-regressions.test.ts`
- 2026-11-13 21:13:29 write: `packages/dialer-server/src/coaching/cue-service.ts`
- 2026-11-13 21:13:29 fs.write: `packages/dialer-server/src/coaching/cue-service.ts`
- 2026-11-13 21:16:12 append: `packages/dialer-server/src/coaching/review-regressions.test.ts`
- 2026-11-13 21:16:12 fs.write: `packages/dialer-server/src/coaching/review-regressions.test.ts`
- 2026-11-13 21:18:49 append: `packages/dialer-server/src/coaching/playbooks-engine.test.ts`
- 2026-11-13 21:18:49 fs.write: `packages/dialer-server/src/coaching/playbooks-engine.test.ts`
- 2026-11-13 21:20:13 write: `packages/dialer-server/src/coaching/README.md`
- 2026-11-13 21:20:13 fs.write: `packages/dialer-server/src/coaching/README.md`
- 2026-11-13 21:25:57 fs.write: `.task/dialer/dev-1701-dev-1702-published-playbooks-and-script-runtime/workpad.md`
- 2026-11-13 21:26:59 fs.write: `.task/dialer/dev-1701-dev-1702-published-playbooks-and-script-runtime/workpad.md`
- 2026-11-13 21:33:12 fs.write: `.task/dialer/dev-1701-dev-1702-published-playbooks-and-script-runtime/workpad.md`

## workspace-owned: validation evidence

- 2026-11-13 21:21:10 `review.run`: passed — OK
- 2026-11-13 21:23:26 `review.run`: passed — OK
- 2026-11-13 21:26:48 `verify`: passed — OK
- 2026-11-13 21:32:27 `review.run`: passed — OK
- 2026-11-13 21:33:18 `verify`: passed — OK
- 2026-11-14 02:50:34 `review.run`: passed — OK
- 2026-11-14 02:52:09 `review.run`: passed — OK
- 2026-11-14 02:53:22 `review.run`: passed — OK
- 2026-11-14 02:54:03 `verify`: passed — OK

## Final checkpoint evidence and scope limits

Implemented compiler/publication/pin/Script runtime + real authenticated cue routes in src/coaching/**, routes/mercury.ts, runtime/coaching.ts; mounted via existing script factory. Migration021 additive registration/tests extends015; merged ONLY coreintegrationaee54 and exactSTT3eb76 as coordinator authorized. STTpackage/Docker/020 changes inherited, not replaced.

Red original missingplaybooks trc_414841f69213. Rootreview fivecases red trc_7d2eeb8b3b48→green trc_9580dd74e0b4: projectionepochcleanup, inactivepre-pin, renewalabort, selectoreligibility, continuousfinalno blanketabort/exactcursorreject. Deferredconcurrentopen/stalecontrolred trc_6634afa8a958→green trc_15f2ce2c0d8e. RealUI-equivalent no-rulespublication path redmanualinsteadofapproved trc_5cb169a499e3→green trc_426f0a32f620 (27asserts); defaults ONLY exactnormalizedapprovedsourceheadingphrase, previewedListenfor, noinventedsynonyms/industryfacts. Inferredlabelsfromclients ignored; ordinarysourceprovenance serverderived.

Proof: fullserver341pass/122existingopt-in-skips/0fail trc_4c2198a1777e; explicitcoachingPG+legacyupgrade30pass/157assertions trc_05d58a1ee7a4; latestcoaching29pass/142asserts+typecheck+compiledserverbuildgreen trc_5290bb20c91f. Existinglogger/contacts/dialer/leadconnector builds green. Real2049segmentcap producesunavailablecursor2048, noreset. Actualproduction composition readsrealrepositoryoutbox→trustednormalizers→sameScriptSession→Honoauthorizeddelivery. Defaultproductionmanual-referenceONLY; authorizedlivepolicyisfixture, no productiongrant/provider calls.

Strictreview initially24typederrorboundaryfindings, correctedwithtypedexceptionnormalization preservingdomainerrors; secondreviewzero issues. Formal verification rerun required after finalheadingdefault. Focusedroot/server/coredeps installedonlyownworktree withBunfilters/frozen/ignore-scripts; sharedprimarydepsuntouched. Neededrootdevdeps for existingpackagebuildtype definitions. No tests waived. PGtempinstancesclosedinfinally; binary/dist/localdepswillbecleanedafterpublication.

Frozenprotocol: open/read/controlreturnprojectionToken + publishedVersion; controlsrequirematchingtoken andserializewithreadmission. ClientabortedadmissionpassesRequest.signal. Off→reopennewgeneration/token preserves percallpublicationV1afteradminpublishesV2. Staledevicecontrol409. Failedrenewal aborts/disposes/release, no inactivePOSTpin. UIunknownPOSTresponse recovery remainsmanualblocked ratherthanadoptinganotherdevice'stoken.

NotDone / remainingacceptance: UIbrowserupload/preview/save/reload+liveapp.fetchclientroundtrip (owners1703/1704), registeredindustry/company/tenantoverride/glossary/richer ruleauthoring, durablemanualcard/pin/control-restorationacrossserverrecreation, harddeletion/retentionorchestration, durabletenantinferencebudget, evaluatedPi/OpenRoutertransport andslowcontextcadencequality/cost. Exactcursorfence can discardcompletedslowselector duringcontinuousfreshspeech; no silentrebase andnoacceptedPi-pathclaim. Inboundassignmentauthoritynotwired; explicitdenial/manualfallback. Productionlivegrant absent pending1707signedcapability/member/consentrevision+expiry+participant/per-streamorigin authority; oldpercalltranscriptionopt-in also required. No main/streammerge/deploy/carriercalls/modelspend/credentials.

- 2026-11-13 21:25:57 append: `.task/dialer/dev-1701-dev-1702-published-playbooks-and-script-runtime/workpad.md`

## Publish gates

FINAL strict review: zero findings after typed exception boundaries. Latest actual no-rules UI-equivalent PG/Hono path green27assertions trc_426f0a32f620. Latest focusedcoaching29tests142asserts + servertsc+compiledbuildgreen trc_5290bb20c91f (then sourceheading-only default provenPG). FormalFULLverify currenthash trc_dd9ca8af564a: passed/publishValid:true againstorigin/main; sixregistrysuitespassed including fullHono, nativebillingdisposablePG, prerequisites/CIcontracts; DBguard3risks0findings. No provider/modelnetworkcalls or credentials. Independentcoreproof inherited/preserved. PublishingtaskOnlytrue; rootownsretargetintegration99bcb4, exactheadCI/review/merge/release. DoNOTmark1701/1702Donefromthischeckpoint; remainingacceptance is README.

- 2026-11-13 21:26:59 append: `.task/dialer/dev-1701-dev-1702-published-playbooks-and-script-runtime/workpad.md`

## Actual UI adapter roundtrip correction

Root held archive after Terra independently reproduced real UIpreview→Hono400 (trc_a95dab30b748, owned coaching-replay/client-roundtrip.postgres.integration.test.ts). Our prior Hono fixture supplied a publication ordinal onpreview and therefore did NOT establish that cross-boundary contract. Corrected canonicalbackendpreview to accept savedexpectedRevision ONLY, authorize source, derivecurrentpublishedMAXordinal fromstorage, andreturn {preview,expectedPublishedVersion}; publish stillrequires exactordinal+approved and CASchecks savedrevision. No default0forhistory. OwningPGregression red trc_445ae458b214→green trc_aca7b4536e89: initialbarepreviewordinal0; missingpublishordinal400; existingV1 +savedrev2 barepreviewordinal1/version2→exactpublishV2; samecallpinV1 persists.29focusedtests148assertions+servertscgreen, strictreviewzero; freshformalverifybeforefollowupsameleafpush. No task.prre-invocation; rootalreadyretargetedleafintegration. Prior31d938is superseded oncefollowup published; Terra ownsindependentactualclientroundtrip verdict.

- 2026-11-13 21:33:12 append: `.task/dialer/dev-1701-dev-1702-published-playbooks-and-script-runtime/workpad.md`

## workspace-owned: files read

- `packages/os/manifests/generated/core.manifest.json`


## Confirmed lifecycle and authority review repairs (2026-11-14)

- Merged approved UI dependency 083969cbc07d7c96093a4a36c7a0189520a11545 into the existing engine task (merge a4faf17a1092569d3ce84e2e77520b17b37e97f5); preserved existing task metadata and integration ancestry.
- Startup connect/agent-ready failures now share idempotent End cleanup. Confirmed termination projects a terminal session; unknown provider outcomes preserve the active call, polling, End, and the no-overlap start fence. Retry cannot expose a new call while a nonterminal session remains.
- Cue-service only degrades transcript-source availability errors to delayed after renewing authority. Authorization/binding/lease loss propagates, aborts/disposes/releases the worker, and never returns the cached cue/token.
- Failed Off for an old known projection does not block an enabled independent call on 403/409. Same-call denial stays blocked; no token is borrowed from a read. Unknown admission remains fenced through empty disabled scopes and can be abandoned only for an enabled different caller.
- Wire parsers accept canonical 256-character points, 128-character slot IDs, and 512 cards. Bounded authoring responses allow 4 MiB for compiled source/excerpt expansion; live cue responses remain capped at 256 KiB.
- Red evidence: trc_75c7997cf12b (9 failures across first three defects); trc_7082524760fa (canonical/parser and large-preview failures); trc_6a4c76a6c51f (unknown A re-admitted after empty-scope disable).
- Green evidence before final unknown guard: trc_2d77717bdaa0 (281 pass, 2 optional PostgreSQL tests skipped); lead/server typechecks trc_4f0d59ad7be7 and trc_218bac6beb81. Strict review trc_e95d0c105563 had zero issues. Final gates are rerun after the unknown-admission guard.
- No live calls, paid inference, provider credentials, production deployment, or main mutation. DEV-1702/1703/1707 stay open pending full acceptance. Root owns final PR integration, CI and cleanup.
