# daily security maintenance 2026-08-20

branch: `task/security/daily-security-maintenance-2026-08-20`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2166/daily-security-maintenance-2026-08-20
github pr: https://github.com/consuelohq/opensaas/pull/2166
started: 2026-08-20

## acceptance criteria

- [x] Run the normalized four-scanner repository security scan and compare against the prior daily scan.
- [x] Triage new and high-impact persistent findings for applicability, reachability, duplication, and bounded remediation.
- [x] If a source change is justified, remove the selected vulnerable resolution with the smallest supported dependency change and prove the affected runtime still validates.
- [x] Run focused validation plus strict review/full verify before promotion.
- [ ] Publish the normalized scan and this generated workpad to Daily Schedules.
- [ ] Promote the validated daily task into `stream/security` while preserving the human `stream/security -> main` boundary.

## plan

1. Compare today's normalized scanner groups with the 2026-08-19 scan, discounting task-worktree-only Semgrep path churn.
2. Inspect the highest-leverage persistent candidates in code/lockfiles and check recent security/dependency work for duplication.
3. Prefer a lockfile-only upstream dependency refresh when it removes reachable shipping risk without adding a parallel override.
4. Re-scan, validate, publish, and promote only after the task is mergeable into the current security stream.

## current status

- Source inspected: `stream/security` at `757cc05e8fa6feaa030f7d71ee4c11e1782dca03`; task bootstrap `bdd4d15cfd0d8ef72dd2d4c6ad9b2d5610f8d4ad`; `origin/main` remained `f73573184111b24f75fc60b4ce4445fea4afb80e`. The stream preserves accepted security history and has no missing commits from current main.
- Initial scan: all four scanners completed; 1,365 normalized unique groups. Versus the latest 2026-08-19 scan, the raw delta was 52 new / 1,313 persistent / 55 resolved. The 52 new and 52 resolved static groups were an exact title+severity+scanner multiset match caused by task-worktree path churn, so the meaningful pre-remediation delta was 0 new / 1,365 persistent / 3 resolved.
- The three already-resolved high dependency groups were today's existing `linkify-it` algorithmic-complexity findings; the root resolution pins every observed consumer to 5.0.2.
- Material persistent candidate: stale AWS SDK `@aws-sdk/xml-builder` 3.972.4/3.972.10 resolutions pulled `fast-xml-parser` 5.3.4 and 5.4.1 into the shipping Twenty server AWS dependency graph. Twenty server directly ships S3, Lambda, SES, STS, and credential-provider clients, so this dependency graph is operational rather than vendored/test-only.
- Remediation: `yarn up -R @aws-sdk/xml-builder` converged both compatible ranges to 3.972.39, which no longer resolves `fast-xml-parser`; no new root dependency or blanket XML-parser override was added. Yarn's link step toggled two tracked bin executable bits; those incidental mode changes were reverted immediately.
- Final scan: all four scanners completed with 1,345 unique groups and an immediate delta of 0 new / 1,345 persistent / 20 resolved. The 20 newly resolved groups are all `fast-xml-parser` / `fast-xml-builder` findings (2 critical plus high/medium/low XML entity, injection, and denial-of-service groups). Combined with the three `linkify-it` groups already resolved before this resumed run, the meaningful 2026-08-19 -> final 2026-08-20 delta is 0 new / 1,345 persistent / 23 resolved; the 52 Semgrep path-key pairs cancel as non-semantic churn.
- Duplication check: current security stream context, recent commits, remote task/dependabot refs, and local history showed no open/current dependency task duplicating this AWS XML-builder refresh. GitHub PR-detail tooling remained unavailable, so this check did not rely on a successful remote PR-body fetch.
- Current advisory evidence: GitHub reviewed advisories identify the affected `fast-xml-parser` ranges for entity-expansion/DOCTYPE defects (including GHSA-m7jm-9gc2-mpf2, GHSA-jmr7-xgp7-cmfj, and GHSA-8gc5-j5rx-235r). AWS SDK's official `@aws-sdk/xml-builder` changelog records its compatible release line moving to patched parser versions and later internal XML parsing. The website's separate explicit `fast-xml-parser` 5.10.1 pin already satisfies the July 2026 repeated-DOCTYPE fix and was left unchanged.

## files changed

- `package.json` — preserve today's root `linkify-it` 5.0.2 security resolution.
- `yarn.lock` — refresh compatible AWS XML-builder ranges to 3.972.39 and remove the vulnerable 5.3.4/5.4.1 fast-xml-parser resolutions.
- Generated `.task/security/daily-security-maintenance-2026-08-20/*` and `.task/tasks/security/daily-security-maintenance-2026-08-20.json` — maintenance evidence/workpad owned by the task workflow.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-20 14:03:01 `review.run`: passed — OK
- 2026-08-20 14:04:30 `review.run`: passed — OK
- 2026-08-20 14:06:51 `verify`: passed — OK

## key decisions

- Do not treat same-count Semgrep worktree-path key churn as new security exposure.
- The website's explicit `fast-xml-parser` 5.10.1 pin remains patched for the July 2026 repeated-DOCTYPE advisory; today's material XML risk is instead the root Yarn graph's older AWS transitive resolutions.
- Prefer refreshing the existing compatible `@aws-sdk/xml-builder` transitive resolution over introducing a new root dependency or broad blanket resolution.
- Treat the dependency graph as applicable because Twenty server directly imports the AWS clients that depend on `@aws-sdk/core`/XML builder; do not claim an XML-parser exploit path where the AWS SDK only serializes internal protocol documents.
- The security value of this fix is elimination of vulnerable shipped dependencies and future misuse risk, not a claim that today's AWS call path accepted attacker-controlled XML.

## validation evidence

- Focused red: deterministic lock assertion failed while `@aws-sdk/xml-builder` 3.972.4/3.972.10 and `fast-xml-parser` 5.3.4/5.4.1 were present (`trc_ac1242eb246f`).
- Focused green: lock assertion passed after refresh; both AWS XML-builder ranges resolve 3.972.39 and the root Yarn graph no longer resolves `fast-xml-parser` (`trc_421e64d618e9`, `trc_22fe1be125d6`).
- Runtime smoke: `@aws-sdk/client-s3` loads successfully from the Twenty server workspace (`aws-s3-module-load-ok`, `trc_a2f156bbe56f`).
- Existing same-task hardening: `yarn why linkify-it` resolves both `mailparser` and `markdown-it` consumers to 5.0.2 (`trc_7f3740ebb623`).
- Immutable install: `yarn install --immutable --mode=skip-build` exited 0 internally. Yarn's link phase changed two executable bits, so the task wrapper correctly flagged mutation in verify mode; those mode changes were reverted and are absent from the final diff.
- Final normalized security rescan: all four scanners completed; 20 additional XML dependency groups resolved and 0 new groups appeared (`trc_09e8fda88ad4`).
- Review: 0 task issues / 0 blocking issues; 29 unrelated pre-existing lint/typecheck diagnostics were classified separately (`trc_3ea5c724d207`).
- Full verify: passed with `publishValid: true`; changed source set is `package.json` + `yarn.lock` (`trc_44d325b5e3b0`).

## Test-first contract

behavior under test: root `yarn.lock` must not resolve AWS SDK XML-builder paths to vulnerable `fast-xml-parser` 5.3.4/5.4.1 releases; the supported AWS XML-builder line should resolve to a release that consumes a patched parser.
existing local pattern: dependency security maintenance is proven by lock resolution assertions, frozen install/lock validation, affected package validation, and a final normalized security rescan.
new or changed tests: no permanent test file planned for a lockfile-only transitive refresh; use a focused deterministic lock assertion before and after the update.
focused red command: task-scoped Bun lock assertion that exits non-zero while `@aws-sdk/xml-builder` 3.972.4/3.972.10 and `fast-xml-parser` 5.3.4/5.4.1 remain resolved.
expected red failure: vulnerable AWS XML-builder/parser resolutions are present in `yarn.lock`.
no-test waiver: permanent regression test would duplicate the package manager lock contract; the lock assertion plus frozen install, affected package validation, review/verify, and rescan are the stronger evidence for this dependency-only change.

## notes for ko

- Human-only boundary remains `stream/security -> main`. No deployment, release publication, credential action, production IAM mutation, or destructive production test is part of this run.

## improvements noticed

- none yet

## issues and recovery

- Installed `security.scan` facade currently points to missing script `security:scan`; used the current repository `runSecurityScan` implementation, which invokes the same four scanners and writes the same normalized/redacted report schema.
- `session.start` wrapper leaked its transport timeout into the typed input and failed validation; compatibility `task.start` recovered the existing dated task session/PR without creating parallel state.
- Typed GitHub PR reads and direct `gh pr view` currently fail in GitHub auth/CLI plumbing with `JSON Parse error: Unexpected identifier "pr"`; duplication checks therefore use stream context, repository refs, and recent local Git history unless GitHub tooling recovers later.

- The first strict review invocation surfaced an opaque TaskGroup exception. Retrying through the smaller supported review input succeeded; full verify independently reran review and produced a publish-valid stamp.
- `yarn install --immutable --mode=skip-build` completed successfully but Yarn's link step toggled executable bits on two tracked bin files. The verification wrapper correctly treated that as mutation; the task restored those two modes to their original 0644 state before final review/verify.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/security-scan-runner.ts`
- `packages/os/scripts/lib/security-scan.ts`
- `packages/twenty-server/package.json`
- `packages/workspace/scripts/lib/task-workpad.js`
- `yarn.lock`
