# install full os tool manifest into user home

branch: `task/os-skills/install-full-os-tool-manifest-into-user-home`
stream: `stream/os-skills`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/765/install-full-os-tool-manifest-into-user-home
github pr: https://github.com/consuelohq/opensaas/pull/765
started: 2026-06-05

## acceptance criteria

- [ ] Install every active bundled OS tool from the generated full manifest into the user OS home.
- [ ] Keep core-vs-raw as a visibility/search/steering distinction, not an install distinction.
- [ ] Create `~/.consuelo/os/tools/tools.json` from the full manifest.
- [ ] Create per-tool bundled ownership metadata under `~/.consuelo/os/tools/<name>/.consuelo-tool.json`.
- [ ] Create stable wrappers under `~/.consuelo/os/bin/<name>` for both core and non-core tools.
- [ ] Preserve local/user tools that are not bundled-owned.
- [ ] Keep skill install/onboarding behavior independent from tool install.
- [ ] Add focused tests and run OS install/manifest validation before push.

## plan

1. Read current install state, full/core manifest, tool-runner, OS call CLI, and tests.
2. Add red tests proving full-manifest tool installation, wrapper creation, local preservation, and core/raw distinction.
3. Implement `seedBundledTools()` beside `seedBundledSkills()`.
4. Install tools automatically from the generated full manifest during `provisionLocalOs()`.
5. Validate install-state tests, tool manifest tests, skills registry tests, syntax, diff, review, and verify.

## test-first contract

Behavior under test:

- `provisionLocalOs()` creates `tools`, `tools/tools.json`, per-tool metadata, and bin wrappers.
- Installed tool count matches the generated full manifest tool count, not the smaller core manifest count.
- Non-core/raw tools such as `browser.open`, `railway.logs`, and `get_raw_steering` are installed.
- Core tools such as `status` are installed too.
- Local tools without bundled metadata are preserved and included in the installed registry.
- `selectedSkills` only affects skills; tools install regardless of onboarding skill selection.

Existing pattern to follow:

- `seedBundledSkills()` owns materialization, metadata, hash/preservation, and installed registry writing inside `install-state.ts`.
- `packages/os/manifests/tool.manifest.json` is the generated canonical full manifest from prior `os-manifest` work.
- `packages/os/manifests/core.manifest.json` is for steering/default visibility only.
- `scripts/tool-runner.ts` is the generic facade tool runner.
- `scripts/os.ts call` is the OS skill call runner.

Focused red command:

```bash
bun --cwd packages/os test tests/install-state.test.ts
```

Expected red failure:

- Current install creates `scripts` but not `tools`.
- Current install does not write `tools/tools.json`, per-tool metadata, or bin wrappers.
- Current install does not materialize non-core/raw tools from the full manifest.

No-test waiver:

- None.

## current status

- Task started from `stream/os-skills`.
- Exploration confirms full manifest exists and contains 133 tools.
- Implementation approved by Ko.

## files changed

- `.task/os-skills/install-full-os-tool-manifest-into-user-home/workpad.md`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/install-state.test.ts`

## workspace-owned: files changed

- `.task/os-skills/install-full-os-tool-manifest-into-user-home/workpad.md`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/install-state.test.ts`

## workspace-owned: activity log

- 2026-06-05 03:15:53 fs.write: `.task/os-skills/install-full-os-tool-manifest-into-user-home/workpad.md`
- 2026-06-05 03:16:59 fs.write: `packages/os/tests/install-state.test.ts`
- 2026-06-05 03:18:04 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-05 03:18:42 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-05 03:19:05 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-05 03:19:28 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-05 03:24:54 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-05 03:25:22 fs.patch: `packages/os/scripts/lib/install-state.ts`
- Loaded stream/task context.
- Read OS install state, bootstrap, package scripts, manifest loader, tool runner, generated full manifest, and install tests.

## workspace-owned: validation evidence

- 2026-06-05 03:26:27 `review.run`: passed — OK
- 2026-06-05 03:26:41 `verify`: passed — OK

## key decisions

- Full manifest is the install source of truth.
- Core manifest is a steering/default visibility subset, not the installed tool set.
- Wrappers route facade tools through `scripts/tool-runner.ts` and OS skills through `scripts/os.ts call`.

## notes for ko

- Tools are installed automatically; onboarding remains skill-focused.

## improvements noticed

- Future task: installed runtime can prefer `~/.consuelo/os/tools/tools.json` for server registry reads once the local server fully separates runtime from source.

## issues and recovery

- First `task.start` input used the literal stream branch for `startFrom`; schema expects `stream`, so I retried correctly.
- Root worktree is dirty from other work, so all edits stay isolated in the task worktree.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): install full tool manifest" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/manifests/manifest.config.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/tool-runner.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tooling/tool-manifest.json`

- 2026-06-05 03:25:22 patch lines 784-787: `packages/os/scripts/lib/install-state.ts`

## workspace-owned: test selection

- changed files: `.task/os-skills/install-full-os-tool-manifest-into-user-home/current.json`, `.task/os-skills/install-full-os-tool-manifest-into-user-home/evidence-log.json`, `.task/os-skills/install-full-os-tool-manifest-into-user-home/read-log.json`, `.task/os-skills/install-full-os-tool-manifest-into-user-home/session.json`, `.task/os-skills/install-full-os-tool-manifest-into-user-home/workpad.md`, `.task/tasks/os-skills/install-full-os-tool-manifest-into-user-home.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/tests/install-state.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
