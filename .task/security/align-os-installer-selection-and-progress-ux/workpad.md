# align OS installer selection and progress UX

branch: `task/security/align-os-installer-selection-and-progress-ux`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1282/align-os-installer-selection-and-progress-ux
github pr: https://github.com/consuelohq/opensaas/pull/1282
started: 2026-06-30

## acceptance criteria

- [x] Replace the hosted bootstrap `Enter 1 or 2` mode prompt with an arrow-key selector; no hidden numeric compatibility input.
- [x] Keep Clack active cursor color behavior, but render completed progress states green and failed states red.
- [x] Change the installer banner tagline to `One workspace. Any agent.`.
- [x] Use the approved progress steps: dependencies, workspace, security, skills, agents, service, health.
- [x] Remove artifacts from visible installer progress.
- [x] Keep the skills multi-select and make selected defaults/cursor position visible.
- [x] Replace inconsistent yes/no confirm prompts with vertical select-style prompts where still needed.
- [x] Remove the separate `connect detected agents` yes/no step and go directly to the agent multi-select.

## plan

1. Read installer bootstrap, Clack onboarding, banner helper, skills option builder, and existing source-string contracts.
2. Patch the shell bootstrap selector and compact progress line.
3. Patch the Clack installer flow, banner rendering, skills defaults, agent selection, and daemon selection.
4. Update focused OS tests and validate syntax, dry-run paths, and pseudo-terminal selector behavior.

## current status

- Implementation complete locally on top of current `origin/stream/security`.
- Focused installer validation passes.
- Full `packages/os` test run still has unrelated stream/main failures in `mcp-gateway`, tool manifest drift, and OAuth device tests; left untouched.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/cli-ui.ts`
- `packages/os/scripts/lib/onboarding-skills.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/onboarding-skills.test.ts`

## workspace-owned: files changed

- `.task/security/align-os-installer-selection-and-progress-ux/workpad.md`
- `.task/security/align-os-installer-selection-and-progress-ux/current.json`
- `.task/security/align-os-installer-selection-and-progress-ux/session.json`
- `.task/tasks/security/align-os-installer-selection-and-progress-ux.json`

## workspace-owned: activity log

- Started task branch and PR 1282 for `stream/security`.
- Read `CODING-STANDARDS.md` before editing.
- Merged `origin/stream/security` into this task branch after initial edits so the OAuth installer prompt changes from the stream layer are preserved.
- Reapplied installer UX edits on top of stream and verified the OAuth clipboard/link prompt remains present.

## workspace-owned: validation evidence

- `bash -n packages/os/scripts/bootstrap.sh` passed.
- `cd packages/os && bun run typecheck` passed.
- `cd packages/os && bun test tests/bootstrap-source.test.ts tests/onboarding-skills.test.ts tests/install-workspace-bootstrap-contract.test.ts` passed: 11 pass, 10 skipped, 0 fail.
- `cd packages/os && bun ./scripts/install.ts --dry-run --yes --json --mode local --workspace-name installer-ux-test --skip-daemons` passed.
- `cd packages/os && CONSUELO_HOME=$(mktemp -d) bash ./scripts/bootstrap.sh --dry-run --mode local` passed and printed `CONSUELO OS  ● dependencies  ○ workspace  ○ security  ○ skills  ○ agents  ○ service  ○ health`.
- Pseudo-terminal selector smoke passed: Enter selects `OS_MODE=local`; Down+Enter selects `OS_MODE=cloud`.
- `review.run --scope owned` passed with 0 owned issues, 0 pre-existing issues, and 0 failed test suites.
- Broader `cd packages/os && bun test` was attempted before the final stream merge and failed on unrelated existing issues: `vi.stubGlobal` / `vi.unstubAllGlobals`, media tool manifest drift, and a generated facade snapshot rewrite. The generated snapshot was reverted.
- Focused OAuth tests were not used as final validation for this task because this branch's current stream/main state still has unrelated OAuth/page and Vitest-global failures outside the installer selection/progress changes.
- 2026-06-30 03:25:27 `review.run`: passed — OK

## key decisions

- Used a Bash arrow-key selector in `bootstrap.sh` because mode selection happens before Bun/Clack is guaranteed available.
- Did not accept `1` or `2` in the new selector, per Ko's correction.
- Kept Clack's active prompt styling, and only changed our progress/banner completion/failure colors.
- Kept existing prompt wording except where the UI structure required removing stale artifacts/progress references.
- Made detected agents default-selected in the multiselect, matching the skills flow.

## notes for ko

- The first shell progress line is compact and uses the approved step names.
- The richer banner appears after workspace/security authorization, with `skills` active.
- The OAuth URL copy/click prompt from the previous security-stream task is preserved after merging the stream.

## improvements noticed

- The broad OS test suite has unrelated failures on this branch. They are not caused by this installer UX task and were not changed here.

## issues and recovery

- Initial pseudo-terminal smoke exposed that macOS Bash rejected `read -t 0.1`; changed the escape-sequence timeout to `-t 1` and verified Down+Enter selects cloud.
- First full OS test run rewrote `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`; reverted that generated test artifact.

---

## publish checklist

```bash
bun run task:push -- --message "fix(security): align OS installer prompt UX" --changed
bun run task:pr
bun run task:finish
```
