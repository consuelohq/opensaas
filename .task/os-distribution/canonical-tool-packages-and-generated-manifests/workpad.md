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
- `packages/os/tests/artifacts-skill.test.ts`

## workspace-owned: files changed

- `.tmp/worker26-final-push-files.json` (deleted)
- `packages/os/tests/artifacts-skill.test.ts`

## workspace-owned: activity log

- 2026-07-22 22:14:29 fs.trash: `.tmp/worker26-final-push-files.json`
- 2026-07-22 22:15:23 fs.write: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/review-disposition-codex.json`
- 2026-07-22 22:15:53 fs.trash: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/review-disposition-codex.json`
- 2026-07-22 22:24:18 fs.write: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/workpad.md`

## workspace-owned: validation evidence

- 2026-07-22 22:24:33 `review.run`: passed — OK
- 2026-07-22 22:24:48 `verify`: passed — OK

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
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/task-push.js`

- 2026-07-22 22:23:17 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- CI head `cbb9a40b` exposed a Linux-only runtime-bundle boundary failure in `Consuelo OS / native linux`: temporary source roots under `/tmp/<name>` contain two path segments, while `portableContent` enabled embedded-root detection only for three or more segments. The test therefore resolved instead of rejecting `${sourceRoot}/secret`. Changed the non-root guard from `>= 3` to `>= 2`; the exact runtime-bundle suite passed 14/14 (`trc_01a4a5fcb543`) and the complete worker matrix passed 46 files / 239 tests plus drift, syntax/typecheck, and raw steering (`trc_11de8691d38b`).

- 2026-07-22 22:24:18 append: `.task/os-distribution/canonical-tool-packages-and-generated-manifests/workpad.md`
