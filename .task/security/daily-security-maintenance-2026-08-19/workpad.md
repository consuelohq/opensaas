# daily security maintenance 2026-08-19

branch: `task/security/daily-security-maintenance-2026-08-19`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2164/daily-security-maintenance-2026-08-19
github pr: https://github.com/consuelohq/opensaas/pull/2164
started: 2026-08-19

## acceptance criteria

- [x] Synchronize `stream/security` with accepted current `main` while preserving the human `stream/security -> main` boundary.
- [x] Run the canonical deterministic security scan, or the current repository-equivalent implementation if the installed facade is stale, without publishing native secret contents.
- [x] Triage true new findings plus material persistent high/critical findings for applicability and reachability, with extra attention to Consuelo OS and Dialer shipping surfaces.
- [x] Check recent accepted security work and dependency activity so today does not duplicate an existing fix.
- [x] Make a source change only when a bounded, production-quality remediation is justified by evidence; a truthful no-source-change day is acceptable.
- [ ] Run review/verify gates, promote the completed task into `stream/security`, publish the normalized scan and generated workpad to Daily Schedules, and stop before any merge to `main`.

## plan

1. Synchronize and inspect `stream/security`, current `main`, recent security history, and today’s generated task/PR.
2. Run the deterministic scan and normalize scanner delta noise so task-worktree path changes are not mistaken for newly introduced vulnerabilities.
3. Triage new dependency findings and material persistent OS/Dialer candidates against current code paths, transitive dependency usage, recent accepted work, and primary advisory evidence.
4. If a reachable source issue has a bounded fix, establish a Test-first contract and implement it; otherwise record the explicit no-source-change decision without manufacturing churn.
5. Run diff/review/verify, push/promote the task into `stream/security`, verify a fresh stream review boundary exists toward `main`, and publish today’s Daily Schedules scan/workpad.

## current status

- `stream.sync` completed before task creation. `stream/security` and current `main` were reconciled cleanly at `0462d90a7a2abb1c23a707e1bbb9224075b06786`, preserving accepted security history; `stream.context` then reported 0 ahead / 0 behind.
- Current `main` already contains the prior stream review merge (`f735731841`, `Stream/security (#1940)`), so yesterday’s human boundary has been consumed upstream. Today’s promotion must establish/verify a new `stream/security -> main` review boundary rather than assuming PR #1940 is still open.
- Today’s generated task is session `tsk_8d508bc169ef`, branch `task/security/daily-security-maintenance-2026-08-19`, PR #2164, sourced from the synchronized security stream.
- The installed `security.scan` facade failed with `Script not found "security:scan"`. The current repository still defines the canonical `packages/os` `security:scan` script, so recovery used that source-equivalent implementation through task-scoped `code.call`.
- The authoritative completed normalized scan is `/Users/kokayi/.consuelo/node/cache/security-scans/2026-08-19T13-26-28-678Z/security-scan-report.json`. Bun audit, OSV-Scanner, Trivy, and Semgrep all completed. It reports 1,368 unique groups: 45 critical, 545 high, 634 medium, 140 low, and 4 unknown; categories are 1,225 dependency, 52 static, 2 secret, and 89 misconfiguration.
- Raw scanner delta versus the 2026-08-18 report is 57 new / 1,311 persistent / 57 resolved. Stable path-normalization shows the 52 Semgrep new/resolved pairs are task-worktree absolute-path fingerprint churn, not new source findings. The semantic delta is 5 new / 1,363 persistent / 5 resolved, and all five true-new groups are the same high-severity NanoID negative-size DoS advisory across lockfiles.
- NanoID CVE-2026-67214 / GHSA-28wg-ghj8-5hjv affects the non-secure generator when a negative size reaches it; upstream fixes are available in the maintained 3.x and 5.x lines. Repo search found no Consuelo source import of `nanoid/non-secure`. In the OS dependency graph, PostCSS 8.5.12 calls `nanoid/non-secure` with the constant `nanoid(6)`, while `node-llama-cpp` calls the secure `nanoid()` with its default size. No attacker-controlled negative-size path was established. Documentation uses the same PostCSS build chain, and `packages/consuelo-design/upstream/open-design` is an upstream/vendored lock surface. A forced/major NanoID update would create broad dependency churn and is not justified by the observed reachability.
- Persistent Consuelo OS high findings were also sampled. `ws@8.20.0` is present only through `@supabase/realtime-js`; current OS source does not import `@supabase/supabase-js`, and the observed Supabase interactions use direct HTTP/fetch helpers. Vite findings are development/test-chain dependencies. The root-user Dockerfile finding is real hardening debt, but changing the container execution identity affects Consuelo home/state permissions and runtime lifecycle semantics and is not a bounded scanner-only edit without dedicated container behavior tests.
- The deterministic scan contained no critical/high groups under `packages/dialer`, `packages/dialer-server`, or `packages/lead-connector`. No Dialer source remediation is justified from today’s evidence.
- Recent security history contains the accepted website XML remediation from Aug 17-18, and local dependency history shows recent Dependabot activity but no NanoID remediation already in flight. No duplicate source fix was created.
- Decision: no production-source change is warranted today. The material new NanoID finding is present in lock graphs but the vulnerable negative-size call path is not reachable in the inspected Consuelo OS/build consumers; remaining sampled OS findings either lack an active runtime path or require a broader behavior contract than this maintenance run can safely infer. Today’s output is the truthful maintenance record and normalized scan.

## files changed

- No production source or lockfile changes.
- Updated only this generated task workpad with today’s scan, triage, applicability reasoning, and maintenance decision.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-19 13:38:03 `review.run`: passed — OK
- 2026-08-19 13:38:04 `review.run`: passed — OK
- 2026-08-19 13:40:14 `verify`: passed — OK
- 2026-08-19 13:40:14 `verify`: passed — OK

## key decisions

- Treat scanner-native delta paths as evidence, not truth: normalize each report against its own repository root before deciding whether Semgrep findings are new.
- Do not manufacture a NanoID lock override. The advisory requires negative-size input to the non-secure API; inspected OS consumers use a constant size or the secure default API, while a top-level/major dependency update would be broader than the demonstrated risk.
- Do not convert the persistent `packages/os/Dockerfile` root-user warning into an untested one-line `USER` change. Container identity changes affect writable Consuelo state and deserve a dedicated execution/permissions contract.
- No TDD production test is appropriate on a no-source-change day; validation will prove the maintenance-record-only diff and publish lifecycle instead.

## notes for ko

- Human-only boundary remains review and merge of the refreshed `stream/security -> main` PR after today’s task promotion. No deploy, release, credential rotation/revocation, production IAM mutation, destructive production test, or Consuelo install/update/restart/rollback/uninstall operation was performed.

## improvements noticed

- none yet

## issues and recovery

- Installed `session.start` leaked an unsupported `timeout` field into its wrapper input. Recovery used the current compatible `task.start` alias and created the normal branch/worktree/PR/task session.
- Installed `security.scan` cannot find the current `security:scan` package script even though it exists in repository source. Recovery used the repository-equivalent scanner implementation; the first complete report is the authoritative scan for this run.
- A scan transport timeout caused a second equivalent scanner process/report directory to start. It was not killed or used as the authoritative baseline; no destructive process action was taken.
- Installed GitHub/`gh` facades currently fail parsing their auth wrapper, and `stream.context` cannot enumerate open GitHub PRs for the same missing-auth reason. Local read-only Git history and stream context were used for duplication evidence; lifecycle tools will still be attempted for task push/promotion before any bounded fallback.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/Dockerfile`
- `packages/os/package.json`
- `packages/os/scripts/lib/security-scan-runner.ts`
- `packages/os/scripts/lib/security-scan.ts`
- `packages/os/scripts/office.ts`
- `packages/os/scripts/security-scan.ts`
