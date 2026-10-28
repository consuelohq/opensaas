# Worker 23B Domain Audit Report: Provider Control Plane

## Audit coordinates

- Authoritative GitHub review surface: [PR #1674](https://github.com/consuelohq/opensaas/pull/1674)
- PR base SHA: `702053057d19c066607d4508b49d42b183d17b32`
- Exact candidate SHA: `ef2530b136ec2a170915b583abfb2341899bd6ab`
- Review round: `1`
- Domain brief: `packages/os/plans/consuelo-os-foundation/workers/23b-provider-control-plane-audit.md`
- Reviewer task: `task/os-foundation-two/provider-control-plane-audit-round-1-independent-rerun`
- Reviewer task PR: [#1689](https://github.com/consuelohq/opensaas/pull/1689)
- Reviewer task session: `tsk_e6f2c0b05983`
- Continuation task: `task/os-foundation-two/consuelo-os-foundation-round-one-provider-control-plane-audit-rerun`
- Continuation task PR and session: [#1690](https://github.com/consuelohq/opensaas/pull/1690), `tsk_dcc3ac8872ba`
- Assigned audit stream: `stream/os-foundation-two`
- Review-only comparison PR: not required for this round; PR #1674 and its exact immutable head are the authorized surface
- Final domain status: `DOMAIN BLOCKED`

This report replaces the earlier Worker 23B closeout that stopped solely because synthetic audit coordinates were absent. The round-one kickoff explicitly makes that evidence obsolete and authorizes direct inspection of merged PR #1674 at the exact candidate SHA. The implementation was reviewed directly; no delegated reviewer or model wrapper was used.

## Scope and original-intent lineage

The authoritative product-intent corpus was the master plan plus Workers 08-12. Historical execution and delegated-review instructions inside those prompts were treated as superseded; their product requirements remained authoritative.

| Original prompt | Requirement or acceptance intent | Implementation / promotion lineage | Current implementation and evidence | Status and remediation |
| --- | --- | --- | --- | --- |
| `08-provider-core.md` | Provider-neutral Effect service with typed operations and errors | [#1582](https://github.com/consuelohq/opensaas/pull/1582), then [#1602](https://github.com/consuelohq/opensaas/pull/1602), [#1618](https://github.com/consuelohq/opensaas/pull/1618), [#1616](https://github.com/consuelohq/opensaas/pull/1616), candidate #1674 | `packages/os/tools/deployment-provider/types.ts`, `packages/os/tools/deployment-provider/errors.ts`, `packages/os/tools/deployment-provider/service.ts`, and `packages/os/tools/deployment-provider/facade.ts`; focused provider suite passed | Satisfied except approval provenance below |
| `08-provider-core.md` | Execute installed CLIs as argv, never through a shell; bound output, timeout, cancellation, and process-tree termination | Same | `packages/os/tools/deployment-provider/process.ts`, handler and provider tests; `shell:false`, bounded streams, timeout/cancel tests reviewed | Satisfied |
| `08-provider-core.md` | CLI-delegated auth, typed recovery, redacted diagnostics, no secret values in output | Same | `packages/os/tools/deployment-provider/service.ts`, `packages/os/tools/deployment-provider/redaction.ts`, facade recovery; live auth/context probe exposed current CLI classification drift | Partially satisfied; `23B-R01-004` |
| `08-provider-core.md` | Mutation approval must be explicit and auditable | Same | `packages/os/tools/deployment-provider/facade.ts:29-31,115-123`; `packages/os/tools/deployment-provider/service.ts:106-107,263-271`; adversarial trace | Not satisfied; `23B-R01-001` |
| `08-provider-core.md` | Environment values must not appear in argv or durable output | Same | Railway `--set-from-stdin`, Vercel env stdin, Cloudflare runner stdin; secret/redaction tests passed | Satisfied |
| `09-railway-provider.md` | Remove Consuelo-specific defaults and private-token extraction; use generic linked context | [#1589](https://github.com/consuelohq/opensaas/pull/1589) through #1602/#1618/#1616/#1674 | `packages/os/tools/railway/adapter.ts`, `packages/os/tools/railway/service.ts`, and `packages/os/tools/railway/cli.ts`; no hard-coded Consuelo defaults found | Satisfied |
| `09-railway-provider.md` | Generic projects, services, deployments, status, logs, redeploy, and environment operations | Same | Railway adapter and handler tests: 31 passing; public facade integration reviewed | Satisfied except wait bound and live error mapping |
| `09-railway-provider.md` | Optional redeploy wait must be bounded and cancellation-safe | Same | `packages/os/tools/railway/service.ts:110-185`; deterministic deadline probe | Not satisfied; `23B-R01-003` |
| `09-railway-provider.md` | Unlinked context must return clear typed recovery | Same | Railway 4.23.1 read-only probe returned generic `COMMAND_FAILED` while unlinked | Not satisfied; `23B-R01-004` |
| `10-vercel-provider.md` | Installed CLI authority; auth, linked project/team context, explicit linking, deployments, status, logs | [#1590](https://github.com/consuelohq/opensaas/pull/1590) through #1602/#1618/#1616/#1674 | `packages/os/tools/deployment-provider/vercel.ts`; 18 focused tests passed; Vercel 50.1.3 detected | Satisfied except current auth/context failure mapping |
| `10-vercel-provider.md` | Distinguish preview and production consequences; require approval for mutations | Same | Operation policy and mutation tests reviewed | Policy metadata exists, but trusted approval provenance is absent; `23B-R01-001` |
| `10-vercel-provider.md` | Environment names may be read; values remain secret; raw output is bounded and redacted | Same | Stdin environment writes and redaction tests reviewed | Satisfied |
| `11-cloudflare-provider.md` | Customer Wrangler adapter for typed Worker/Pages/status/log/deploy/environment operations, including an approved and redacted raw escape hatch | [#1591](https://github.com/consuelohq/opensaas/pull/1591) through #1602/#1618/#1616/#1674 | `packages/os/tools/deployment-provider/cloudflare.ts`, `packages/os/tools/deployment-provider/cloudflare-runner.ts`; 14 focused tests passed; supported Wrangler 4.74.0 read-only detect/auth/context succeeded | Satisfied by reviewed evidence |
| `11-cloudflare-provider.md` | Structurally exclude Consuelo release, WAF migration, route-registry administration, tunnel/DNS/connector provisioning, account identity, and production-credential authority | Same | Customer and operator files are separated in runtime roles. The cited customer-context `wrangler d1 list` probe did not reach any prohibited Consuelo operator capability. | Satisfied by reviewed evidence; original `23B-R01-002` disposition corrected to stale |
| `12-provider-integration.md` | Publish one coherent public `deployment.*` surface with read/write and approval metadata; remove legacy provider tool names | [#1602](https://github.com/consuelohq/opensaas/pull/1602), #1618, #1616, #1674 | `deployment.detect/context/list/status/logs/deploy/environment/raw`; cutover and discovery tests passed | Satisfied except approval trust |
| `12-provider-integration.md` | Generated manifest/client/search closure; customer providers in runtime; operator Cloudflare modules excluded | Same | Manifest check, discovery tests, runtime fingerprint and verified archive passed | Satisfied |

No later narrow product repair PR was found between the provider integration wave and candidate #1674; later relevant changes were promotion/audit and distribution-conflict records.

## High-signal findings

Open counts: `P0 0 / P1 1 / P2 2 / P3 0`.

| Finding | Priority / severity | Category | Precise location | Concrete risk | GitHub thread | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `23B-R01-001` Caller-controlled approval metadata authorizes provider mutations | P1 / high | Auth | `packages/os/tools/deployment-provider/facade.ts:29-31,115-123`; `packages/os/tools/deployment-provider/service.ts:106-107,263-271` | An untrusted agent or MCP caller can self-assert approval and execute provider writes | [Finding](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098974553) | Open; blocks domain |
| `23B-R01-002` Cloudflare customer raw mode bypasses the operator boundary | P1 / high | Intent alignment | `packages/os/tools/deployment-provider/cloudflare.ts:29-38,278-283,467-473` | The cited `d1 list` probe remained inside the user's Wrangler context and did not demonstrate access to prohibited Consuelo operator authority | [Finding](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098976403) | Stale; does not block domain |
| `23B-R01-003` Railway redeploy wait does not enforce one overall deadline | P2 / medium | Reliability | `packages/os/tools/railway/service.ts:110-185` | A 1-second declared wait can permit multiple 1-second subprocess budgets before returning timeout | [Finding](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098978134) | Open; blocks absent Ko waiver |
| `23B-R01-004` Supported CLI failure wording falls through to generic errors | P2 / medium | Correctness | `packages/os/tools/deployment-provider/service.ts:63-74`; Railway `packages/os/tools/railway/adapter.ts:383-402`; Vercel `packages/os/tools/deployment-provider/vercel.ts:595-614` | Normal unauthenticated/unlinked states lose typed login/link recovery | [Finding](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098979126) | Open; blocks absent Ko waiver |

### Root-cause evidence

`23B-R01-001`: `packages/os/tools/deployment-provider/facade.ts` receives `approved?: boolean`, copies it into approval metadata, and `packages/os/tools/deployment-provider/service.ts` checks only `=== true`. Sanitized deterministic trace `trc_4a5b34246d14` executed a raw mutation argv after the caller supplied that boolean. The fix must establish trusted approval provenance, binding, expiry, and replay protection rather than adding another payload flag.

`23B-R01-002` corrected disposition: Worker 11 explicitly requires an approved and redacted raw escape hatch using the customer's installed Wrangler context. The cited `wrangler d1 list` probe did not reach Consuelo release publication, WAF migration, route-registry administration, DNS/connector provisioning, tunnel-token creation, Consuelo account identity, or production credentials. The evidence therefore did not establish the claimed operator-boundary breach. This finding is stale and should be reopened only with a reproducible crossing into prohibited Consuelo-owned authority. The original round-one structured review remains historical evidence; this report supersedes its current disposition for finding 002.

`23B-R01-003`: Railway creates one deadline but gives the original full timeout to every list/poll subprocess and checks the deadline only afterward. Trace `trc_4a5b34246d14` requested 1,000 ms, issued three 1,000 ms subprocess budgets, reached simulated elapsed 3,000 ms, then returned `TIMEOUT`.

`23B-R01-004`: the shared classifier recognizes a small literal phrase set. Safe supported-version probes returned generic `COMMAND_FAILED` for Railway unlinked context and Vercel unauthenticated auth/context (`trc_56a3f518a5e6`); sanitized CLI classification `trc_24b9844553ba` confirmed those are normal recoverable states. Existing fixtures use older phrases that still match, so tests did not detect the drift.

## Required GitHub review outputs

- Finding threads: [001](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098974553), [002](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098976403), [003](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098978134), [004](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098979126)
- Structured review object: [GitHub record](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098987237)
- Top-level review summary: [GitHub record](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098988138)
- Consolidated agent-fix prompt: [GitHub record](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098989607)
- Current finding-disposition index: `23B-R01-001` open, `23B-R01-002` stale, `23B-R01-003` open, `23B-R01-004` open; same-reviewer verification is required for the open findings on the next immutable candidate.
- Evidence limits, recovery record, and final status: [GitHub record](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098990624)

Because the provider product files are outside PR #1674's retained audit-packet diff, GitHub could not attach new comments to their current product lines. Each finding was therefore posted top-level with the exact file, line range, symbol, and inline-placement explanation.

## Evidence executed

### Primary audit and continuation evidence

PR #1689 / session `tsk_e6f2c0b05983` produced the direct audit, structured review, GitHub findings, intent inspection, and primary traces. PR #1690 / session `tsk_dcc3ac8872ba` then revalidated a focused subset of the exact frozen provider surface without changing product code:

- Focused provider tests passed from `packages/os`: `bun run test -- tools/deployment-provider/handler.test.ts tools/deployment-provider/facade.test.ts tools/deployment-provider/cloudflare.test.ts tools/railway/handler.test.ts`; trace `trc_06c67eada6c9`; 4 files and 78 tests passed.
- Caller-controlled approval probe: `executeDeploymentFacade` accepted `approved: true`, returned a successful fake deployment result, and issued `deploy --target customer-production --json`; trace `trc_8a520b58dd3c`.
- Cloudflare raw-escape-hatch probe: `cloudflareDeploymentProviderAdapter.operations.raw.command({ args: ['d1', 'list'] })` accepted the customer-context command and issued `d1 list` unchanged with supplied approval; trace `trc_8a520b58dd3c`. This confirmed the required raw capability but did not demonstrate a crossing into prohibited Consuelo operator authority.
- The first direct probe failed before provider imports because the temporary Bun program resolved relative imports from `/tmp`; trace `trc_26ae609902df`. It was retried once with absolute task-worktree imports and succeeded. This is tooling recovery, not product evidence.
- Strict task review passed with zero task-owned or blocking findings; trace `trc_847998a51c70`. It retained 23 unrelated Twenty SDK baseline findings and the known missing shared ESLint-rules modules.
- Full verify trace `trc_c0b4461a0639` passed the database guard and selected `@consuelo/os` package test, but was not publish-valid because the baseline API `subscription`, `local-presence`, and `ghl` suites failed (53 failed / 205 passed tests). No task-owned or provider-related failure was reported.
- Foundation plan/report validator passed with zero structural or forbidden-match failures; trace `trc_62e79c166e74`.
- A bounded `verify --base HEAD` retry produced the same baseline result; trace `trc_3caeeab42a89`. The database guard and selected OS package test passed, while the 3 unrelated API suites and 23 pre-existing lint/typecheck findings prevented a publish-valid stamp.

| Inspection or validation | Exact command, trace, or GitHub evidence | Result | Candidate applicability |
| --- | --- | --- | --- |
| Candidate identity and review surface | PR #1674 full view/checks/files; base `702053...`, head `ef2530...` | Immutable merged candidate confirmed | Exact candidate |
| Candidate-to-task provider parity | OS `git.diff` from `ef2530...` through provider tools, executor, manifests, generated clients, runtime bundle, and focused tests | Zero changed product files | Local evidence is byte-identical to candidate provider surface |
| Full provider-domain focused suite | `bun run test --` nine provider/core/cutover/manifest/discovery/runtime files; trace `trc_35101f7831ce` | 9 files, 138 tests passed | Exact candidate surface |
| Public facade provider slice | `bun run test -- tests/facade/facade.test.ts -t 'deployment&#124;provider'`; trace `trc_bda8f25ab382` | 13 passed, 654 skipped | Exact candidate surface |
| Syntax/type gate | `bun run typecheck`; trace `trc_66b1838d0db1` | Passed (`workspace script syntax checks passed`) | Exact candidate surface |
| Foundation plan/report validator | `bun workers/validate-plan.ts`; trace `trc_de3a876a1ed1` | Passed with zero structural failures and zero forbidden matches | Review record |
| Structured review integrity validator | JavaScript assertions; trace `trc_9d6eb3dd0616` | Parsed JSON and verified PR, candidate, round, four finding IDs, status, and required summary signoff | Review record |
| Generated manifest drift | `bun run generate-tool-manifest:check`; trace `trc_cf10f8332809` | Current | Exact candidate surface |
| Runtime closure fingerprint and archive | fingerprint/build/verify; trace `trc_cf10f8332809` | Valid; fingerprint `sha256:0efc500afdcb12921e5ad80627a8b6a0ca088a1e78493cd3e54421a398523830`; 401 files; operator-only 49 excluded | Archive built with candidate source commit |
| Approval, Cloudflare raw, and Railway deadline adversarial journeys | Sanitized deterministic script; trace `trc_4a5b34246d14` | Reproduced findings 001 and 003 without external mutation; the Cloudflare raw probe did not establish finding 002 | Exact candidate surface |
| Supported installed CLI versions | Read-only `--version` and service detect | Railway 4.23.1, Vercel 50.1.3, Wrangler 4.74.0; all within declared ranges | Registered review lane |
| Safe provider read-only probe | trace `trc_56a3f518a5e6` | Railway detect/auth succeeded but unlinked context was generic failure; Vercel detect succeeded but unauthenticated auth/context were generic failures; Cloudflare detect/auth/context succeeded | No provider mutation |
| Sanitized current CLI-state classification | trace `trc_24b9844553ba` | Confirmed recoverable auth/context states without retaining identities or raw sensitive payloads | No provider mutation |
| PR #1674 CI | [Checks on PR #1674](https://github.com/consuelohq/opensaas/pull/1674/checks) | Product-review lanes passed; Cloudflare Workers build failed and `congratulate` was cancelled | Corroborative, not proof |
| Broad facade suite | Full `tests/facade/facade.test.ts` run | 763 passed, 42 failed in media/subagent/code-call paths; provider assertions passed | Unrelated degradation recorded; did not block domain judgment |
| Task-owned review gate | `review.run --base origin/stream/os-foundation-two --strict --no-tests`; trace `trc_86e0a87e7c8b` | Zero task-owned issues, zero blocking issues; 23 pre-existing Twenty SDK lint/typecheck findings | Review record clean |
| Full repository safety gate | `verify --base origin/stream/os-foundation-two --no-stamp`; trace `trc_83f6dbb080a0` | Database gate passed; repository gate failed on three unrelated API suites plus pre-existing/missing Twenty lint-rule modules; zero task-owned or related findings | Not a Worker 23B report blocker |

## Existing automated and human review dispositions

| Source | Existing claim | Independent disposition | Evidence / durable reply |
| --- | --- | --- | --- |
| Earlier Worker 23B report | `DOMAIN BLOCKED` solely because synthetic audit coordinates were absent | Obsolete process evidence; replaced by this implementation review | Round-one kickoff and exact PR #1674 candidate |
| CodeRabbit | Persist OS execution trace in the domain report | `fixed` for this replacement review | [Disposition reply](https://github.com/consuelohq/opensaas/pull/1674#discussion_r3662186377); task session and sanitized traces recorded here |
| CodeRabbit | Framework non-delegation conflicted with historical delegated review lane | `stale` | [Disposition reply](https://github.com/consuelohq/opensaas/pull/1674#discussion_r3662186484); kickoff required direct review and no delegation occurred |
| CodeRabbit / human | Freeze actual cross-stream candidate | Previously fixed in the stream packet; candidate independently reverified | [Original thread](https://github.com/consuelohq/opensaas/pull/1674#discussion_r3659970588) |
| CodeRabbit / human | Advance audit head after repairs | Previously fixed in the stream packet; exact candidate independently reverified | [Original thread](https://github.com/consuelohq/opensaas/pull/1674#discussion_r3660067929) |
| Qodo / generic automated approvals | No bugs or no additional findings | Not accepted as proof | Findings 001, 003, and 004 were independently reproduced; finding 002 was later corrected as stale after rechecking Worker 11 intent |
| Codex on PR #1691 | `d1 list` did not prove a Consuelo operator-boundary breach because Worker 11 requires a customer raw escape hatch | `fixed`; accepted | Worker 11 intent and the cited probe were rechecked; finding 002 is stale and non-blocking |
| Existing provider-product threads | No open thread matching the three sustained root causes was found | No duplicate finding suppressed | Targeted PR comment/review searches by provider, approval, timeout, recovery, and Worker 23B terminology |

## Unavailable evidence and safety boundaries

| Item | Reason | Effect on judgment | Next evidence after repair |
| --- | --- | --- | --- |
| Live provider mutations | Review lane prohibits manufacturing external writes; no authorized production checkpoint | Deterministic candidate-path probes were sufficient to prove findings 001 and 003; mutation success behavior remains to be revalidated after repair | Narrow test accounts or Ko-approved fixtures, with exact commands and redacted results |
| Authenticated linked Railway project reads | Registered checkout was unlinked | Exposed finding 004; did not prevent architecture or failure-path judgment | Link a nonproduction fixture project at an explicit human checkpoint, then run context/list/status/log reads |
| Authenticated Vercel reads | CLI was unauthenticated | Exposed finding 004; did not prevent code or deterministic test review | Authenticate a nonproduction fixture at an explicit checkpoint, then run bounded read-only operations |
| Clean broad facade suite | 42 unrelated media/subagent/code-call failures | Provider-specific slice remained green; not a provider blocker | Owning domains repair baseline and rerun broad suite |
| Clean full repository verify | Three unrelated API suites failed (`subscription`, `local-presence`, `ghl`), and the Twenty lint/typecheck baseline contains 23 pre-existing findings plus missing shared ESLint-rule modules | The task-owned review reported zero issues and the database gate passed; this does not change the provider-domain judgment | Owning repository/API lanes restore the shared baseline, then rerun the full gate on the next immutable candidate |
| Cloudflare Workers deployment build | PR check failed outside the provider adapter test lane | Recorded but not attributed to customer provider implementation | Owning deployment lane diagnoses the failed check |
| Synthetic audit branches / review-only PR | Absent by design/process debt for this round | No effect; exact code and review surface were recoverable | Worker 23 may create them in later rounds without changing this finding disposition |

No Consuelo OS install, update, reset, restart, repair, rollback, or uninstall was performed on Ko's Mac Mini or MacBook Air. No external provider resource was mutated. One local diagnostic probe initially emitted inherited environment metadata into ephemeral tool output; no secret value, full environment, identity, or sensitive provider payload was copied into this report, GitHub, or review records.

## Tooling recovery record

Recoverable OS/GitHub errors included pre-task task selection, a literal unexpanded steering path, incorrect Bun invocation forms, archive verification without `--archive`, temporary-script relative imports from `/tmp`, an initially mis-shaped facade resolver option, GitHub PR-search syntax and unsupported output fields, and a relative `--body-file` path resolved from the repository root. Each failure was inspected and retried once through an approved OS-supported route; none prevented domain judgment.

## Proposed deterministic Worker 23 ledger rows

Worker 23 remains the sole writer of the shared finding ledger. Proposed rows:

- Authoritative domain: `23B` for all four findings.
- Secondary seam reviewers: `23D` for `23B-R01-001`; none required for the stale `23B-R01-002` or for `23B-R01-003` and `23B-R01-004`.

| Finding ID | Authoritative domain | Secondary seam reviewer | Candidate | Priority | Category | Status | Repair ownership / validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `23B-R01-001` | 23B | 23D | `ef2530...` | P1 | auth | open | Narrow trusted-approval provenance repair; verify tamper/replay/expiry/cross-tenant behavior and reply in original thread |
| `23B-R01-002` | 23B | none | `ef2530...` | P1 | intent_alignment | stale | No repair required on current evidence; reopen only with reproducible access to prohibited Consuelo-owned operator authority |
| `23B-R01-003` | 23B | none | `ef2530...` | P2 | reliability | open | Enforce one remaining-time Railway deadline; deterministic wall-clock and abort validation |
| `23B-R01-004` | 23B | none | `ef2530...` | P2 | correctness | open | Current supported CLI error-contract repair; fixture plus safe read-only live validation |

## Required repair and re-review sequence

1. Create narrow repair tasks for open findings 001, 003, and 004; do not combine unrelated provider features. Finding 002 requires no repair unless new evidence proves a prohibited Consuelo operator-boundary crossing.
2. Preserve the verified argv, redaction, stdin secret, provider-neutral, manifest, and runtime-separation contracts.
3. Publish the next exact immutable candidate and repair PR lineage.
4. Return to this same assigned reviewer for round-two inspection.
5. Rerun affected adversarial, focused, manifest, runtime archive, and safe read-only provider evidence.
6. Update each original GitHub finding with `fixed`, `stale`, `needs_verification`, or `waived_by_ko`, naming the repair PR, exact candidate SHA, and evidence.

## Domain conclusion

`DOMAIN BLOCKED`

The provider core, adapters, public tool integration, generated manifests, and runtime closure are materially implemented and substantially tested. The domain is not launchable because the public mutation gate trusts caller-minted approval. The Railway timeout and current CLI error-contract failures add two concrete P2 defects. The earlier Cloudflare raw finding is stale because its evidence exercised the required customer raw escape hatch without reaching prohibited Consuelo operator authority. No Ko-controlled checkpoint is needed to establish the three remaining findings; repairs and a new immutable candidate are required before the same reviewer can clear the domain.
