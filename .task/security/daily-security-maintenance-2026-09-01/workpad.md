# Daily security maintenance 2026-09-01

branch: `task/security/daily-security-maintenance-2026-09-01`
stream: `stream/security`
pr: https://github.com/consuelohq/opensaas/pull/2364
started: 2026-09-01

## acceptance criteria

- [x] Run the canonical `security.scan` against the synchronized `stream/security` source (`04d047d022292ef94e03a0bec16655d0172145c7`) and record scanner completion plus normalized deltas.
- [x] Triage new/changed findings first, then critical/high persistent findings, with explicit applicability and reachability reasoning for material candidates.
- [x] Check recent/open security work and current advisories before making any remediation so this task does not duplicate an existing fix.
- [x] Make only a bounded, evidence-backed source/configuration fix when justified; a truthful no-source-change result is acceptable.
- [x] Run risk-matched focused validation plus review/verify before publication.
- [ ] Push the daily task, promote it only into `stream/security`, and preserve the human `stream/security -> main` boundary.
- [ ] Publish the normalized/redacted scan and this generated workpad into Daily Schedules.

## plan

1. Run the deterministic scan before source investigation and capture the normalized report/evidence path.
2. Compare the scan with the prior daily baseline and current repository/PR state; investigate material candidates for shipping reachability and duplication.
3. If a bounded remediation is justified, establish a focused test-first contract, prove red where practical, implement the smallest fix, and prove green. Otherwise record a no-source-change decision with evidence.
4. Run `review.run` and `verify` against `origin/stream/security`, update this workpad with final evidence, then push and promote the task into `stream/security` only.
5. Ensure a current human review PR from `stream/security` to `main` exists, publish Daily Schedules, and stop before main/deploy/release actions.

## Test-first contract

behavior under test: `packages/workspace` must not resolve the node-tar 7.5.13 line now flagged by six Bun-audit advisories; its compatible `cmake-js@8.0.0 -> tar ^7.5.6` edge should resolve the current patched 7.5.22 line in both committed Bun and npm locks
existing local pattern: `packages/os` and `packages/consuelo-website` already use a narrow package-level `tar: 7.5.22` override for compatible 7.x transitive ranges; Aug 22 security maintenance used the same manifest/lock-resolution pattern without changing the parent package API
new or changed tests: no permanent runtime test file; this is generated transitive dependency state, so use an exact pre/post manifest + Bun/npm lock assertion, frozen-lock validation, workspace package tests/review/verify, and a final normalized security rescan
focused red command: task-scoped Bun assertion requiring `packages/workspace/package.json` override `tar === 7.5.22`, Bun lock `tar@7.5.22` with no `tar@7.5.13`, and npm `node_modules/tar.version === 7.5.22`
expected red failure: workspace has no tar override and both committed locks resolve `tar 7.5.13`
no-test waiver: permanent application-level regression test is not appropriate for a generated transitive lock resolution; the exact RED/GREEN resolution assertion plus frozen lock validation and repository review/verify is the executable regression contract

## files changed

- `packages/workspace/package.json`
- `packages/workspace/bun.lock`
- `packages/workspace/package-lock.json`

## current status

- Canonical typed `security.scan` was attempted first and failed only because the installed facade still invokes a missing root `security:scan` script. The current repository-equivalent `packages/os/scripts/security-scan.ts` then completed Bun audit, OSV-Scanner, Trivy, and Semgrep successfully and wrote the normalized report to `/Users/kokayi/.consuelo/node/cache/security-scans/2026-09-01T13-48-55-463Z/security-scan-report.json`.
- Initial inventory: 1,290 unique groups (36 critical / 520 high / 593 medium / 138 low / 3 unknown). Raw delta was 63 new / 1,227 persistent / 59 resolved; semantic normalization removes task-worktree path/line churn and advisory-title churn.
- New material candidates investigated: the six-group workspace node-tar cluster; Astro CVE-2026-73422/CVE-2026-73423 in website/docs locks; and Axios CVE-2026-67312/CVE-2026-67316 in the root Twenty graph.
- Astro: the website explicitly uses `output: 'static'`; prior daily work already established that the cited View Transition/server-origin paths require runtime/server-controlled response behavior. Documentation uses the Cloudflare adapter, but today's bounded task did not establish attacker control over the affected animation/origin inputs. No Astro source change was justified ahead of the higher-confidence tar cluster.
- Axios: Twenty server uses Axios in real outbound HTTP/workflow paths, so the new medium findings are operationally relevant candidates rather than dead code. They require a broader Twenty dependency/runtime compatibility refresh than today's single transitive build-tool fix and remain for follow-up triage; they were not suppressed or hidden.
- Selected remediation: add `packages/workspace` override `tar: 7.5.22` and update only the tar resolution in both committed locks. `cmake-js@8.0.0` already accepts `tar ^7.5.6`, and npm currently reports 7.5.22 as the latest release. The npm registry metadata exactly matches the committed 7.5.22 tarball URL and integrity hash.
- Focused RED failed as expected: no override, Bun lock contained `tar@7.5.13`, and npm lock resolved 7.5.13 (trace `trc_a2ad2ec4fa4a`).
- Focused GREEN passed after remediation: override is 7.5.22, Bun lock contains 7.5.22 and no 7.5.13, npm lock resolves 7.5.22, and the npm registry integrity matches (traces `trc_ef1af98a6acc`, `trc_95ca17251ff7`). `bun install --frozen-lockfile --lockfile-only --ignore-scripts` passed (trace `trc_a64c659f800f`).
- Final repository-equivalent security scan completed all four scanners at `/Users/kokayi/.consuelo/node/cache/security-scans/2026-09-01T13-55-44-240Z/security-scan-report.json`: 1,284 unique groups (35 critical / 518 high / 590 medium / 138 low / 3 unknown), with 0 new / 1,284 persistent / 6 resolved versus the pre-fix scan. The six resolved groups are exactly the workspace tar cluster (1 critical / 2 high / 3 medium).
- Typed strict `review.run` passed with 0 task issues / 0 blocking issues (trace `trc_e8c5c4f3d123`). Full typed `verify` then inspected exactly the 3 production files changed here, passed review + DB guardrails, and issued `publishValid: true` at `.task/security/daily-security-maintenance-2026-09-01/verify.json` (trace `trc_3462147f0778`).

## key decisions

- `stream/security` was synchronized with current `main` before task creation; the sync had no substantive conflicts and pushed merge `04d047d022292ef94e03a0bec16655d0172145c7`.
- The prior stream review PR #2167 is closed, so a fresh human review PR may need to be created after today's task promotion. Never merge that PR automatically.
- The initial normalized scan completed all four configured scanners at 1,290 unique groups (36 critical / 520 high / 593 medium / 138 low / 3 unknown). Scanner-native reports remain private under the Consuelo cache.
- Raw delta versus Aug 24 is dominated by Semgrep task-worktree path/line churn. Semantic normalization by advisory + package + version + repository-relative lock path (and by Semgrep rule + repository-relative source path) leaves 12 material new dependency groups and 8 resolved groups.
- The highest-leverage new cluster is `packages/workspace` node-tar: six advisories (1 critical / 2 high / 3 medium) against the transitive 7.5.13 resolution. `cmake-js@8.0.0` declares `tar ^7.5.6`, so 7.5.22 is within the existing parent contract. No direct tar application import was found, so this is dependency/build-tool hardening rather than a claim of remotely reachable exploitation.
- No recent Dependabot activity or separate recent workspace-tar remediation was found. Recent tar work is the accepted Aug 22 website fix and Aug 27 OS runtime fix; those establish precedent but do not cover the workspace lock graph.
- The npm lockfile was pre-existingly behind two current workspace manifest dependencies and plain `npm install --package-lock-only` also hit the repository's known tree-sitter peer conflict. To avoid unrelated lock churn, the task retained the existing lock graph and updated only the exact tar node entry using registry-verified 7.5.22 metadata; Bun remains the package's canonical frozen-lock validation.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- Initial `stream.sync` passed an obsolete `repo` argument and failed with `unknown flag: --repo` (trace `trc_c0438d012333`). Retrying the current typed shape without `repo` succeeded (trace `trc_c3ad7d8dc489`).
- Typed `security.scan` still points at a missing root `security:scan` script (trace `trc_637a117f17e1`); the inspected repository implementation was used without exposing scanner-native secret contents.
- The first lock regeneration attempt used the obsolete `code.call` mode name `mutate`; retrying with current mode `edit` succeeded for Bun. npm lock-only regeneration then hit a tree-sitter peer conflict; `--legacy-peer-deps` demonstrated the generated tar update but also repaired unrelated pre-existing npm-lock drift, so that broad churn was discarded and only the registry-verified tar entry was retained.
- A broad `bun test` under `packages/workspace` is not a clean package-level signal in this repository: it ran 969 tests with 880 pass / 4 skip / 85 fail / 2 errors from existing test-selection/facade drift and generated a snapshot. The generated snapshot was immediately reverted; no failing test was changed or weakened. Formal task-scoped review/verify remains the required gate.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/package-lock.json`

- 2026-09-01 13:57:25 apply-patch: `.task/security/daily-security-maintenance-2026-09-01/workpad.md`

## workspace-owned: validation evidence

- 2026-09-01 14:00:44 `review.run`: passed — OK
- 2026-09-01 14:00:45 `review.run`: passed — OK
- 2026-09-01 14:02:34 `verify`: passed — OK

- 2026-09-01 14:02:45 apply-patch: `.task/security/daily-security-maintenance-2026-09-01/workpad.md`