# daily security maintenance 2026-08-22

branch: `task/security/daily-security-maintenance-2026-08-22`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2172/daily-security-maintenance-2026-08-22
github pr: https://github.com/consuelohq/opensaas/pull/2172
started: 2026-08-22

## acceptance criteria

- [ ] Inspect and synchronize `stream/security` with current `main` without discarding accepted stream history.
- [ ] Run the canonical normalized security scan and record scanner completion plus new/persistent/resolved groups.
- [ ] Triage material new and high-impact persistent findings for applicability, reachability, duplication, and release/runtime drift.
- [ ] Make only a bounded source remediation that is justified by evidence; otherwise record an explicit no-source-change decision.
- [ ] Validate any remediation with focused proof plus review/verify gates matched to risk.
- [ ] Push the daily task and promote it into `stream/security` without merging the stream into `main`.
- [ ] Publish the normalized scan and this generated workpad to Daily Schedules.
- [ ] Leave the perpetual `stream/security` -> `main` review boundary intact and report any human-only action.

## plan

1. Confirm stream/task/PR state and run `security.scan` from this stream-based task.
2. Compare the normalized scan with prior Daily Schedules/security-stream evidence and inspect current/open PRs to avoid duplicate remediation.
3. Investigate the highest-leverage material candidate, including reachability and current primary advisory evidence when useful.
4. If a source change is justified, establish a focused test contract, reproduce red where practical, implement the smallest correct fix, and prove green. Otherwise document a no-source-change decision.
5. Run review/verify, update this workpad with final evidence, publish Daily Schedules, push/promote the task into `stream/security`, and verify the stream review boundary.

## current status

- Stream context inspected and synchronized successfully. The stream is current with the source used to start this task; task PR #2172 was created from `stream/security` at source commit `520f472512101cf66497e7c034b785a31ea5476a`.
- The installed `security.scan` facade failed with `Script not found "security:scan"`; the current repository-equivalent scanner at `packages/os/scripts/security-scan.ts` completed all four scanners and wrote the normalized report to `/Users/kokayi/.consuelo/node/cache/security-scans/2026-08-22T13-38-47-432Z/security-scan-report.json`.
- Scan inventory is 1,338 unique groups. Raw delta versus Aug 21 is 58 new / 1,280 persistent / 52 resolved; all 52 new/resolved pairs are Semgrep task-worktree path churn, leaving 6 meaningful new dependency groups and 0 meaningful resolved groups.
- All 6 meaningful new groups are the newly surfaced node-tar long-path recursion DoS (CVE-2026-73566 / GHSA-r292-9mhp-454m) across `tar` 6.2.1, 7.5.7, 7.5.9, 7.5.11, 7.5.12, and 7.5.13 lockfile resolutions. Upstream marks `tar <=7.5.20` affected and 7.5.21 patched; npm's current `latest` is 7.5.22.
- Applicability: the advisory requires a service to list/extract attacker-controlled archives with a non-empty member-selection list. Repo source has no direct `tar` import/require. The root Yarn copies are transitive through `node-gyp` and `@mapbox/node-pre-gyp`; the seed lock and vendored Open Design lock are not a bounded primary-product remediation. The website copies are transitive through `@iconify/tools@4.2.0`, which already declares `tar ^7.5.2`, so pinning the current patched 7.x line is compatible and clears both the new advisory and older persistent node-tar findings from that actively built product graph at low blast radius.
- Selected remediation: add a website-level `tar: 7.5.22` override and refresh only its committed Bun/npm locks. No direct runtime exploitability claim is being made.
- Focused red reproduced the vulnerable lock state exactly: no website tar override, npm lock at 7.5.11, Bun lock at 7.5.12.
- Added the `tar: 7.5.22` website override and regenerated only `packages/consuelo-website/bun.lock` and `package-lock.json` with scripts disabled. `@iconify/tools@4.2.0` already accepts `tar ^7.5.2`, so this remains inside its declared semver contract.
- Focused green passed: manifest override is 7.5.22, npm lock resolves 7.5.22, Bun lock resolves 7.5.22 and no longer contains 7.5.12. `bun install --frozen-lockfile --lockfile-only --ignore-scripts` passed without lock drift.
- Website `astro check` completed with 0 errors / 0 warnings (24 existing hints), and `astro build` completed all 24 pages including `/rss.xml`.
- Final four-scanner rescan completed at `/Users/kokayi/.consuelo/node/cache/security-scans/2026-08-22T13-42-42-369Z/security-scan-report.json`: 1,314 unique groups, 0 new / 1,314 persistent / 24 resolved versus the pre-fix scan. The 24 resolved groups are all website `tar@7.5.11`/`tar@7.5.12` findings: 4 critical, 8 high, 12 medium.
- Normalizing task-worktree paths and comparing the final scan directly with Aug 21 yields 4 meaningful new / 1,310 persistent / 22 meaningful resolved groups. The 4 remaining new groups are the same new node-tar advisory in root `yarn.lock` (`tar` 6.2.1 and 7.5.9), the Twenty application seed lock (7.5.7), and vendored Open Design lock (7.5.13). Those were deliberately not force-upgraded: the 6.x root copy has an incompatible parent range, while the seed/vendor copies need ownership-specific dependency refresh rather than a blanket override.
- The typed `review.run` transport failed twice with an `ExceptionGroup`; after confirming no review result artifact existed, the current repository-equivalent review script was run with `--base origin/stream/security --strict --no-tests --summary-json` and reported 0 task issues / 0 blocking issues. Its stderr contains unrelated pre-existing ESLint/typecheck failures outside this task.
- The formal typed `verify` gate then completed successfully against `origin/stream/security`, inspected exactly the 3 production files changed here, reported review passed with 0 task/blocking issues, DB guardrails passed with 0 risks, and wrote a `publishValid: true` stamp at `.task/security/daily-security-maintenance-2026-08-22/verify.json`.

## Test-first contract

- behavior under test: the Consuelo website dependency graph must not resolve a node-tar version affected by GHSA-r292-9mhp-454m; both committed Bun and npm locks should resolve the compatible patched `tar` 7.5.22 line.
- existing local pattern: the website already uses root `overrides` for bounded security pins (`fast-xml-parser` and `protobufjs`) while preserving transitive package API contracts.
- new or changed tests: no permanent test file; use an exact manifest/lock resolution assertion before and after the override/lock refresh, followed by frozen-lock install/build validation and the final normalized security rescan.
- focused red command: task-scoped Bun assertion that the website manifest override is `tar: 7.5.22`, npm's `node_modules/tar` lock entry is 7.5.22, and the Bun lock contains 7.5.22 without its current 7.5.12 resolution.
- expected red failure: the manifest has no tar override, npm resolves tar 7.5.11, and Bun resolves tar 7.5.12.
- no-test waiver: a permanent runtime regression test is not appropriate for a generated transitive lock resolution; the red/green lock assertion, frozen-lock validation, website build, and normalized rescan are the executable replacement evidence.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-22 13:49:22 `review.run`: passed — OK
- 2026-08-22 13:50:26 `review.run`: passed — OK
- 2026-08-22 13:54:24 `verify`: passed — OK

## key decisions

- Start from the synchronized security stream, as required by the maintenance contract, preserving accepted security history and the human `stream/security` -> `main` boundary.
- Do not touch the unrelated modified `.opencode/package-lock.json` in the main worktree; all maintenance work stays inside the isolated task worktree.
- Do not globally force `tar` 7.x across the monorepo: one root resolution is constrained to `^6.1.11`, and the other new groups include a generated seed lock plus vendored Open Design state. The bounded website override is compatible with `@iconify/tools`' existing `^7.5.2` contract and avoids broad dependency surgery.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- `session.start({ kind: "task" })` is advertised as canonical but the installed runtime first rejected the top-level timeout and then reported `Script not found "session:start"`. Recovered through the supported `task.start` compatibility alias; task session `tsk_03e63af3e041` is active.
- The typed GitHub `pr.list` probe failed with its known JSON parse error. GitHub state will use the typed facade when possible and a bounded GitHub CLI fallback only if required, with the tooling gap recorded.
- `review.run` failed twice at the facade transport layer with `UNKNOWN / ExceptionGroup`. After checking for a durable review result and finding none, recovered with the repository-equivalent review script. The formal typed `verify` gate subsequently passed and issued the publish-valid stamp, so publish state is known and valid.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/daily-schedules.ts`
- `packages/os/scripts/lib/security-scan-runner.ts`
- `packages/os/scripts/lib/security-scan.ts`
- `packages/os/scripts/security-scan.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/workspace/scripts/review.js`

- 2026-08-22 13:54:43 apply-patch: `.task/security/daily-security-maintenance-2026-08-22/workpad.md`