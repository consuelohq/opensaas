# legacy CI cleanup

branch: `task/security/legacy-ci-cleanup`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1387/legacy-ci-cleanup
github pr: https://github.com/consuelohq/opensaas/pull/1387
started: 2026-07-10

## acceptance criteria

- [x] Remove the obsolete Claude dispatch workflow.
- [x] Remove the obsolete Crowdin pull, push, and QA workflows.
- [x] Remove the obsolete upstream Twenty synchronization workflow.
- [x] Remove the obsolete GitHub release-create and release-merge workflows.
- [x] Remove the permanently disabled Chromatic deployment job from frontend CI.
- [x] Remove deleted workflows from the privileged workflow allowlist.
- [x] Preserve active Consuelo CI, website checks, production release automation, and upstream-derived product test workflows not proven obsolete.
- [x] Do not remove Docker publishing or other active workflows in this task.
- [x] No branch protection or ruleset requires a removed check name.
- [x] Add a repository contract preventing reintroduction of the removed workflow files, credential references in workflows, disabled Chromatic job, or stale allowlist entries.
- [x] Workflow YAML parsing, workflow-security policy, focused tests, review, and full verify pass.

## plan

1. Confirm branch protection/rulesets and repository references before deletion.
2. Add a focused repository policy test and confirm it fails against the current legacy files.
3. Delete the seven approved obsolete workflows.
4. Remove the disabled Chromatic job and stale workflow-security allowlist entries.
5. Parse all remaining workflows and run the repository workflow-security checker.
6. Run focused tests, strict review, and full verify; then push and promote to `stream/security`.

## test-first contract

- Behavior under test: deprecated automation and its credential requirements must not exist in `.github/workflows`, and deleted privileged workflows must not remain allowlisted.
- Existing local pattern: workspace Vitest tests inspect repository source and workflow files as contracts.
- New test: `packages/workspace/tests/github-workflow-policy.test.js`.
- Focused red command: `cd packages/workspace && bun vitest run tests/github-workflow-policy.test.js`.
- Expected red failure: seven obsolete workflow files exist; frontend CI contains the disabled Chromatic job and credential reference; workflow-security allowlist includes deleted workflow paths.

## current status

- Approved legacy CI cleanup implemented and validated.
- Strict review and full verify passed with a publish-valid stamp.
- Ready to push and promote to `stream/security`.

## files changed

- `.github/workflows/claude.yml` (removed)
- `.github/workflows/i18n-pull.yaml` (removed)
- `.github/workflows/i18n-push.yaml` (removed)
- `.github/workflows/i18n-qa-report.yaml` (removed)
- `.github/workflows/upstream-sync.yml` (removed)
- `.github/workflows/ci-release-create.yaml` (removed)
- `.github/workflows/ci-release-merge.yaml` (removed)
- `.github/workflows/ci-front.yaml`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `.task/security/legacy-ci-cleanup/workpad.md`
- `packages/workspace/tests/github-workflow-policy.test.js`

## workspace-owned: files changed

- `.task/security/legacy-ci-cleanup/workpad.md`
- `packages/workspace/tests/github-workflow-policy.test.js`

## workspace-owned: activity log

- 2026-07-10 22:56:06 fs.write: `.task/security/legacy-ci-cleanup/workpad.md`
- 2026-07-10 22:56:20 fs.write: `packages/workspace/tests/github-workflow-policy.test.js`

## workspace-owned: validation evidence

- 2026-07-10 22:58:20 `review.run`: passed — OK
- 2026-07-10 22:58:33 `verify`: passed — OK

## key decisions

- Remove only the clearly obsolete workflows approved in the plan.
- Keep Docker publishing and active frontend/server/shared/SDK checks until separately proven unnecessary.
- Keep the non-CI Chromatic placeholder in `packages/twenty-front/.env.example` out of this task.
- Tighten the write-permission allowlist so deleted privileged workflows cannot be silently recreated with write access.

## notes for ko

- Removed credential names were verified by name only; no values were accessed.
- Red evidence: all three policy contracts failed before implementation.
- Green evidence: cleanup policy 3/3; production release contract 3/3; all 15 remaining workflows parsed; workflow-security policy passed; policy script syntax passed.
- Branch protection and active rulesets have no required status-check names, so removed workflows do not leave stale merge requirements.
- Strict review reported zero issues; full verify passed and recognized all ten cleanup files.
- Verify's registry selector reported zero mapped suites; the explicit six tests and all-workflow parsing supply behavioral evidence.

## improvements noticed

- Docker publishing and the remaining inherited CI should receive a separate usage/cost audit before any broader deletion.

## issues and recovery

- A broad source-summary call was blocked by the tool transport; the audit was completed through targeted reads and a tracked-file reference scan.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-10 22:56:06 write: `.task/security/legacy-ci-cleanup/workpad.md`

## workspace-owned: files read

- `packages/os/tooling/script-parity-classifications.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/lib/facade/schemas.ts`

## workspace-owned: test selection

- changed files: `.github/workflows/ci-front.yaml`, `.github/workflows/ci-release-create.yaml`, `.github/workflows/ci-release-merge.yaml`, `.github/workflows/claude.yml`, `.github/workflows/i18n-pull.yaml`, `.github/workflows/i18n-push.yaml`, `.github/workflows/i18n-qa-report.yaml`, `.github/workflows/upstream-sync.yml`, `.task/security/legacy-ci-cleanup/current.json`, `.task/security/legacy-ci-cleanup/evidence-log.json`, `.task/security/legacy-ci-cleanup/read-log.json`, `.task/security/legacy-ci-cleanup/session.json`, `.task/security/legacy-ci-cleanup/workpad.md`, `.task/tasks/security/legacy-ci-cleanup.json`, `packages/workspace/scripts/ci/check-github-workflows.cjs`, `packages/workspace/tests/github-workflow-policy.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
