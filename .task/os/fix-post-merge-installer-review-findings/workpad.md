# fix post-merge installer review findings

branch: `task/os/fix-post-merge-installer-review-findings`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1745/fix-post-merge-installer-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1745
started: 2026-07-29

## acceptance criteria

- [ ] The installed `consuelo-os` lifecycle command preserves the subcommand when
  injecting `--home`, including the no-argument `status` default.
- [ ] Generated built-in tool wrappers resolve the active immutable runtime (or
  the persisted repo-local package root) and persisted Bun executable.
- [ ] Generated local-agent MCP launchers safely read the persisted package root
  and Bun executable without sourcing arbitrary shell from `.env`.
- [ ] Production bootstrap ignores release-channel overrides and trusts only the
  baked stable channel; development mode retains explicit channel overrides.
- [ ] Bootstrap rejects malformed signed release metadata, archive field type
  confusion, and rollback/replay to an older already-activated channel revision.
- [ ] Partial legacy release-key environment configuration fails explicitly.
- [ ] A non-directory or symlink at a managed component path is preserved as a
  review conflict instead of being treated as a clean update.
- [ ] Focused OS tests, publish validation, task CI, stream CI, main release
  workflows, immutable runtime publication, and stable promotion all pass.
- [ ] No unrelated website findings from the stream PR are changed.

## plan

1. Add focused regression tests for the nine deduplicated late review findings
   and record the failing evidence.
2. Fix lifecycle, generated wrapper/MCP launchers, release verification/trust,
   and managed-component conflict handling with the smallest bounded changes.
3. Run the focused suites, OS publish validation, and inspect the final diff.
4. Push PR #1745, wait for CI in five-minute intervals, promote through
   `stream/os` and `main`, then deploy and promote only the hotfix runtime.
5. Validate the hosted installer from an external cwd and the public MCP edge.

## current status

- Task started from merged main commit `1692a71e`.
- Nine unique OS findings remain after deduplicating the late CodeRabbit, Codex,
  and Qodo comments on PRs #1743 and #1744.
- Four website comments on PR #1744 are unrelated stream changes and excluded.
- All nine valid OS findings are implemented and the focused regression and
  adjacent distribution suites are green. Preparing the bounded task push.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/managed-components.ts`
- Focused tests in `packages/os/tests/`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- RED 2026-07-29: `bun --cwd packages/os test
  tests/install-state.test.ts tests/local-agent-connectivity.test.ts
  tests/managed-components.test.ts tests/bootstrap-source.test.ts
  tests/bootstrap-release-verifier-contract.test.ts
  tests/lifecycle-engine.test.ts` failed on lifecycle argument order, persisted
  MCP/Bun lookup, immutable tool wrapper lookup, production channel trust,
  missing channel state/rollback rejection, partial release-key config, and
  managed non-directory obstruction handling. 107 existing assertions passed.
- GREEN 2026-07-29: the same six focused files pass, 115/115.
- GREEN 2026-07-29: adjacent installer/runtime/release/retention suites pass,
  63 assertions with 7 existing todos.
- GREEN 2026-07-29: `bun run --cwd packages/os typecheck`,
  `bash -n packages/os/scripts/bootstrap.sh`, and `git diff --check`.
- BROAD BASELINE 2026-07-29: the unscoped package-wide Vitest invocation is
  not a valid release gate in this checkout: it runs under Node (so
  `bun:sqlite` is unavailable) and exposes existing manifest/tool-count,
  task-hook, media, timeout, and missing-generated-file drift. The directly
  affected 178 assertions are green.

## key decisions

- The signed payload's top-level `bundleId` identifies the release set, while a
  platform entry's `bundleId` identifies its runtime bundle; they must not be
  required to equal each other.
- Authorized rollback remains possible because a new channel publication has a
  newer monotonic revision even when it selects an older runtime bundle.
- The retention/uninstall review comment was a false positive: its generated
  signed manifest already uses the built fixture's current platform and
  architecture; the 70-case adjacent suite remains green.
- No additional review round will be requested; this hotfix resolves comments
  already posted during the approved review rounds.

## notes for ko

- This task is intentionally limited to the late OS review findings. It does not
  change the unrelated website code reviewed on the stream PR.

## improvements noticed

- none yet

## issues and recovery

- The connected OS facade remained unavailable with `SKILL_NOT_FOUND`; Ko
  explicitly authorized the repository's underlying Bun/native workflow.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```
