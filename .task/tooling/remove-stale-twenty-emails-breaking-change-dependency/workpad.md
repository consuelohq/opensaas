# remove stale twenty-emails breaking-change dependency

branch: `task/tooling/remove-stale-twenty-emails-breaking-change-dependency`
stream: `stream/tooling`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1431/remove-stale-twenty-emails-breaking-change-dependency
github pr: https://github.com/consuelohq/opensaas/pull/1431
started: 2026-07-12

## acceptance criteria

- [x] Remove stale `twenty-emails` dependencies from the GraphQL/OpenAPI breaking-change workflow.
- [x] Preserve the workflow's current-branch versus `main` schema comparison behavior.
- [x] Keep the repair limited to the workflow blocking PR #1389; do not silently clean unrelated stale workflows.
- [x] Prove the workflow YAML remains valid and every remaining explicit Nx build target exists.
- [ ] Pass repository review and the publish verification gate.
- [ ] Promote into `stream/tooling`, refresh PR #1389, and verify the repaired GitHub check before merge.

## plan

1. Capture the live CI failure and confirm the referenced Nx project is absent on both the stream and `main` comparison surfaces.
2. Remove the dead changed-file path and both stale `nx build twenty-emails` invocations from `ci-breaking-changes.yaml`.
3. Parse the workflow and statically validate its remaining explicit Nx build targets against the current project graph.
4. Run repository review and verification, push, promote, and inspect the refreshed PR check.

## test-first contract

- Behavior under test: the API-breaking workflow must reach server/schema comparison setup without invoking a removed Nx project.
- Existing pattern: workflow configuration is validated by GitHub Actions plus repository review/security checks.
- New or changed tests: no persistent test file; this is a narrowly scoped emergency CI repair.
- Focused red evidence: GitHub run `29213986650`, job `86706534442`, failed in `Build shared dependencies` with `NX Cannot find project 'twenty-emails'`.
- Expected green evidence: parsed YAML contains no `twenty-emails` reference, all remaining explicit `nx build` targets resolve, and the refreshed `api-breaking-changes` job advances beyond dependency build.
- No-test waiver: adding a repository-wide workflow-target linter is broader than this merge unblock. Deterministic static validation plus the real GitHub job replaces a new test file.

## current status

- PR #1389's API-breaking check does not report an API break; it exits before comparison because the workflow builds removed project `twenty-emails`.
- The repository has no `packages/twenty-emails` directory and Nx cannot resolve that project.
- The blocking workflow contains three stale references: one changed-file path and one build command in each current/main phase.
- All three references are removed. The current and main phases still build `twenty-shared` before `twenty-server`.
- Static validation parses the YAML, confirms zero `twenty-emails` references, and resolves all remaining explicit build targets (`twenty-shared`, `twenty-server`) in the 23-project Nx graph.

## files changed

- `.github/workflows/ci-breaking-changes.yaml`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-12 23:53:49 fs.write: `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/workpad.md`

## workspace-owned: validation evidence

- 2026-07-12 23:59:00 `review.run`: passed — OK
- 2026-07-12 23:59:00 `review.run`: passed — OK

## key decisions

- Repair only `.github/workflows/ci-breaking-changes.yaml`; other stale `twenty-emails` references are real cleanup work but are not involved in this PR's failing check.
- Remove the project from both current and main phases so the comparison remains symmetric.

## notes for ko

- This is a CI configuration repair required to make the requested stream merge verifiable; it does not change application runtime behavior.

## improvements noticed

- A future workflow-target audit could detect removed Nx projects across all GitHub workflows before they block unrelated PRs.

## issues and recovery

- The failure surfaced only after the original browser fixes refreshed PR #1389. A separate focused task was created from the updated stream so the CI repair remains independently reviewable.
- The first scoped `review.run` reused the bootstrap-head cache and reported zero changed files. Two forced full-review attempts exceeded the orchestration timeout. Recovery: commit only to the isolated task branch to produce a new head, then rerun normal scoped review and verification before stream promotion.

---

## publish checklist

```bash
bun run task:push -- --message "fix(ci): remove stale twenty-emails dependency" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-12 23:53:49 write: `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/workpad.md`

- 2026-07-12 23:54:02 apply-patch: `.github/workflows/ci-breaking-changes.yaml`

- 2026-07-12 23:55:16 apply-patch: `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/workpad.md`

- 2026-07-13 00:10:17 apply-patch: `.task/tooling/remove-stale-twenty-emails-breaking-change-dependency/workpad.md`