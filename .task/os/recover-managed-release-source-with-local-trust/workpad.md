# recover managed release source with local trust

branch: `task/os/recover-managed-release-source-with-local-trust`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2421
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

- 2026-09-08 15:02:51 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-09-08 15:03:03 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
RED evidence: canonical `tests/test-source-safety.test.ts` passed. Focused lifecycle run produced 1 failure / 11 passes. The new local-trust + no-release-env + valid managed startup metadata case invoked the lifecycle child with `https://install.consuelohq.com/os/releases` and `gcpAuth: null` instead of the metadata-provided private GCS base and `gcpAuth: "1"`. The ordinary local-trust + metadata-unavailable control passed, isolating the failure to missing managed release-source recovery.

- 2026-09-08 15:03:54 append: `.task/os/recover-managed-release-source-with-local-trust/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 15:03:54 fs.write: `.task/os/recover-managed-release-source-with-local-trust/workpad.md`
- 2026-09-08 15:06:09 fs.write: `.task/os/recover-managed-release-source-with-local-trust/workpad.md`

## workspace-owned: files read

- none yet

## implementation and validation

- Root cause confirmed: Linux systemd persists only `CONSUELO_HOME`, so an already-valid managed-cloud trust file can survive while `CONSUELO_RELEASE_BASE_URL` and metadata-auth mode disappear.
- Extracted the fixed GCE startup-script reader/parser so it is reusable by both trust-bootstrap and source-recovery paths. Optional source recovery uses a bounded 750ms `AbortController` probe; network/non-OK metadata means “not managed cloud” and falls back to the public default, while a present Consuelo managed-source assignment is validated strictly.
- With safe local trust and no explicit release base, valid startup metadata must contain both release-base and public-key assignments. The public-key map is validated as managed Consuelo metadata but does not overwrite the already-trusted local key file. A strict HTTPS `storage.googleapis.com/<bucket>` base enables GCP metadata auth for the lifecycle child.
- Present malformed/partial/untrusted managed release metadata fails closed. Ordinary stale desktop/local nodes with unavailable/no managed metadata remain on `https://install.consuelohq.com/os/releases` with no GCP auth.
- Existing explicit GCS + inherited-auth retry behavior from #2418 and Bun executable resolution from #2413 remain intact.
- Canonical source-safety preflight passed after final test edits.
- Focused lifecycle GREEN: 13/13 passed, including managed source recovery, desktop fallback, untrusted source fail-closed, historical Bun resolution, exact-version/injection rejection, compatible typed path, and revoked denial.
- Affected Device Authority/auth/session boundary: 10 files / 158 tests passed, 0 failed.
- Device Authority Worker dry-run passed; bundle 625.81 KiB / 127.02 KiB gzip.
- Structured diff is limited to `mcp-proxy.ts`, routing tests, and workspace-owned task metadata/logs.

- 2026-09-08 15:06:09 append: `.task/os/recover-managed-release-source-with-local-trust/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 15:06:34 `review.run`: passed — OK
- 2026-09-08 15:06:49 `verify`: passed — OK
