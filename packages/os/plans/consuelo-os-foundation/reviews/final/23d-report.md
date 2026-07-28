# Worker 23d Domain Audit Report: Native Platforms and Local Control

## Audit coordinates

- Review target: [PR #1674](https://github.com/consuelohq/opensaas/pull/1674), `Stream/os-foundation-two`
- Candidate SHA: `ef2530b136ec2a170915b583abfb2341899bd6ab`
- Baseline: `main`; the workspace GitHub facade exposed the base branch but not its SHA
- Review-only PR: none; the Worker 23d brief authorizes the completed foundation-wave PR as the immutable fallback candidate
- Domain brief: `packages/os/plans/consuelo-os-foundation/workers/23d-native-platform-local-control-audit.md`
- Reviewer task/session: `task/os-foundation-two/23d-native-platform-local-control-audit`, `tsk_912e9fd38d30`
- Review round: `R1 initial domain audit`
- Final domain status: `DOMAIN BLOCKED`

## Original-intent lineage

| Original worker prompt | Exact requirement/section | Authoritative domain | Secondary seam reviewers | Implementation and repair PRs | Current implementation location | Automated evidence | Runtime/live evidence | Status | Remediation |
| ---------------------- | ------------------------- | -------------------- | ------------------------ | ----------------------------- | ------------------------------- | ------------------ | --------------------- | ------ | ----------- |
| Native platform and local-control audit | architecture spike; native daemon lifecycle; local IPC and redaction | `packages/os` native platform scripts and runtimes | macOS UX/IPC, Linux systemd/XDG/archive, Windows SCM/PowerShell/path/ACL, browser integration, packaging/signing/mode, parity | PR #1674; no separate review-only PR | `packages/os/scripts/lib`, `packages/os/native`, `packages/os/tests` | Candidate source and test coverage inspected at the exact SHA | No native runner or live packaging matrix was available | `DOMAIN BLOCKED` | Resolve all four P1 findings, then rerun platform-specific and cross-epoch tests on each supported OS |

## Candidate identity and lineage

The candidate is reviewable and immutable at `ef2530b136ec2a170915b583abfb2341899bd6ab`. PR #1674 is merged into `main` and contains the native, distribution, provider, and web implementation streams used by this foundation wave. The facade did not expose the merge-base SHA, so this report records the authoritative candidate SHA and base branch rather than inventing a baseline hash. No audit reference or dedicated review-only PR was required by the current Worker 23d fallback rule.

## Required GitHub review outputs

- Consolidated review comment: [comment 5098990624](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098990624)
- Structured review object: included in the consolidated comment as the `review` object with `status: DOMAIN_BLOCKED`, four P1 blockers, one P2 follow-up, and no accepted waiver
- Top-level review summary: included in the same comment; the domain is blocked by redaction, Linux lifecycle, Windows ACL, and Windows rollback defects
- Consolidated agent-fix prompt: included in the same comment; it directs the implementation agent to fix the four P1 findings first, add focused regressions, and rerun the platform matrix
- Current finding-disposition index: `23D-R01-001` through `23D-R01-004` are `open/blocker`; `23D-R01-005` is `open/follow-up`
- Inline anchors: no reliable line anchors were available from the merged candidate diff through the workspace facade, so evidence and dispositions were posted in one top-level consolidated comment

## High-signal code-review findings

| Finding ID | Priority / severity | Category | Location | Risk | GitHub thread | Disposition |
| ---------- | ------------------ | -------- | -------- | ---- | ------------- | ----------- |
| `23D-R01-001` | P1 security blocker | Cross-platform redaction | `packages/os/scripts/lib/native-lifecycle-endpoint.ts:97-101,314-325`; `packages/os/scripts/lib/lifecycle/diagnostics.ts:11-27`; `packages/os/native/macos/Sources/ConsueloMacCore/Safety.swift:115-125`; `packages/os/native/windows-service/Program.cs:167-174,244-253` | Linux `/home/...` and Windows `C:\Users\...` paths are not covered by managed/native redactors, while Windows child output is persisted raw. Secrets and operator home paths can enter logs or error responses. | [comment 5098990624](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098990624) | Open blocker. Introduce one cross-platform value-level redactor before UI, error, and log boundaries; add Linux/Windows path, raw child-output, nested-string, and secret-form regressions. |
| `23D-R01-002` | P1 reliability/security blocker | Linux fallback lifecycle | `packages/os/scripts/lib/platforms/linux.ts:206-213,260-296,375-385` | Fallback state stores only a PID, trusts any live PID, removes state without confirming exit, and does not wait or escalate after SIGTERM. PID reuse or a stuck process can signal an unrelated process or run overlapping runtimes. | [comment 5098990624](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098990624) | Open blocker. Persist and verify process identity, use bounded wait/escalation, remove state only after confirmed exit, and add PID-reuse/stuck-process tests. |
| `23D-R01-003` | P1 security blocker | Windows service ACL | `packages/os/scripts/lib/windows-platform.ts:588-604`; `packages/os/tests/windows-platform.test.ts:158-245` | The service receives modify access on the entire Consuelo home and descendants. That home contains configuration, keys/tokens, database/runtime metadata, and logs, violating least privilege and secret protection. | [comment 5098990624](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098990624) | Open blocker. Grant runtime read/execute only, scope writes to dedicated runtime/log/state directories, protect keys/config/database owner-only, and assert the service has no home-wide modify access. |
| `23D-R01-004` | P1 reliability/security blocker | Windows installation rollback | `packages/os/scripts/lib/windows-platform.ts:491-630`; catch at `631-636`; `packages/os/tests/windows-platform.test.ts:312-373` | Installation mutates directories, service registration, auto-start/failure policy, ACLs, and inherited permissions, but the catch path only adds context. Partial failure can leave an auto-start service, orphaned config, or unsafe permissions. | [comment 5098990624](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098990624) | Open blocker. Add a mutation journal/transactional rollback for service, ACL, config, and directories; preserve pre-existing state; inject failures after every mutation. |
| `23D-R01-005` | P2 reliability follow-up | Cross-epoch snapshot ordering | `packages/os/scripts/lib/native-lifecycle-client.ts:192-214`; `packages/os/native/macos/Sources/ConsueloMacCore/LifecycleClient.swift:39-45`; `packages/os/native/macos/Sources/ConsueloMacCore/UnixSocketLifecycleTransport.swift:79-88`; `packages/os/tests/native-lifecycle-client.test.ts:219-249` | A daemon restart with a new instance but a lower wall-clock timestamp can be rejected after clock rollback, leaving stale or offline state. | [comment 5098990624](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098990624) | Open follow-up. Use persisted boot/generation identity or an explicit handshake independent of wall-clock time, and test lower-sequence/older-timestamp restarts. |

## Evidence executed

| Test, CI lane, runtime journey, or inspection | Exact command or GitHub link | Environment | Result | Applies to candidate SHA |
| --------------------------------------------- | ---------------------------- | ----------- | ------ | ------------------------ |
| Candidate PR identity and changed-file inspection | [PR #1674](https://github.com/consuelohq/opensaas/pull/1674) | Workspace GitHub facade | Candidate SHA and native implementation surface recovered; PR is merged | Yes |
| Candidate source inspection | Workspace-scoped `code.call`/git inspection of candidate tree at `ef2530b136ec2a170915b583abfb2341899bd6ab` | Task worktree | Confirmed five findings and exact source locations listed above | Yes |
| Linux lifecycle test coverage inspection | `packages/os/tests/linux-platform.test.ts` | Candidate source tree | Basic PID fallback/status/uninstall covered; identity, PID reuse, stuck process, bounded wait, and escalation are not | Yes |
| Windows platform test coverage inspection | `packages/os/tests/windows-platform.test.ts` | Candidate source tree | Broad home ACL is encoded and startup diagnostics are inspected; least privilege and rollback cleanup are not proved | Yes |
| Native lifecycle client test coverage inspection | `packages/os/tests/native-lifecycle-client.test.ts:219-249` | Candidate source tree | Later-timestamp restart is covered; clock rollback across a new instance is not | Yes |
| Endpoint redaction test coverage inspection | Native lifecycle endpoint tests | Candidate source tree | macOS path/secret coverage exists; Linux and Windows path/raw-child-output coverage is absent | Yes |
| Native runtime and packaging matrix | No live macOS, Linux, or Windows runner was available | Review environment | Not executed; no live claim is made | No |

## Existing review dispositions

| Source | Finding or thread | Current status | Verification evidence | GitHub disposition |
| ------ | ----------------- | -------------- | --------------------- | ------------------ |
| Prior PR review history | Process/coordination comments and a report-template table-shape comment | No matching native implementation defect disposition found | PR review/comment history inspected; these do not close the five findings | Superseded for this domain by the consolidated Worker 23d review comment |
| Worker 23d R1 | `23D-R01-001` to `23D-R01-005` | Open; four blockers and one follow-up | Source/test evidence in this report | [comment 5098990624](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098990624) |

## Unavailable evidence and assumptions

| Item | Reason | Risk | Launch effect | Exact next action | GitHub record |
| ---- | ------ | ---- | ------------- | ----------------- | ------------- |
| Base SHA | GitHub facade returned base branch `main` but not the merge-base SHA | Exact diff baseline cannot be reproduced from the report alone | Does not block review because candidate identity and implementation surface are recoverable | Record the merge-base SHA if a later review reruns with a facade/API that exposes it | [PR #1674](https://github.com/consuelohq/opensaas/pull/1674) |
| Native platform runners | No live macOS/Linux/Windows or packaging/signing environment was available | Runtime, service-manager, ACL, signing, and archive behavior remain unverified | No runtime/platform acceptance claim; source blockers independently block launch | After fixes, run supported-OS lifecycle, IPC, redaction, ACL, rollback, packaging, and browser-integration journeys | [comment 5098990624](https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098990624) |
| Dedicated review-only PR/audit refs | None existed for this completed wave | Review lineage is less isolated than preferred | Allowed by the current Worker 23d candidate-fallback rule | Preserve exact candidate SHA and report repair PRs in the next round | [PR #1674](https://github.com/consuelohq/opensaas/pull/1674) |

## Domain conclusion

**DOMAIN BLOCKED**

The candidate is reviewable, but it is not launch-ready for native platform and local-control acceptance. Four independent P1 findings remain open: incomplete cross-platform redaction, unsafe/unbounded Linux PID fallback lifecycle, overbroad Windows home-directory modify ACLs, and missing Windows install rollback. The cross-epoch wall-clock ordering defect is a P2 follow-up. No Ko waiver was accepted.

Handoff to Worker 23: treat the four P1 findings as release blockers, use the consolidated GitHub comment as the implementation-agent prompt, and rerun the audit against an immutable repair candidate. The next round must include focused regressions plus live macOS/Linux/Windows lifecycle, IPC/redaction, ACL/rollback, packaging/signing, and browser-integration evidence. This report does not modify the shared finding ledger.