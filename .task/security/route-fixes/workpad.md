# route fixes

branch: `task/security/route-fixes`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1385/route-fixes
github pr: https://github.com/consuelohq/opensaas/pull/1385
started: 2026-07-10

## acceptance criteria

- [x] Canonical Trace public route expectations use `/observability/*`; internal gateway expectations remain `/gateway/traces/*`.
- [x] No production route behavior changes for the stale route-contract failures.
- [x] Workspace connector provisioning failure messages redact complete `Authorization: Bearer <credential>` values.
- [x] Workspace connector provisioning failure messages redact standalone `Bearer <credential>` values.
- [x] Redacted failure text remains useful, bounded, persisted safely, and returned consistently at all approval entry points.
- [x] Focused route, adapter, route-seed, edge integration, and device-authority tests pass.
- [x] Review and task verification complete before promotion to `stream/security`.

## plan

1. Reproduce the existing route-contract failures in the task worktree.
2. Add explicit bearer-header and standalone-bearer cases to the existing terminal provisioning-failure test and confirm they fail.
3. Update only the stale Trace route expectations from `/traces/*` to `/observability/*`.
4. Make the smallest sanitizer change that consumes complete bearer credentials without weakening other redaction.
5. Run focused tests, broader related OS tests, review, and verify.
6. Push the task branch and promote it into the existing `stream/security` review PR.

## test-first contract

- Behavior under test: externally returned and persisted connector provisioning failures must never contain bearer credentials; Trace service discovery must advertise the canonical public route family.
- Existing local pattern: extend `should return a terminal failure when workspace connector provisioning fails`; retain its three entry-point loop and persisted-state assertions.
- New or changed tests: add error fixtures for `Authorization: Bearer <credential>` and standalone `Bearer <credential>`; update four stale canonical route assertions.
- Focused red command: `cd packages/os && bun vitest run tests/os-device-authority-worker.test.ts -t "should return a terminal failure when workspace connector provisioning fails"`.
- Expected red failure: one or both bearer credential fixtures remain in the response or persisted failure message with the current sanitizer.
- Existing route red command: `cd packages/os && bun vitest run tests/consuelo-sites-gateway.test.ts tests/consuelo-sites-trace-adapter.test.ts`.
- Expected route failure: expected `/traces/*` differs from production `/observability/*`.

## current status

- Implementation and validation complete.
- Full verification passed with a publish-valid stamp.
- Ready to push and promote to `stream/security`.

## files changed

- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/consuelo-sites-gateway.test.ts`
- `packages/os/tests/consuelo-sites-trace-adapter.test.ts`
- `.task/security/route-fixes/workpad.md`

## workspace-owned: files changed

- `.task/security/route-fixes/workpad.md`

## workspace-owned: activity log

- 2026-07-10 22:41:53 fs.write: `.task/security/route-fixes/workpad.md`

## workspace-owned: validation evidence

- 2026-07-10 22:43:56 `review.run`: passed — OK
- 2026-07-10 22:44:25 `verify`: passed — OK

## key decisions

- Treat `/observability/*` as the canonical public Trace Site route; keep `/gateway/traces/*` as the internal authenticated route family.
- Fix stale tests rather than reverting production routing.
- Exercise redaction through the public failure flow instead of exporting or directly unit-testing a private sanitizer.
- Keep release automation and legacy CI cleanup out of this focused PR-unblock task.

## notes for ko

- No credentials or secret values were read, printed, stored in the workpad, or committed.
- Red evidence: route suite failed 4 assertions on `/traces/*`; bearer regression test exposed both header and standalone fixture credentials.
- Green evidence: 37 core focused tests passed; 12 opt-in route/edge contract tests passed with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`; OS syntax checks passed; strict review reported zero issues; full verify passed and wrote a publish-valid stamp.
- Verify's registry selector reported zero mapped suites for these files; explicit focused and opt-in test commands supply the behavioral evidence.

## improvements noticed

- Release automation and legacy CI cleanup remain approved follow-on tasks after PR #1384 is green.

## issues and recovery

- `task.intent` and `task.start` initially hit payload/transport filtering with longer titles; retried with the minimal supported title `route fixes` and created the task successfully.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-10 22:41:53 write: `.task/security/route-fixes/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`

## workspace-owned: test selection

- changed files: `.task/security/route-fixes/current.json`, `.task/security/route-fixes/evidence-log.json`, `.task/security/route-fixes/read-log.json`, `.task/security/route-fixes/session.json`, `.task/security/route-fixes/workpad.md`, `.task/tasks/security/route-fixes.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/tests/consuelo-sites-gateway.test.ts`, `packages/os/tests/consuelo-sites-trace-adapter.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
