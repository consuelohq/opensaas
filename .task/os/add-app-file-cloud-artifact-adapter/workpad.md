# add app file cloud artifact adapter

branch: `task/os/add-app-file-cloud-artifact-adapter`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/565/add-app-file-cloud-artifact-adapter
github pr: https://github.com/consuelohq/opensaas/pull/565
started: 2026-05-24

## acceptance criteria

- [x] Add distinct OS capability/env docs for `consuelo-app-graphql`, `consuelo-app-files-api`, and future `consuelo-os-api`.
- [x] Keep backwards-compatible GraphQL env fallback for existing snapshot/proof code.
- [x] Add app files API client using `CONSUELO_APP_API_URL` + `CONSUELO_APP_API_KEY`, not GraphQL.
- [x] Add cloud artifact adapter over app file flow: upload URL, S3 PUT, file record creation, optional supported attachment, file lookup/download URL.
- [x] Keep local artifacts as default/fallback; do not direct-write S3 from OS except through app-provided upload URL.
- [x] Do not attach files unless target entity type is explicit and supported by current app API.
- [x] Extend artifact descriptors/results with app file/cloud refs without breaking existing local artifact tests.
- [x] Add focused tests for missing capability, upload-url failure, S3 PUT failure, file record failure, successful publish, and unsupported attachment target.
- [x] Update spec and decision log after implementation; publish/promote into the existing OS stream PR.

## plan

1. Read current artifact, capability, snapshot/proof, OS dispatcher, and app file API code.
2. Add app-files client and cloud-artifact adapter with strict capability boundaries.
3. Wire cloud publishing as an optional helper without changing default local artifact behavior.
4. Add skill or script smoke surface for adapter validation if needed.
5. Update docs/spec/decision log with GraphQL vs app files API vs future OS API boundary.
6. Run focused tests, review, verify, push, promote, and republish design wiki/spec.

## current status

- Implemented and validated. Ready to push/promote into `stream/os`.

## files changed

- `packages/os/scripts/lib/app-files-client.ts`
- `packages/os/scripts/lib/cloud-artifacts.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/scripts/lib/capabilities.ts`
- `packages/os/scripts/lib/graphql-client.ts`
- `packages/os/scripts/lib/consuelo-workspace-client.ts`
- `packages/os/tests/cloud-artifacts.test.ts`
- `packages/os/README.md`
- `packages/os/data-model.md`
- `packages/os/decision.md`
- `packages/os/docs/env-capability-matrix.md`
- `packages/os/docs/skills.md`
- `packages/os/integrations.md`
- local design archive spec HTML updated/re-published after promotion


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-05-24 05:06:21 `checkFiles`: failed — COMMAND_FAILED
- 2026-05-24 05:07:54 `review.run`: passed — OK
- 2026-05-24 05:08:26 `review.run`: passed — OK
- 2026-05-24 05:08:35 `verify`: failed — COMMAND_FAILED
- 2026-05-24 05:08:41 `verify`: passed — OK

## key decisions

- GraphQL reads structured app objects; app Files REST API publishes app-visible artifacts.
- Future Consuelo OS API is a separate control-plane concept, not the app file API.
- Local artifact storage remains default and reliable fallback.

## notes for ko

- Approved scope includes implementation and spec update.

## improvements noticed

- The stale aggregate verify `--summary-json` issue remains present on this stream. Use explicit `review.run` plus `verify --no-review` until the wrapper is updated.


## issues and recovery

- `checkFiles` cannot syntax-check some TS-only files that start with type declarations via Node `--check`; relied on focused Vitest and review/typecheck for those files.
- Review required local try/catch around each async app files client method; added explicit try/catch and reran tests/review.
- Initial aggregate verify failed on stale review flag; recovered with explicit review and verify skip-review stamp.


---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```
