# make experimental macos host optional in runtime publish

branch: `task/os/make-experimental-macos-host-optional-in-runtime-publish`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2584
started: 2026-09-25

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: core runtime publication succeeds with the experimental macOS service-host disabled by default; when explicitly enabled, Developer ID signing/notarization credentials remain mandatory and failures block publication.
existing local pattern: packages/os/tests/distribution/release-channel-workflows.test.ts parses workflow YAML and asserts job dependencies, credentials, and publication behavior.
new or changed tests: assert an explicit opt-in gate on macos-service-host, downstream plan/build tolerate the skipped optional job, and macOS artifact downloads are conditional on enablement while credential fail-closed checks remain present.
focused red command: bun test packages/os/tests/distribution/release-channel-workflows.test.ts
expected red failure: current workflow has no opt-in gate and unconditionally requires/downloads macOS service-host artifacts.
no-test waiver: not applicable

- 2026-09-25 17:29:10 append: `.task/os/make-experimental-macos-host-optional-in-runtime-publish/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-25 17:29:10 fs.write: `.task/os/make-experimental-macos-host-optional-in-runtime-publish/workpad.md`
- 2026-09-25 17:30:43 fs.write: `.task/os/make-experimental-macos-host-optional-in-runtime-publish/workpad.md`
- 2026-09-25 17:31:07 fs.write: `.task/os/make-experimental-macos-host-optional-in-runtime-publish/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`

- 2026-09-25 17:30:16 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-09-25 17:30:43 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
## Red result

Focused regression failed before production edit as expected: `macos-service-host.if` was undefined; 7 tests passed and the new workflow contract failed at the missing opt-in gate.

- 2026-09-25 17:30:43 append: `.task/os/make-experimental-macos-host-optional-in-runtime-publish/workpad.md`

## Green result

Focused release workflow contract passes: 8 tests, 161 assertions. The runtime bundler does not require the macOS service-host binary, and macOS daemon generation already falls back to the legacy shell launch contract when the binary is absent.

- 2026-09-25 17:31:07 append: `.task/os/make-experimental-macos-host-optional-in-runtime-publish/workpad.md`

## workspace-owned: validation evidence

- 2026-09-25 17:31:23 `review.run`: passed — OK
- 2026-09-25 17:31:36 `verify`: passed — OK
