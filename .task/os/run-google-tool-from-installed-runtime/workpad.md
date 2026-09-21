# Run Google tool from installed runtime

branch: `task/os/run-google-tool-from-installed-runtime`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2212/run-google-tool-from-installed-runtime
github pr: https://github.com/consuelohq/opensaas/pull/2212
started: 2026-08-26

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 06:19:49 fs.write: `.task/os/run-google-tool-from-installed-runtime/workpad.md`
- 2026-08-26 06:21:11 fs.write: `.task/os/run-google-tool-from-installed-runtime/workpad.md`
- 2026-08-26 06:22:26 fs.write: `.task/os/run-google-tool-from-installed-runtime/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 06:21:36 `review.run`: passed — OK
- 2026-08-26 06:22:15 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- The native `google` facade tool must execute its package script from the installed Consuelo OS runtime root, regardless of the long-lived MCP process working directory.
- A canary-installed runtime containing `scripts/google.ts` must therefore make `google({action:"status"})` executable instead of returning `Script not found "google"`.

existing local pattern:
- `release` and `lifecycle` are runtime-owned package commands and declare `executionScope: "runtime"` in their handlers.
- The facade executor uses `entry.command.executionScope === "runtime" ? runtimePackageRoot : resolveWorkspaceCommandCwd(...)` when constructing `bun run <script>`.
- `google` is also runtime-owned but currently omits `executionScope`, so its command is resolved from the MCP process CWD (`/Users/kokayi/Dev/opensaas`) instead of the installed runtime package.

new or changed tests:
- Add a focused Google handler/facade contract asserting `google` declares runtime execution scope and builds/runs from the runtime package root even when caller CWD is elsewhere.

focused red command:
- `bun --cwd packages/os test tests/google-tool.test.ts`

expected red failure:
- Google handler command has no `executionScope: "runtime"` and therefore fails the new runtime-scope assertion.

no-test waiver: not applicable.

- 2026-08-26 06:19:49 append: `.task/os/run-google-tool-from-installed-runtime/workpad.md`

## workspace-owned: files read

- `packages/os/tests/google-tool.test.ts`

## current status

- Live 0.1.78 smoke reproduced `google({action:"status"})` -> `Script not found "google"` even though the signed runtime contains both the package script and `scripts/google.ts`.
- Root cause confirmed in facade executor: generic commands use caller/workspace cwd unless `command.executionScope === "runtime"`; `google` omitted that flag while `release` and `lifecycle` already use it.
- Test-first RED: new Google handler contract failed solely because `executionScope: "runtime"` was absent; 7 existing Google service tests remained green.
- Fix: add `executionScope: "runtime"` to the Google handler and regenerate full/core manifests plus TOOLS.md.
- Characterized baseline updated only for the new Google execution-scope field.
- GREEN: Google + manifest/layout packet passes 28/28 tests, 356 assertions.

- 2026-08-26 06:21:11 append: `.task/os/run-google-tool-from-installed-runtime/workpad.md`

## validation evidence

- Focused Google test RED reproduced the missing runtime execution scope.
- Focused GREEN: 28/28 Google + manifest/layout tests pass, 356 assertions.
- Strict review against `origin/main`: 0 blocking findings; 1 non-blocking tools-doc opportunity.
- Full repository verify against `origin/main`: `publishValid: true`, full mode, DB guard pass.

- 2026-08-26 06:22:26 append: `.task/os/run-google-tool-from-installed-runtime/workpad.md`
