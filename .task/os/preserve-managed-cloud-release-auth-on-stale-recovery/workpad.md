# preserve managed cloud release auth on stale recovery

branch: `task/os/preserve-managed-cloud-release-auth-on-stale-recovery`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2418
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

## Acceptance criteria

- [ ] Retry recovery on a stale managed-cloud node remains authenticated when local trusted release keys already exist and the release base is the authenticated GCS bucket.
- [ ] Local non-GCS/custom release sources do not gain GCP metadata auth accidentally.
- [ ] Recovery trust validation and Bun executable resolution from PR #2413 remain intact.
- [ ] Focused tests, review, and full verify pass before promotion.

## Test-first contract

behavior under test: if stale recovery reuses an existing safe `trusted-release-keys.json` and `CONSUELO_RELEASE_BASE_URL` points at the managed authenticated GCS release origin, the lifecycle child receives `CONSUELO_RELEASE_GCP_METADATA_AUTH=1`; equivalent local/custom trusted origins do not.
existing local pattern: metadata-backed first recovery sets `gcpMetadataAuth=true` only in the branch that fetches startup-script metadata; the existing-local-trust branch leaves it false and the child env explicitly deletes the auth flag.
new or changed tests: extend the existing local-trust execution coverage with a managed GCS retry case and a non-GCS control case.
focused red command: run the stale lifecycle local-trust tests in `workspace-node-registry-routing.test.ts` after adding the retry assertion.
expected red failure: managed GCS retry records no metadata-auth flag even though local trust is safe and the release base still requires GCP metadata-token auth.
no-test waiver: not applicable.

## Review source

- Codex P1 on stream PR #2411, comment 3959171990: preserve GCP auth when reusing local trust for authenticated GCS retries.

- 2026-09-08 14:51:12 append: `.task/os/preserve-managed-cloud-release-auth-on-stale-recovery/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 14:51:12 fs.write: `.task/os/preserve-managed-cloud-release-auth-on-stale-recovery/workpad.md`
- 2026-09-08 14:56:09 fs.write: `.task/os/preserve-managed-cloud-release-auth-on-stale-recovery/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/managed-cloud-node.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

## workspace-owned: validation evidence

- 2026-09-08 14:55:05 `review.run`: passed — OK
- 2026-09-08 14:55:20 `verify`: passed — OK

## Validation evidence

- RED: managed GCS retry with safe local trust inherited `CONSUELO_RELEASE_GCP_METADATA_AUTH=1`, but the recovery bootstrap deleted it before invoking lifecycle; non-GCS control remained correctly unauthenticated (trace `trc_413bfafda1de`).
- Implementation: after validating the release URL, inherited metadata auth is preserved only when it was explicitly `1` and the release source is strict `https://storage.googleapis.com/<bucket...>` with no port, query, credentials, or fragment. Arbitrary/custom origins still lose the flag.
- Focused GREEN: managed GCS retry + non-GCS control both pass (trace `trc_7375f4bedb75`).
- Related routing/recovery suite: 67/67 pass, including the Bun executable-resolution coverage from PR #2413 (trace `trc_9c16471be6ea`).
- Strict review: 0 issues / 0 blockers (trace `trc_2529b4ac74c0`). The MCP docs opportunity is non-blocking and not user-visible; this is internal stale-node recovery parity.
- Full verify: passed, `publishValid=true` (trace `trc_39441de0129f`).

## Acceptance checklist

- [x] Managed GCS retries preserve metadata-token auth when reusing safe local trust.
- [x] Non-GCS/custom trusted sources do not inherit GCP metadata auth.
- [x] Trust validation and Bun resolution remain intact.
- [x] Focused + related tests, review, and full verify pass.

- 2026-09-08 14:56:09 append: `.task/os/preserve-managed-cloud-release-auth-on-stale-recovery/workpad.md`
