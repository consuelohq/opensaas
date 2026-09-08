# preserve gcp auth on stale lifecycle retry

branch: `task/os/preserve-gcp-auth-on-stale-lifecycle-retry`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2417
started: 2026-09-08

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

behavior under test: stale lifecycle recovery retries must preserve the infrastructure authentication mode required by an already-selected authenticated GCS release base. If local trusted keys already exist and `CONSUELO_RELEASE_BASE_URL` is the validated managed-cloud `storage.googleapis.com/<bucket>` origin, the fixed bootstrap must set `CONSUELO_RELEASE_GCP_METADATA_AUTH=1` for the historical lifecycle child without re-fetching startup metadata. Public/default release origins must not gain GCP metadata auth. Existing local-trust validation, metadata fallback, caller-input restrictions, revocation, and executable resolution remain unchanged.
existing local pattern: the missing-trust branch validates the exact GCP release origin, recovers public keys from fixed startup metadata, persists trust, and sets `gcpMetadataAuth=true`. The local-trust branch currently initializes `gcpMetadataAuth=false` and later deletes `CONSUELO_RELEASE_GCP_METADATA_AUTH`, so a retry against an already-authenticated GCS base loses the token provider.
new or changed tests: extend the local-trust mocked child test with a validated GCS base and assert `gcpAuth: "1"` while metadata fetch remains forbidden; retain the existing public/default local-trust case asserting `gcpAuth: null`. Add/retain invalid origin and private-key fail-closed cases.
focused red command: `bun x vitest run tests/workspace-node-registry-routing.test.ts -t lifecycle` after canonical `tests/test-source-safety.test.ts` preflight.
expected red failure: the GCS + existing-local-trust retry child receives no `CONSUELO_RELEASE_GCP_METADATA_AUTH` because production only enables it in the missing-trust metadata branch.
no-test waiver: not applicable.

RED evidence: canonical source-safety preflight passed after final test edits. Focused lifecycle run produced 2 failures / 10 passes. The valid local-trust + private GCS retry received `gcpAuth: null` instead of `"1"`; the invalid local-trust + public release origin with `CONSUELO_RELEASE_GCP_METADATA_AUTH=1` incorrectly ran the lifecycle child instead of failing closed. This proves both the retry bug and the token-origin boundary before production edits.

## plan

1. Verify how the historical/current release source consumes `CONSUELO_RELEASE_GCP_METADATA_AUTH` and the exact origin constraints already enforced for GCP recovery.
2. Add the local-trust GCS retry test and capture RED.
3. Derive `gcpMetadataAuth` from the validated selected release origin when local trust exists; do not re-read metadata or broaden accepted hosts.
4. Run focused GREEN, full affected Device Authority/auth/session boundary, Worker dry-run, strict review, and formal verify.
5. Publish #2417 into `stream/os`, repin #2411 to the new combined head, require fresh exact-head CI/review, then continue main/deploy/live cloud acceptance.

## implementation and validation

- Historical/current lifecycle confirms `CONSUELO_RELEASE_GCP_METADATA_AUTH=1` directly installs the GCP metadata authorization provider for the selected release base.
- Production now initializes retry auth state from the existing node environment, but permits it only when the selected URL satisfies the same strict managed-cloud predicate already used by metadata recovery: HTTPS `storage.googleapis.com`, no credentials/port/query/hash, and a non-empty bucket path.
- Missing-trust metadata recovery still forces GCP auth after validating the infrastructure-owned startup metadata. Public/default release origins remain unauthenticated; a stray GCP auth flag on any non-managed-cloud origin fails closed before the lifecycle child.
- Canonical source-safety preflight passed after final test edits.
- Focused lifecycle GREEN: 12/12 passed, including valid GCS retry auth preservation and invalid-origin fail-closed coverage.
- Affected Device Authority/auth/session boundary: 10 files / 157 tests passed, 0 failed.
- Device Authority Worker dry-run passed; bundle 624.09 KiB / 126.74 KiB gzip.
- Structured diff is limited to `mcp-proxy.ts`, routing tests, and workspace-owned task metadata/logs.

- 2026-09-08 14:51:07 append: `.task/os/preserve-gcp-auth-on-stale-lifecycle-retry/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 14:51:07 fs.write: `.task/os/preserve-gcp-auth-on-stale-lifecycle-retry/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/scripts/lib/managed-cloud-node.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 14:52:25 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-09-08 14:52:51 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-09-08 14:53:23 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 14:54:14 apply-patch: `.task/os/preserve-gcp-auth-on-stale-lifecycle-retry/workpad.md`
- 2026-09-08 14:54:26 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`

- 2026-09-08 14:55:14 apply-patch: `.task/os/preserve-gcp-auth-on-stale-lifecycle-retry/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 14:56:01 `review.run`: passed — OK
- 2026-09-08 14:56:33 `verify`: passed — OK
