# Fix Workspace Edge D1 release credential boundary

branch: `task/os/fix-workspace-edge-d1-release-credential-boundary`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2081/fix-workspace-edge-d1-release-credential-boundary
github pr: https://github.com/consuelohq/opensaas/pull/2081
started: 2026-08-15

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

- 2026-08-15 19:11:27 fs.write: `.task/os/fix-workspace-edge-d1-release-credential-boundary/workpad.md`
- 2026-08-15 19:14:02 fs.write: `.task/os/fix-workspace-edge-d1-release-credential-boundary/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 19:13:39 `review.run`: passed — OK
- 2026-08-15 19:13:54 `verify`: passed — OK

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

behavior under test: production OS release must publish release-managed browser snapshots before Workspace Edge, and Workspace Edge D1 migration/deploy must run with a credential dedicated to that D1/Worker boundary instead of the release token that repeatedly fails with Cloudflare 7403.
existing local pattern: one release step exports CLOUDFLARE_OS_RELEASE_API_TOKEN as CLOUDFLARE_API_TOKEN for every child; os-release.ts currently runs install -> workspace-edge -> device-auth. A separate CLOUDFLARE_OS_PROVISIONING_API_TOKEN already exists in the same protected environment.
new or changed tests: update the production-release contract to require device-auth before workspace-edge and require CLOUDFLARE_WORKSPACE_EDGE_API_TOKEN with protected fallback to the provisioning token; require os-release.ts to override CLOUDFLARE_API_TOKEN only for the Workspace Edge child.
focused red command: bun packages/workspace/tests/website-deploy.test.js
expected red failure: current workflow has no Workspace Edge credential boundary and current orchestrator orders Workspace Edge before release-managed snapshots.
no-test waiver: not applicable.

Live evidence: main production releases 31902050690 and 31902956490 fail in Release Consuelo OS at Workspace Edge D1 migration with Cloudflare 7403, while local operator D1 migration succeeds and the same D1 is bound to both Device Authority and Workspace Edge.

- 2026-08-15 19:11:27 append: `.task/os/fix-workspace-edge-d1-release-credential-boundary/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-production-release.yaml`
- `packages/workspace/tests/website-deploy.test.js`

- 2026-08-15 19:13:02 apply-patch: `packages/workspace/scripts/os-release.ts`
- 2026-08-15 19:13:02 apply-patch: `.github/workflows/consuelo-production-release.yaml`
- 2026-08-15 19:13:13 apply-patch: `packages/workspace/tests/website-deploy.test.js`

## Validation

- RED: website deployment contract failed because current release had no Workspace Edge credential boundary (trace trc_4afda407df63).
- GREEN: focused release contract passes 3/3 after adding child-scoped Workspace Edge token override and workflow secret fallback (trace trc_59fb643c98d4).
- Strict review against origin/main: 0 issues / 0 blockers (trace trc_ae326caf7ca8).
- Formal verify against origin/main: passed=true, publishValid=true, DB guard clean (trace trc_2698583bd712).
- Device Authority/snapshot publication remains before Workspace Edge migration/deploy, so a future edge permission failure cannot strand authenticated users on an older immutable workspace snapshot.

- 2026-08-15 19:14:02 append: `.task/os/fix-workspace-edge-d1-release-credential-boundary/workpad.md`
