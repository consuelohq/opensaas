# daily security maintenance 2026-08-24

branch: `task/security/daily-security-maintenance-2026-08-24`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2176/daily-security-maintenance-2026-08-24
github pr: https://github.com/consuelohq/opensaas/pull/2176
started: 2026-08-24

## acceptance criteria

- [ ] Run the canonical deterministic repository security scan and record scanner completion plus normalized new/persistent/resolved groups.
- [ ] Triage material findings for applicability, reachability, duplication, and current advisory evidence before editing.
- [ ] Make only bounded, evidence-backed source changes; a no-source-change conclusion is valid.
- [ ] Validate any remediation with focused proof, review, and full verify before promotion.
- [ ] Promote the completed daily task into `stream/security` without merging the stream into `main`.
- [ ] Publish the normalized security report and generated task workpad into Daily Schedules.

## plan

1. Run `security.scan` against the synchronized `stream/security` task state.
2. Compare the scan with the prior daily security evidence and inspect recent/open PRs to avoid duplicate remediation.
3. Investigate the highest-leverage material candidates, including shipping/reachability evidence and current primary advisories when useful.
4. If a source change is justified, define a focused test contract, establish RED where practical, implement the smallest correct fix, and run GREEN plus broader validation.
5. Finalize the workpad, publish the normalized scan/workpad to Daily Schedules, push the task, promote it into `stream/security`, and verify the perpetual stream review PR remains the human boundary.

## current status

- Task started from synchronized `stream/security` at `2fb12075a65004ebf29fb80077afbe607fc67fe4`.
- Canonical installed `security.scan` was attempted first and failed because the installed wrapper could not resolve the current `security:scan` script. The current repository implementation was inspected and run as the bounded fallback.
- Initial scan completed Bun audit, OSV-Scanner, Trivy, and Semgrep at 1,290 unique groups (36 critical / 524 high / 588 medium / 138 low / 4 unknown). Direct key comparison to the 2026-08-23 final report produced 52 new / 52 resolved from Semgrep task-worktree paths; path-normalized comparison produced 0 meaningful new / 0 meaningful resolved.
- Persistent critical/high triage selected root `@grpc/grpc-js@1.14.3` as the highest-confidence bounded remediation candidate. It is pulled by OpenTelemetry OTLP gRPC exporters under `@opentelemetry/sdk-node`, which `packages/twenty-server` depends on directly. Every observed parent range is `^1.7.1`, so the patched 1.14.4 release is semver-compatible.
- The root Yarn lock was refreshed to `@grpc/grpc-js@1.14.4` without changing parent manifests. `yarn why @grpc/grpc-js --json` now resolves only 1.14.4, and a `twenty-server` workspace smoke successfully loads both `@opentelemetry/sdk-node` and `@grpc/grpc-js`.
- Final repository-equivalent scan completed all four scanners at 1,286 unique groups (36 critical / 520 high / 588 medium / 138 low / 4 unknown). Compared with the initial 1,290-group scan, the remediation resolved exactly four high-severity `@grpc/grpc-js` groups and introduced no new groups. A second post-fix scan was stable at 1,286 with no additional delta.

## files changed

- `yarn.lock`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-24 14:46:55 `review.run`: passed — OK
- 2026-08-24 14:52:00 `verify`: passed — OK
- 2026-08-24 15:23:37 `verify`: passed — OK

## key decisions

- This task starts from the security stream because the daily workflow intentionally builds on accepted but not-yet-main security history.
- No production edit will be made until a material finding is shown applicable enough to justify change.
- Astro 6.0.x findings were investigated but the Consuelo website is configured `output: 'static'`; the cited Astro XSS/SSRF advisories require SSR/runtime request handling, so those findings do not justify a website source change today.
- `@nyariv/sandboxjs` and Vitest critical clusters were already investigated in the prior daily run as development/testing paths; do not duplicate that work without new evidence.
- `@grpc/grpc-js@1.14.3` is operationally relevant through Twenty server telemetry. The server-only malformed-stream advisory is not proven reachable because Consuelo uses it through OTLP exporter clients, but the malformed compressed-message advisory applies to clients and servers. A semver-compatible lock refresh to 1.14.4 removes both findings without changing application APIs.
- GitHub's reviewed GHSA-99f4-grh7-6pcq / CVE-2026-48069 confirms malformed compressed messages can crash clients or servers and patches the 1.14.x line at 1.14.4. GHSA-5375-pq7m-f5r2 / CVE-2026-48068 is server-only and is also patched at 1.14.4. The fix therefore removes a real client-relevant availability risk while avoiding unsupported claims that the server-only path is exposed.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- `session.start({kind:"task"})` hit a facade validation bug that injected an unsupported `timeout` key; the documented `task.start` compatibility alias succeeded and returned task session `tsk_a6e1b4f622a7`.
- Initial typed GitHub `pr.list` inspection failed in the current wrapper with a JSON parse error; PR state will be rechecked through supported lifecycle output or a bounded fallback only if needed.
- The typed `security.scan` facade still invokes the missing root `security:scan` script. After that canonical attempt failed, the task used the current repository implementation `packages/os/scripts/security-scan.ts` through task-scoped `code.call`; raw scanner reports remained private in the local Consuelo cache and only normalized counts/paths are published.

## Test-first contract

behavior under test: the root Yarn graph must resolve `@grpc/grpc-js` only to a patched 1.14.x version at or above 1.14.4 while the Twenty server OpenTelemetry runtime remains loadable
existing local pattern: prior daily dependency remediations use a focused lock-resolution assertion, a runtime/module smoke, immutable package-manager validation, then normalized security rescan
new or changed tests: no permanent test file; this is a lockfile-only transitive refresh within existing parent ranges, so a deterministic resolution assertion is the stronger regression contract
focused red command: inspect `yarn why @grpc/grpc-js --json` and fail if any resolved 1.14.x version is below 1.14.4
expected red failure: current root graph resolves `@grpc/grpc-js@1.14.3`
no-test waiver: lockfile-only dependency resolution change; use explicit RED/GREEN resolution assertions plus Twenty server OpenTelemetry load smoke, immutable install validation, review/verify, and final security rescan

## validation evidence

- Focused RED established the root graph resolved `@grpc/grpc-js@1.14.3` before remediation.
- Focused GREEN: `yarn why @grpc/grpc-js --json` resolves only `1.14.4`; `yarn workspace twenty-server node -e` successfully loaded `@opentelemetry/sdk-node` and `@grpc/grpc-js`.
- Workspace review passed with no blocking task issues.
- Full `verify` passed with `publishValid: true` against `origin/stream/security` at task head `73d27dcce02f79558f11e5b212405fe29d8435ac`.
- Final repository-equivalent security scan completed Bun audit, OSV-Scanner, Trivy, and Semgrep at 1,286 unique groups. Initial-to-post-fix comparison: 0 new, 4 high-severity groups resolved.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/security-scan-runner.ts`
- `packages/os/scripts/lib/security-scan.ts`
- `packages/os/scripts/verify.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
