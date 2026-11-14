# Mercury script-first integration and release candidate

branch: `task/dialer/mercury-script-first-integration-and-release-candidate`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2798
started: 2026-11-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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

## Orchestration / test-first contract

User explicitly authorized root orchestration and delegated workers November13. Start20:14UTC; prioritize useful Script-mode vertical slice within about2hours, at most2 coding/validation workers concurrently. Sol6.1xhigh owns creative/domain implementation; Terra6.1xhigh may own prescribed validation/review. Root owns dependency packets, PR/CI/review integration and safe worktree eviction. No nested workers.

Baseline main1d31f05fda9107b25d7439d4dd9577c85c159b24. Temporary integration branch task/dialer/mercury-script-first-integration-and-release-candidate is the stack below stream/dialer. Leaf PRs target this branch after publication; final integration review PR2798 targets main for a bounded new-work diff. Do not merge unrelated divergent stream backlog or mutate dirty primary. No production deploy/calls/model spend/credentials as a side effect of this PR-focused wave.

Behavior under test: compatibility and end-to-end Script vertical slice across shared core, real media normalization, approved playbook selection, UI controls, isolated replay and capability guards.
Existing patterns: DEV1645 fullbrief and1699–1707; sourceMain1d31; existing managed review/verify workflow.
Focused red/green: workers own their contracts and original failures. Root runs combined focused package/type/build/replay checks on the exact integrated tree before claiming readiness; meaningful defects routed back to the owning worker, mechanical findings grouped into current/next Linear task.
No-test waiver: root's orchestration-only metadata/PR/cleanup actions need no mirrored tests; source integrations need the combined verification above.

CI already has PR + manual dispatch, no Nx Cloud configured. Add new core coverage via owner; immutable-base exact-head Consuelo CI may be dispatched if bot API publication does not trigger. CI wait does not block next disjoint worker. Never mark a skipped classifier or historical green as complete new-source proof.

Cleanup: task.cleanup skips open PRs. Supported workspace eviction helper through OS code.call safely creates verified recovery bundles and preserves branch/PR. Prior owned QA sessiontsk_462eca660a7f evicted after matching remote head and confirming only workpad/task metadata dirty; recovery bundle retained. Current workers preserved until published source/evidence and no active processes are confirmed.

- 2026-11-13 20:25:58 append: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-13 20:25:58 fs.write: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`
- 2026-11-13 20:44:58 fs.write: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`
- 2026-11-13 21:12:27 fs.write: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`
- 2026-11-14 02:57:03 fs.write: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`
- 2026-11-14 03:08:25 fs.write: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`
- 2026-11-14 03:19:17 fs.write: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`

## Checkpoint 2026-11-13 20:45 UTC
Core DEV-1699 PR2796 passed exact44722b64 CI43502838029 (six jobs). Merged only into owned temporaryintegration at aee54abf2f477ae09f5181c9b504a8a61ea48e9d preserving ancestry. GitHub automatically deleted merged leafbranch; immutablecore is ancestorofpublishedintegration. Core worktree evicted with recovery /Users/kokayi/.consuelo/node/tasks/archives/tsk_a12690406bb4/2026-11-13T20-42-42-395Z-f1315181/recovery.bundle (metadata preserved). No main or productionmutation.
Activeworkers max3: live_transcription DEV1700 (tsk_72ac79981360), on_call_ui DEV1703 (tsk_9f2a8162c4a9), conversation_core nowfresh1701+1702 task. Coreoriginalsessionevicted do notrestore. STTnormalizationcore44722merged intoownedbranch, migration020reserved, sourceoutboxdependency passedtonewengineworker. UIcandidate219embedtests/typecheck/buildgreen; fixing prematurewrap-up+Endrecovery; actualContinuequeue andbothlegconfirmedtimestamp missing, nofakecontrols.
Rootconfirmedpreexisting productionrelease literal '+' shellseparator defect lines558/559/567/576; queuedmechanicalrepair in DEV1707 andfutureTerraworker. Diskfree11.34GiB at20:44UTC; avoidredundantfullinstalls. Primarydirtycheckoutuntouched. Next: publish/retargetSTT+UI, manualexactbranchCI if needed, mergeonlyownedintegration, archivefinishedworktrees, startTerraxhighreplay/release-regressionworker whenfree.

- 2026-11-13 20:44:58 append: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`

## workspace-owned: files read

- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/production-release-plan.test.ts`
- `packages/workspace/senior-engineer.md`

## Integration checkpoint 2026-11-13 21:14 UTC
STT PR2797 exact3eb76fdf0c6a3ef596255eb6f324dbf6f3dc8cdc passed6CIjobs(run43506279539), mergedONLYintegration withancestrypreserved. IntegrationHEAD99bcb4db9d6a4b115f6d8326c6ee07678577d307. STTworktreeevictedverifiedrecoverybundle /Users/kokayi/.consuelo/node/tasks/archives/tsk_72ac79981360/2026-11-13T21-01-40-556Z-d3b90428/recovery.bundle checksum84d677fd5c001b22b92343dfd56fb23592356a409f177c75a19da89bb3a078e5. Do notrestoreoldSTTsession. NewTerra6.1xhigh replay_release_validation ownsNEWservercoaching-replay/* andnarrow1707releaseworkflow+contract+railwaywatchrepair. Activeworkersremain3(coreengine,UI,Terra). UIinitialf22eeall6CIgreen;finalfeed+authoringfollowsamePR2799. EnginePR2800sessiontsk_39a6ade72e32 includesSTTdependency;actualPG/Honoruntime proof1scenario24assertsgreen. UIpublishbodyrevision/ordinal/approvedonly; serverderivestruthfultenant-authoredprovenance(noexternalindustrypackclaim).
Rootreviewrequestsenginefixbeforepublish: boundandprojectiongeneration-scope streammap+releaseonOff; auth/claimfailureabortstaleinflightwork; endedcallopenrejectbeforepin; closedselectorrechecksservereligibility; concurrentopensamelesseeoutoforderguard. Continuous2sfinal/3smodel exactcursorfreshnessgapmustremainexplicit(noautomaticrebaseoldmodelcursor). Sourcewindow~21:22forTerraactualengine+UIAPIroundtrip. Rootconfirmedproductionconsumerbuild/classification/watchomitsconversation;Terraaddedmeaningfulred/greenfix(7tests134asserts). FrameworkverifyfailureTTL30scanrelaunchcompletedfailure;sourcecontextualmigrationcatchfixedandauthenticstampacquired,wrapperbugtracked1668. No sourcepublicationbypass/mainmerge/deploy/calls/paidinference.

- 2026-11-13 21:12:27 append: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`

## Resumed coordinator checkpoint — 2026-11-14 02:57 UTC

The user said continue after the prior worker registry ended. Refreshed remote truth; main remains 1d31f05f. Integration remains 99bcb4db9d6a4b115f6d8326c6ee07678577d307, draft PR2798 to main.

Published sources:
- UI083969cbc07d7c96093a4a36c7a0189520a11545, PR2799, six CI jobs passed. Its historical standalone startup defect is fixed by the newer engine repair commit below; do not treat UI alone as final.
- Engine9498e37 fixed real preview400; repairs now published at e46bcd20b2cac0292899ca5167e5ba223965b0db, PR2800, includes UI ancestry. Strict review0, valid verify519e18e7a465, focused71/71 and combined281pass/2optionalPGskip. CI43548841408 running; independent reviewer checking only the repair delta.
- Replay/release7d31fb467446385a027df5330adc84c14a1e9d54, PR2801 retargeted integration; CI43548140016 passed. Focused25/269 includes actual UI API→Hono→isolatedPG through V1/V2 preview/publish, manual controls, fixture-authorized real outbox cue, stale-token/foreign denial. Full verify654bff30a9da valid. Source worktree safely evicted, recovery /Users/kokayi/.consuelo/node/tasks/archives/tsk_7f68042b099d/2026-11-14T02-50-41-000Z-6171c10c/recovery.bundle sha256 f9a816c9af97b90d8c722297e87a73db127d7a515bcc25f657fd8129f1a2c289. Do not restore that old task for more work.

Repairs address startup unknown/terminal cleanup, poll authorization propagation, old-call cleanup wedging the next caller, canonical parser limits, bounded large preview responses, empty-scope unknown admission retention, and late nonterminal snapshot fencing. Original red and green traces are in owning workpad/Linear. No production changes, calls or paid inference.

Quality gate remains OPEN: ordinary exact-heading rules hit1/60 positive synthetic cases and abstained12/12 negative cases; naive first-eligible mock is not an evaluated model. Real provider/audio quality, semantic selection, signed live grants, inbound binding, restart/long-call/manual state, durable inference budgets and analytics remain explicit follow-up. Root package.json/bun.lock changes cause existing release planner to select docs+website+OS as well (a65a239cec60); main merge must not be treated as a Dialer-only bookkeeping step. Keep final main candidate Draft until release scope/acceptance is decided.

Next: wait for exact e46 CI + bounded review; merge repaired engine PR2800 into owned integration (UI2799 may merge indirectly), then replay PR2801. Fast-forward only owned integration checkout. Run all four package tests/typechecks/builds plus explicit PG roundtrip and formal strict review/full verify. Publish exact combined tree, verify its CI, rewrite DEV1707 as the complete readable coordinator handoff, update parent and source states, archive finished engine/coordinator worktrees with verified recovery. Never merge the unrelated divergent stream/dialer backlog or alter the dirty primary checkout.

- 2026-11-14 02:57:03 append: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`

## Combined-tree verification — 2026-11-14 03:07 UTC

Repaired engine e46bcd20 passed all six CI jobs43548841408 and was merged into temporary integration as73f822aedaf3f59c9fa9a69dc61e12b901431d19. UI2799 merged indirectly by ancestry. Replay7d31fb passed CI43548140016. GitHub reports replay PR2801 conflicting even after refreshing its base to73f, but local git merge-tree succeeds (bac5a361b01e7e62d2d60eb3c3a42e6ee49f173b), and a normal --no-commit merge succeeds without conflict or source edits. Preserve both parents in a local integration merge; publish only after authentic current-head review/verify. The managed publisher only creates single-parent API commits and requires local/remote sync, so an already-verified normal merge push through OS code.call is necessary to preserve this history. No force push or source-gate bypass.

The exact combined working tree passed:
- Conversation47 tests/128 assertions; Dialer270/657; server363/2323 with123 expected opt-in skips; LeadConnector310/2342. Total990passed,0fail (trc_1af1606d17cf). Initial wrong core src filter selected no tests; corrected to the package's tests directory before recording results.
- All four package typechecks; logger/contacts/conversation/Dialer/LeadConnector/server builds; Node compiled inbound import smoke (trc_5075dacf3df6).
- Explicit CONSUELO_RUN_COACHING_POSTGRES=1 LC_ALL=C actual UI API→Hono→isolated PostgreSQL roundtrip1pass/19assertions on the combined fixed tree; owned PG stopped by finally (same trace5075dacf3df6).
- Independent bounded repair review found no remaining substantive defect in the five targets plus empty-scope unknown retention, with immutable diagnostics10ec3fb3c0a0/fa363144a633.

No production merge/deployment/calls/provider inference occurred. The source main candidate remains a Draft because automatic matching/authority and broader release acceptance are unfinished. Next: commit the clean two-parent merge with coordinator metadata; strict review/full verify against main; normal fast-forward push only this owned integration branch with current valid stamp; exact-head CI; final readable DEV1707 handoff and cleanup.

- 2026-11-14 03:08:25 append: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`

## workspace-owned: validation evidence

- 2026-11-14 03:09:02 `review.run`: passed — OK
- 2026-11-14 03:09:44 `verify`: passed — OK
- 2026-11-14 03:19:34 `review.run`: passed — OK
- 2026-11-14 03:20:21 `verify`: passed — OK

## Final CI timing-budget correction

Run43550338993 on67d90f8b passed five jobs but failed Dialer: the intentionally bounded 2,049-event capacity check took5,177.84ms on the shared runner, exceeding Bun's default5,000ms. All2,323 server assertions ran. This is not the latency acceptance benchmark. Preserved the original CI failure (trc_9aabb59caea0); gave only that full-reduction stress test an explicit20-second budget with all capacity/cursor/unavailable assertions unchanged. Focused test passed1/3assertions at1,438ms locally (trc_054199b5b465). No production code changed. Fresh strict review/full verification and exact new-head CI are required before recording a green candidate.

- 2026-11-14 03:19:17 append: `.task/dialer/mercury-script-first-integration-and-release-candidate/workpad.md`
