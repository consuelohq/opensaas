# Luna execution handoff

Coordinator: DEV-1688. Prerequisites: DEV-1689 service lab, DEV-1655 answering-device editor, DEV-1657 CRM team access. Use Luna extra-high for execution after the coordinator posts the exact merged/deployed release receipt in Linear. This file does not authorize a carrier call or a paid/invitation action.

## Order and ownership

1. Coordinator finishes prerequisite code, real database tests, strict review/full verify, main integration, backend/Worker deployment and signed-in readback. Do not run against an unshipped feature branch.
2. QA1 DEV-1690 (one browser owner), QA2 DEV-1691 (service lab owner), QA3 DEV-1692 (outbound component owner) can execute independently from that release. Each uses a separate managed task checkout and private evidence directory. They share stream/dialer, not a working directory. Preserve parallel changes; no resets, force pushes or speculative stream conflict resolution.
3. QA4 DEV-1693 can run its component checks in parallel but its final recovery/isolation assessment consumes QA2's successful service artifact. It must wait for that artifact rather than launch duplicate destructive tests against shared resources.
4. Return evidence to the larger-model coordinator. QA5 DEV-1694 stays supervised and requires the live-account ownership audit DEV-1695, current carrier/device preflight and a new exact one-shot approval. DEV-1656 browser ringtone/notifications remains a separate product boundary. Automated deployment credential repair remains DEV-1687.

## Start every lane

Read OS get_steering once, current Linear issue, this file and LAUNCH-QA.md. Start/recover a managed task in area dialer from main, retain taskSession on every scoped os.call. Read current remote ancestry/checks. Compare the package source against the exact coordinator-approved release: if any Dialer, Dialer server or LeadConnector source differs, stop for coordinator review. Task metadata-only bootstrap changes do not change the approved product tree.

All commands below run through OS code.call in that task root. No native repo tools. Capture subprocess exit, UTC start/end, approved source SHA/tree, seed when applicable, complete private stdout/stderr and a compact summary. Use owner-only files/directories. Use distinct run IDs; never overwrite a failed run with a green rerun. Do not copy environment variables, cookies, raw phone numbers, SIDs or auth tokens into a report.

## QA1: browser and administration (DEV-1690)

Run the non-carrier component cards:

    bun --no-env-file packages/dialer-server/scripts/launch-scenarios.ts run S17,S21,S22

Run focused UI/controller cases:

    bun --no-env-file test packages/lead-connector/src/embed/compact-workspace-polish.test.ts packages/lead-connector/src/embed/controller.test.ts packages/lead-connector/src/application.contract.test.ts

Use the single explicitly assigned QA Chrome profile. Read observed DOM references before each action. If the OS browser wrapper cannot attach due to SingletonLock, do not delete the lock or kill browsers. Coordinator may attach the agent-browser CLI to that owned session's actual loopback CDP port through OS code.call. Port values are discovery results, never assumed permanent. Reuse the same CDP connection across calls and allow initial app navigation to finish. Arc and unrelated profiles stay untouched.

Read-only Wet Stone walkthrough: open Consuelo Dialer; check saved Inbound/Outbound page; Settings → Phone numbers → Receive calls (masked destination, workspace/self source, Add/Edit/Remove controls, browser setup wording); Call from numbers (separate from personal forwarding); Team & seats (real staff names/roles, confirmed purchased quantity, real inbound team selector, clear Starter state, CRM invitation guidance, Stripe-only purchase CTA); Plan & billing; History. Back, close/reopen and refresh must preserve the intended navigation without claiming receiving or placing a call. Record actual page behavior and sanitized API/console failures. Do not submit a production phone/team change or a Stripe checkout.

Expected: no raw provider IDs needed, no false configured/verified state, no per-user plan selector, no invented staff/team, no lost active-call controls from a settings permission error. The real DB mutation/race tests are in QA2's artifact. A DOM test or read-only browser walkthrough does not certify browser media, notification delivery, real CRM invitations or 20 signed-in CRM users.

## QA2: service concurrency and capacity (DEV-1691)

Execute once with seed 20261106. After preserving and reviewing that run, execute seed 20261107 only if the first passed. Do not reroll failed seeds.

    bun --no-env-file packages/dialer-server/scripts/local-dialer-lab.ts --scale smoke --seed 20261106 --qa

This starts its own loopback PostgreSQL/Redis and bounded HTTP services; it does not use a production database or Twilio client. The script owns teardown. Do not add live URLs or secrets. A failed run exits nonzero and retains a private failure artifact; stop there.

Parse the complete JSON, do not pass merely because the shell exited. Expected oracle:

- root ok=true; qa.level=local-http-postgres;
- qa.stages rep counts exactly [1,2,5,20,20,20]; each authenticatedActors=connected=duplicateAcceptsRejected=reps and clean=true;
- concurrentIngress stages exactly [20 reps,25 callers,5 queued] and [20 reps,40 callers,20 queued]; all excess callers are checked against Postgres queue entries with no capacity owner;
- qa.databaseSuites exitCode=0, failed=0, skipped=0, passed>0, suites=12 (including real team access, migrations, devices, callbacks and signed billing projection cases);
- cleanup.postgresClosed, cleanup.redisClosed and cleanup.tempDirectoryRemoved all true;
- original full JSON retains seed, scheduleDigest, planned arrival times, actual completion order, synthetic provider journal, state replay and terminal effect proof.

The script's assertions also check one committed winner across competing tabs, foreign-owner rejection, confirmed synthetic participants, no duplicated external effects after service recreation, immutable replay and terminal cleanup. It separately exercises real Redis coordination through the existing outbound store benchmark. Inbound has no Redis-index dependency; do not label service recreation as a Redis-loss recovery test. Local timing is not PSTN latency or a production throughput guarantee. No 30-minute soak is certified by this bounded run.

## QA3: outbound and mixed-capacity regressions (DEV-1692)

    bun --no-env-file packages/dialer-server/scripts/launch-scenarios.ts run S01,S02,S03,S04,S05,S06,S10,S12,S18,S23

The CLI runs allowlisted component suites even for cards marked LIVE. It never calls a carrier. Report component pass separately from live-card status. Confirm recording/transcription remain explicit opt-in and fanout is entitlement-bounded; the shared capacity and caller-ID contention cases must pass. Use the QA2 artifact for the corresponding Postgres/shared-authority facts. Do not infer 20 mixed browser/PSTN reps from a component matrix or create contacts to fill a production queue.

## QA4: recovery, isolation and commercial projection (DEV-1693)

    bun --no-env-file packages/dialer-server/scripts/launch-scenarios.ts run S13,S14,S15,S16,S19,S20,S22,S24

Consume the exact same-source QA2 artifact, including all twelve enabled DB suites and process-death scenarios. Confirm unknown/dispatched effects retain capacity until independent reconciliation; revoked local access blocks new readiness/acceptance but permits away/history/wrap-up; competing admins cannot exceed purchased seats; stale CRM roles, foreign installation/member, stale paid generation and forged plan fields fail; duplicate/reversed events do not regress terminal state. Never kill production workers or disrupt production DB/Redis. Test-mode billing projections do not prove a real Stripe checkout, webhook delivery, payment recovery or external CRM-role changes end to end.

## Stop, evidence and Linear status

On first unexpected result: stop the dependent lane, preserve the original run and minimal sanitized request/state evidence, add expected versus observed plus exact source/run ID to the owning Linear issue, and return to the coordinator. No source edits, credential repair, blind Continue loops or retries intended to erase evidence. Read-only investigation may continue if independent.

After successful execution, add one concise issue comment listing completed cases, exact SHA/tree, test commands/counts, proof levels, artifacts, cleanup, uncovered requirements and the next issue. Mark Done only when that issue's acceptance criteria are actually evidenced. If a required browser/carrier/commercial/soak case remains unexecuted, leave the issue open/in progress and name the gap; do not substitute component PASS for it. Group related mechanical findings in existing issues where practical. Update DEV-1688 with the lane receipt and next dependency.

Final response must be a copyable coordinator handoff: issue, source SHA/tree, run IDs/artifacts, assertions passed/failed/skipped, cleanup proof, remaining gaps and next action. Luna does not merge, deploy, buy numbers, change paid plans, invite staff, activate receiving or initiate calls in these lanes.
