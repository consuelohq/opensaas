# Build OS daily schedule security and self healing foundation

branch: `task/os/build-os-daily-schedule-security-and-self-healing-foundation`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1933
started: 2026-08-14

## acceptance criteria

- [x] Add a general-purpose OS `security.scan` tool that infers the current repository and orchestrates defensive deterministic scanners across dependencies, source, secrets, and configuration.
- [x] Normalize Bun audit, OSV-Scanner, Trivy, and Semgrep into one structured report while keeping native scanner evidence local and scanner failures separate from findings.
- [x] Keep `security.scan` repo-scoped and defensive-only: no arbitrary remote targets, exploitation, credential collection, persistence, destructive testing, or production mutation.
- [x] Add daily cross-scan grouping plus new/persistent/resolved deltas so scheduled triage does not re-read the full backlog every day.
- [x] Add OS-native `monitor.errors` using canonical Consuelo trace storage and current OS tool contracts, separating expected policy/caller-input from drift, transient/external failures, and defect candidates.
- [x] Prove the `fs.read`-style invariant: a `TASK_SESSION_REQUIRED` trace contradicting a current sessionless tool contract is drift; a stale optional task handle is caller input rather than drift.
- [x] Reuse the current OS install/onboarding signal architecture in the self-healing workflow: canonical install error groups/read model first, Sentry/PostHog/Cloudflare evidence as supporting projections. Do not invent a second telemetry stack.
- [x] Add a generic explicit `dailySchedules.publish` capability and date/kind data model for `security-scan`, `security-workpad`, and `self-healing-workpad`.
- [x] Make Daily Schedules link-first, grouped by newest date, filterable by date and type, durable/versioned, responsive, and private/opt-in rather than populated for every install.
- [x] Keep scan/analysis read surfaces separate from artifact publication. Publication is an explicit mutating action and uses artifact `baseVersion` concurrency rather than force overwrite.
- [x] Initialize Ko's real Daily Schedules artifact empty; do not fabricate schedule entries before the first scheduled runs.
- [x] Install the local scanner executables needed for dogfood without making the OS tool silently install software for other users.
- [x] Prepare two isolated temporary prompt files, one security and one self-healing. The self-healing prompt is OS-only and does not rely on unrelated historical product context.
- [x] Future scheduled-agent code autonomy stops at opening PRs; no automatic merge, deploy, release, credential rotation, production access mutation, or OS lifecycle mutation.

## implementation

### `security.scan`

- New OS domain/tool: `security.scan` (`EmptyInput`, sessionless, read-only capability, optional branch routing).
- Resolves the current Git root; there is no host/URL target input.
- Runs:
  - Bun audit over each tracked `bun.lock` directory (root audit is not assumed because this monorepo also has an older Yarn lock),
  - OSV-Scanner recursive source scan,
  - Trivy filesystem vulnerability + misconfiguration + secret scanners,
  - Semgrep local security-audit rules with metrics disabled.
- Native reports are private local evidence under `~/.consuelo/node/cache/security-scans/<timestamp>/` with restrictive permissions.
- Normalized findings intentionally omit matched secret/credential values.
- Scanner status is `completed | unavailable | failed`; scanner failure is never converted into a vulnerability finding.
- Stable `sec_*` finding fingerprints and `secgrp_*` cross-scanner groups support comparison.
- Report includes raw scanner-evidence counts, grouped/unique counts, and new/persistent/resolved daily group deltas against the previous normalized scan.
- `security.scan` never self-installs scanners.

### `monitor.errors`

- New OS domain/tool: `monitor.errors` (`EmptyInput`, sessionless, read-only capability, optional branch routing).
- Uses `resolveCanonicalTraceDbPath()` and `bun:sqlite`; no legacy hard-coded trace location.
- Reads the last 24h of non-OK canonical OS traces, aggregates tool+code recurrence/branches/sessions, then compares each group with the current OS tool registry.
- Classifications: `expected-policy`, `caller-input`, `runtime-contract-drift`, `defect-candidate`, `transient`, `external`, `unknown`.
- Repeated execution/parsing/provider/timeouts can become candidates; isolated errors remain non-actionable unless contract evidence contradicts them.
- `TASK_SESSION_NOT_FOUND`/`MISMATCH` is caller input; only a required-session rejection that contradicts a current sessionless contract is drift.

### Daily Schedules

- New explicit OS tool: `dailySchedules.publish` with typed `DailySchedulesPublishInput`.
- Supported kinds: `security-scan`, `security-workpad`, `self-healing-workpad`.
- Stable routes:
  - `/artifacts/daily-schedules/<date>/security-scan`
  - `/artifacts/daily-schedules/<date>/security`
  - `/artifacts/daily-schedules/<date>/self-healing`
  - index `/artifacts/daily-schedules`
- Validates ISO date and source-file XOR inline-content before artifact mutation.
- JSON is pretty-printed; all detail content is escaped as text. Reports/workpads cannot inject arbitrary HTML.
- Existing same-day entries use current artifact `baseVersion`; reruns create immutable revisions and fail closed on stale concurrency instead of force publishing.
- The index is intentionally quiet/link-first and follows current Consuelo Artifacts paper/ink/mono utility styling with adaptive dark mode and mobile layout.

### Scheduled workflow drafts

- `/tmp/consuelo-security-daily-schedule.md`
- `/tmp/consuelo-self-healing-daily-schedule.md`
- Both require a daily workpad publication even on no-PR days.
- Security publishes the normalized untriaged scan report plus security workpad.
- Self-healing publishes its workpad and uses local dogfood traces plus current hosted install/onboarding evidence when available.
- Proposed code branches are fresh `task/schedules/security/...` or `task/schedules/self-healing/...` branches so an unmerged prior proposal cannot contaminate the next run.

## files changed

- `packages/os/package.json`
- `packages/os/scripts/daily-schedules.ts`
- `packages/os/scripts/lib/daily-schedules-publisher.ts`
- `packages/os/scripts/lib/daily-schedules.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/monitor-errors-report.ts`
- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/scripts/lib/security-scan-runner.ts`
- `packages/os/scripts/lib/security-scan.ts`
- `packages/os/scripts/monitor-errors.ts`
- `packages/os/scripts/security-scan.ts`
- `packages/os/tests/daily-schedules.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/monitor-errors.test.ts`
- `packages/os/tests/security-scan.test.ts`
- `packages/os/tools/daily-schedules/{manifest,schema,handler,handler.test}.ts`
- `packages/os/tools/monitor/{manifest,schema,handler,handler.test}.ts`
- `packages/os/tools/registry.ts`
- `packages/os/tools/security/{manifest,schema,handler,handler.test}.ts`

## local setup performed

Dogfood scanner binaries were absent except Bun. Installed with their normal isolated package-manager paths:

- Bun `1.3.14` (already installed)
- OSV-Scanner `2.5.0` via Homebrew
- Trivy `0.73.0` via Homebrew
- Semgrep `1.173.0` via `uv tool install semgrep` (`~/.local/bin/semgrep`)

The task did not edit shell PATH. The OS scanner explicitly discovers common binary paths and reports `unavailable` on machines where a scanner is absent.

## TDD and validation evidence

### red

Focused tests were written before production implementation and failed on missing modules/contracts:

- `packages/os/tests/security-scan.test.ts`
- `packages/os/tests/monitor-errors.test.ts`
- `packages/os/tests/daily-schedules.test.ts`

Red trace: `trc_fa131e763105`.

### focused green

Latest focused contract run: 19 pass / 0 fail, 52 expectations, plus OS syntax/typecheck script:

- scanner normalization/group/delta tests,
- monitor classification tests,
- Daily Schedules model/publication/concurrency tests,
- all three tool-package handler/schema tests.

Trace: `trc_bcf9b02f7a1e`.

### generated/tool-package integrity

- OS generated manifest count: 159 tools.
- `generate-tool-manifest:check` clean.
- `tests/tool-manifest.test.ts` + `tests/tool-package-layout.test.ts`: 20 pass / 0 fail, 331 expectations.
- Baseline fixture updated only for the intentional 156 -> 159 tool definitions.

Trace: `trc_7a39501e487b`.

### real trace dogfood

Initial classifier dogfood exposed a false positive: stale optional `TASK_SESSION_NOT_FOUND` was being treated as runtime drift. Rule corrected before promotion.

Latest observed 24h summary after correction:

- total groups: 64
- expected policy: 3
- caller input: 11
- runtime-contract drift: 0
- defect candidates: 29
- transient: 13
- external: 0
- unknown: 8
- actionable: 29

This validates that non-OK traces are not mechanically treated as defects.

### real security dogfood

Final scan after grouping/delta work completed all four scanners. Compared with the immediately prior scan:

- new groups: 0
- persistent groups: 1,366
- resolved groups: 0

Grouped evidence summary is 1,366 candidate groups (not verified exposures): 45 critical, 544 high, 633 medium, 140 low, 4 unknown; categories 1,223 dependency, 52 static, 2 secret, 89 misconfiguration.

Underlying scanner evidence rows: Bun 149, OSV 917, Trivy 924, Semgrep 52. Large overlap and full-monorepo/upstream scope are expected; daily agent triage determines applicability/reachability.

Trace: `trc_afb7698d9c5b`.

### Daily Schedules artifact

Disposable-home tests prove:

- three dated detail kinds + one filterable index,
- invalid date/source ambiguity creates zero artifact state,
- same-day republish creates an immutable second version using concurrency control.

Real Ko artifact initialized empty (truthful before first scheduled run):

- artifact ID: `artifact-40c355f77c0e8674`
- route: `/artifacts/daily-schedules`
- initial version: `2026-08-14T01-42-37-254Z`
- catalog contains exactly one artifact after initialization.
- `artifacts.check`: clean.
- Sites refresh reports one artifact.

Publish/check trace: `trc_b934f9d55954`.

Browser validation:

- Daily Schedules desktop render: title, archive link, date control, type filter, three supported filter options; trace `trc_15d7c89acbdd`.
- Mobile render passes the same accessibility snapshot; trace `trc_9878e428106e`.
- Canonical Consuelo Artifacts index visibly lists and links `Daily Schedules`; trace `trc_61c2143a0e09`.
- Link href verified as `/artifacts/daily-schedules`; trace `trc_330e4084e724`.

## current hosted OS signal architecture reused by self-healing

Current `stream/os` already has typed install/onboarding telemetry rather than requiring a new stack:

- D1/read model is canonical for install/user/error state.
- Normalized error groups include error code, stage, impact, count, affected installs/users, latest timestamp, platform and channel breakdown.
- Install details/diagnostics correlate Sentry event IDs, Cloudflare trace IDs, and PostHog milestones.
- Daily self-healing draft instructs the agent to start from this normalized control-plane evidence when available, then use read-only Sentry tools as supporting evidence.
- This remains Ko-specific orchestration in the scheduled prompt; `monitor.errors` stays a general OS tool and does not hardcode Consuelo private endpoints into a shipped generic tool.

## key decisions

- One repo-wide security scanner, not product-specific scanner topology. OS/Dialer context belongs in applicability triage.
- Severity prioritizes but does not gate fixes.
- Scanner evidence is not automatically a vulnerability; daily agent performs reachability/applicability/advisory/recent-PR reasoning.
- Native secret-match reports stay local; the normalized report is the publishable security artifact.
- Self-healing is OS-focused and reasons from contracts/invariants, not raw error counts.
- Current implementation is evidence, not authority: the agent may correct a bad contract if sibling capabilities and regression evidence prove the invariant.
- Daily Schedules is opt-in. Generic OS users receive capability, not Ko's schedule data.
- Artifact publication is an explicit separate action so read-only scan/analyze tools do not unexpectedly mutate durable output.
- Schedule proposals use fresh task branches under a `schedules` namespace rather than a shared mutable work branch; target the actual authoritative product source.

## issues/recovery during implementation

- Initial PR #1931 bootstrapped from `main` rather than `stream/os`; it was closed and its worktree/branch removed before production edits. Correct task restarted as #1933 from `stream/os`.
- `tools.search limit=10` exceeded live max 5; rerun correctly. Caller-input validation only.
- First existing-workpad overwrite omitted `force`; rerun correctly.
- First new tool-package writes omitted `mkdirs`; rerun correctly.
- First codegen call used `verify` mode even though generation writes files; generation succeeded but mutation guard flagged the call. Rerun under edit mode, then separate no-write manifest check passed.
- First baseline update used a relative dynamic import from the temp code-call file and failed; rerun with an absolute file URL succeeded.
- One batch searched empty/nonexistent paths and produced validation/IO errors; no product fix warranted.
- One final scan validation attempted a shell execution heredoc and was correctly rejected by code-call validation; rerun with `node -e` succeeded.
- Live installed `artifacts.generateWebsite` currently resolves to a stale package-script context and failed before generation. The task used the current repository artifact/design CLI plus the design operator docs instead; this installed-runtime/facade drift is useful future self-healing evidence but not part of this task's product change.
- A dry-run design CLI returned the older pending-prompt shape rather than the expected modern work-order shape. No prompt was sent to Open Design chat; artifact source was built directly from the approved brief/design system.

## remaining gates

- [ ] `git diff --check`
- [ ] repository `review.run`
- [ ] task `verify`
- [ ] publish task branch and merge task PR #1933 into `stream/os`
- [ ] finish/cleanup task

Do not merge `stream/os` to `main` in this task without a separate explicit approval.

## final gate status and baseline evidence

- `git diff --check`: passed.
- Repository `review.run` passed before the documentation follow-up with zero blocking issues; rerun after docs update is the final review gate.
- Full `verify` selected all critical trace-site and lifecycle suites plus the broad `@consuelo/os` package test. Every critical selected suite passed, repository review passed, and DB guard passed; only the broad package test failed.
- A detached untouched `origin/stream/os` worktree reproduces the exact same 43 `tests/facade/facade.test.ts` failures with the same names: media/subagent synthetic timeout/dry-run expectations plus existing fs/code.call cases. Baseline proof: `trc_0ddf545e7ab4`. This task adds zero failures to that facade suite.
- The verifier does not baseline-subtract that noncritical broad package suite, so it returns `publishValid:false`. Do not misrepresent this as a green full stamp.
- Running the broad facade suite writes snapshot updates while failing. The verifier-created `packages/os/tests/facade/__snapshots__/facade.test.ts.snap` mutation was restored immediately and is not part of the task diff.

### public documentation follow-up

- Added current Astro/Starlight `Reference > Tools` claims and evidence for `security.scan`, `monitor.errors`, and `dailySchedules.publish`.
- `bun run --cwd packages/documentation validate`: pass (105 selected pages).
- `bun run --cwd packages/documentation test:foundation`: 13 pass / 0 fail.
- `bun run --cwd packages/documentation build` is blocked in this task worktree by the task bootstrap's absolute `packages/documentation/node_modules -> /Users/kokayi/Dev/opensaas/packages/documentation/node_modules` symlink. Astro concatenates the worktree path with that absolute dependency path before compiling the changed MDX. This is an environment/worktree dependency-cache failure, not a content-validation failure. Evidence: `trc_173546a4303a`; symlink proof: `trc_24cab04c7246`.
- Final strict review after the docs update: zero blocking issues and zero documentation opportunities, trace `trc_fc409dd78c67`.
- `task.push` correctly refused without a publish-valid verify stamp and requires a separate explicit Ko-approved override because the only failed selected suite is baseline-equivalent rather than task-caused. Refusal trace: `trc_d77756648b85`. Do not use the approved override unless Ko explicitly approves bypassing this gate.

- 2026-08-14 01:46:57 write: `.task/os/build-os-daily-schedule-security-and-self-healing-foundation/workpad.md`

## workspace-owned: files changed

- `packages/os/package.json`
- `packages/os/scripts/daily-schedules.ts`
- `packages/os/scripts/lib/daily-schedules-publisher.ts`
- `packages/os/scripts/lib/daily-schedules.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/monitor-errors-report.ts`
- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/scripts/lib/security-scan-runner.ts`
- `packages/os/scripts/lib/security-scan.ts`
- `packages/os/scripts/monitor-errors.ts`
- `packages/os/scripts/security-scan.ts`
- `packages/os/tests/daily-schedules.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/monitor-errors.test.ts`
- `packages/os/tests/security-scan.test.ts`
- `packages/os/tools/daily-schedules/{manifest,schema,handler,handler.test}.ts`
- `packages/os/tools/monitor/{manifest,schema,handler,handler.test}.ts`
- `packages/os/tools/registry.ts`
- `packages/os/tools/security/{manifest,schema,handler,handler.test}.ts`

## workspace-owned: activity log

- 2026-08-14 01:46:57 fs.write: `.task/os/build-os-daily-schedule-security-and-self-healing-foundation/workpad.md`

## workspace-owned: validation evidence

- 2026-08-14 01:47:28 `review.run`: passed — OK
- 2026-08-14 01:48:32 `verify`: failed — COMMAND_FAILED
- 2026-08-14 01:51:55 `review.run`: passed — OK

## workspace-owned: files read

- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/reference/tools.mdx`
- `packages/workspace/senior-engineer.md`
