# canonical tool packages and generated manifests

branch: `task/os-distribution/canonical-tool-packages-and-generated-manifests`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1561/canonical-tool-packages-and-generated-manifests
github pr: https://github.com/consuelohq/opensaas/pull/1561
started: 2026-07-22

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `.tmp/worker26-final-push-files.json` (deleted)
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/artifacts-skill.test.ts`

## workspace-owned: files changed

- `.tmp/worker26-final-push-files.json` (deleted)
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/artifacts-skill.test.ts`

## workspace-owned: activity log

- 2026-07-22 22:14:29 fs.trash: `.tmp/worker26-final-push-files.json`
- 2026-07-22 22:15:23 fs.write: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/review-disposition-codex.json`
- 2026-07-22 22:15:53 fs.trash: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/review-disposition-codex.json`
- 2026-07-22 22:24:18 fs.write: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/workpad.md`
- 2026-07-22 22:25:23 fs.write: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/workpad.md`
- 2026-07-22 22:29:27 fs.write: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/workpad.md`

## workspace-owned: validation evidence

- 2026-07-22 22:24:33 `review.run`: passed — OK
- 2026-07-22 22:24:48 `verify`: passed — OK
- 2026-07-22 22:29:40 `review.run`: passed — OK
- 2026-07-22 22:29:55 `verify`: passed — OK

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
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/task-push.js`

- 2026-07-22 22:28:54 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- CI head `77274ecd` cleared Linux but exposed the complementary Windows case: the generic `C:\\Users\\...` detector matched a source-root prefix inside the benign `${sourceRoot}-map` URL. Extracted `containsMachineSpecificAbsolutePath`, preserved foreign Windows absolute paths independent of host OS, tested native and normalized root candidates with explicit separator boundaries, removed already-evaluated source-root literals before generic machine-path scanning, and added Unix/Windows contract cases. Runtime-bundle suite passed 15/15 (`trc_fc78db3297cd`); complete worker matrix passed 46 files / 240 tests plus drift and syntax/typecheck (`trc_2bae22803a01`).

- 2026-07-22 22:29:27 append: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/workpad.md`
