# installer and launcher onboarding UX improvements

branch: `task/os/installer-and-launcher-onboarding-ux-improvements`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1290/installer-and-launcher-onboarding-ux-improvements
github pr: https://github.com/consuelohq/opensaas/pull/1290
started: 2026-06-30

taskSession: `tsk_2b4aeb2392de`

## acceptance criteria

- [x] Replace the raw dependency Enter pause with a yes/no arrow-key prompt that matches the local/cloud selector interaction style.
- [x] Keep installer progression labels and state moving through dependencies, workspace, security, skills, agents, service, and health.
- [x] Preserve requested copy: `One workspace. Any agent.` when a tagline is shown.
- [x] Expand local agent discovery coverage in the existing registry style for Codex, Cursor, Claude, OpenCode, Factory, Gemini/Google tooling, and Pi where reliable local footprints exist.
- [x] Keep local agent selection copy clear and visually understandable in Clack.
- [x] Add a launcher onboarding component/module that renders the ChatGPT connector URL, copy action, cloud-agent section, and connected local-agent status list.
- [x] Add focused tests before implementation and make them green.
- [ ] Validate locally, push the task branch, promote through `stream/os`, merge to main, pull local main, run the OS release gate, and verify live `install.consuelohq.com/os` and `os.consuelohq.com`.

## plan

1. Read repo steering, standards, OS task/senior-engineer docs, and current installer/launcher implementation.
2. Write focused red tests for bootstrap dependency prompt/progression, installer progress and agent prompt/registry behavior, and launcher onboarding render contract.
3. Implement the smallest OS-owned changes in `packages/os`.
4. Run focused green tests, typecheck/syntax checks, live installer smoke, review/verify gates.
5. Push task branch, promote to stream review, merge stream to main, sync local main, release, and verify live URLs.

## Test-first contract

Behavior under test:

- Bootstrap dependency setup offers a keyboard yes/no choice with `local`/`cloud`-style selection instead of a raw Enter pause.
- Installer progress renders the required step labels and advances active/completed/pending state through `agents`, `service`, and `health`.
- Local agent discovery is registry-backed and covers common local footprints without hard-coded one-off checks.
- The local agents prompt communicates found count and selected/unselected state clearly.
- Launcher onboarding renders the required ChatGPT link, MCP/server URL display, copy control, cloud-agent section, and connected local-agent count/list.

Existing local pattern to follow:

- `packages/os/tests/bootstrap-source.test.ts` for shell source contracts.
- `packages/os/tests/install-state.test.ts` for provision/detect-agent behavior.
- `packages/os/tests/install-edge-site-publisher.test.ts` and site snapshot tests for launcher HTML contracts.
- `packages/os/scripts/lib/cli-ui.ts`, `packages/os/scripts/install.ts`, and `packages/os/scripts/lib/install-state.ts` for existing installer UI/registry style.

New or changed tests:

- Update `packages/os/tests/bootstrap-source.test.ts` for yes/no dependency prompt copy and required progression labels.
- Update/add installer UI tests around `printOsBanner` state symbols and prompt copy helpers.
- Update `packages/os/tests/install-state.test.ts` for expanded agent detection fixtures.
- Add launcher onboarding render tests near the launcher/site publisher surface.

Focused red command:

```bash
bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-state.test.ts tests/install-edge-site-publisher.test.ts
```

Expected red failure:

- Tests should fail on old Enter dependency copy, old progression labels, missing agent registry entries, and missing launcher onboarding HTML/module.

## current status

- Task started from `stream/os` and initial read-only orientation is complete.
- `CODING-STANDARDS.md`, `AGENTS.md`, `packages/os/skills/senior-engineer/SKILL.md`, and `packages/os/skills/task/SKILL.md` were read before edits.
- Current implementation evidence: dependency pause is in `packages/os/scripts/bootstrap.sh`; interactive installer progress is in `packages/os/scripts/install.ts`; agent detection registry is in `packages/os/scripts/lib/install-state.ts`; launcher site publishing reads `$OS_HOME/sites/index.html` through `install-edge-site-publisher.ts`.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/cli-ui.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/installer-onboarding-ui.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/sites-cli.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-30 19:49:48 fs.write: `.task/os/installer-and-launcher-onboarding-ux-improvements/workpad.md`

## workspace-owned: validation evidence

- 2026-06-30 red: `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-state.test.ts tests/install-edge-site-publisher.test.ts tests/installer-onboarding-ui.test.ts tests/launcher-onboarding.test.ts` failed on missing `prompt_select`, missing installer progress exports, missing launcher module, and old agent registry coverage.
- 2026-06-30 green: `bun --cwd packages/os test scripts/compact-daemon-output.test.ts scripts/install-tty.test.ts tests/bootstrap-source.test.ts tests/install-state.test.ts tests/install-edge-site-publisher.test.ts tests/installer-onboarding-ui.test.ts tests/launcher-onboarding.test.ts tests/sites-cli.test.ts` passed: 48 passed, 4 skipped.
- 2026-06-30 green: `bun --cwd packages/os typecheck` passed.
- 2026-06-30 20:04:18 `review.run`: passed — OK
- 2026-06-30 20:04:57 `review.run`: passed — OK
- 2026-06-30 20:05:10 `verify`: passed — OK
- 2026-06-30 20:06:55 `review.run`: passed — OK
- 2026-06-30 20:07:08 `verify`: passed — OK

## key decisions

- Keep changes inside `packages/os` because current repo evidence shows installer, agent detection, and launcher publishing are OS-owned.
- Treat `sites.consuelohq.com` as legacy and out of scope.

## notes for ko

- Full `bun --cwd packages/os test` still has unrelated broad-suite failures outside this change area; focused changed-surface tests and the OS review/verify gates pass.

## improvements noticed

- none yet

## issues and recovery

- `context.search` is referenced by the OS task skill but is not present in the current workspace manifest. Call failed with `NOT_FOUND`, trace `trc_12c932d96e9c`; discovery continued with `explore` and targeted `fs.search`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-30 19:49:48 write: `.task/os/installer-and-launcher-onboarding-ux-improvements/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/compact-daemon-output.test.ts`
- `packages/os/scripts/install-tty.test.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/installer-onboarding-ui.test.ts`
- `packages/os/tests/sites-cli.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/installer-and-launcher-onboarding-ux-improvements/current.json`, `.task/os/installer-and-launcher-onboarding-ux-improvements/evidence-log.json`, `.task/os/installer-and-launcher-onboarding-ux-improvements/read-log.json`, `.task/os/installer-and-launcher-onboarding-ux-improvements/session.json`, `.task/os/installer-and-launcher-onboarding-ux-improvements/verify.json`, `.task/os/installer-and-launcher-onboarding-ux-improvements/workpad.md`, `.task/tasks/os/installer-and-launcher-onboarding-ux-improvements.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/cli-ui.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/launcher-onboarding.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/installer-onboarding-ui.test.ts`, `packages/os/tests/launcher-onboarding.test.ts`, `packages/os/tests/sites-cli.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
