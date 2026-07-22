# add unified os release command

branch: `task/os/add-unified-os-release-command`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1019/add-unified-os-release-command
github pr: https://github.com/consuelohq/opensaas/pull/1019
started: 2026-06-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release.ts`

## workspace-owned: files changed

- `package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release.ts`

## workspace-owned: activity log

- 2026-06-13 16:08:13 fs.write: `.task/os/add-unified-os-release-command/workpad.md`
- 2026-06-13 16:08:51 fs.write: `packages/workspace/scripts/os-release-device-auth.ts`
- 2026-06-13 16:09:04 fs.write: `packages/workspace/scripts/os-release.ts`
- 2026-06-13 16:10:00 fs.patch: `package.json`
- 2026-06-13 16:10:41 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-06-13 16:16:45 fs.write: `.task/os/add-unified-os-release-command/workpad.md`

## workspace-owned: validation evidence

- 2026-06-13 16:14:33 `review.run`: passed — OK
- 2026-06-13 16:15:42 `review.run`: passed — OK
- 2026-06-13 16:16:17 `verify`: passed — OK
- 2026-06-13 16:16:54 `verify`: passed — OK

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

## workspace-owned: files read

- `package.json`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release-install.ts`
- `packages/workspace/scripts/os-release.ts`

## acceptance criteria

- Add a single root `bun run os:release` command that releases both hosted OS surfaces.
- Keep `bun run os:release-install` as the installer-only command.
- Add `bun run os:release-device-auth` for the `os.consuelohq.com` Worker.
- Update `packages/workspace/SCRIPTS.md` so the operator path is discoverable.
- Validate the new scripts in dry-run/verify-only modes where practical.

## test-first contract

Behavior under test:

- `os:release-device-auth -- --dry-run` runs Wrangler from `packages/os/cloudflare/os-device-authority` without mutating production.
- `os:release-device-auth -- --verify-only` checks the live health and hardened missing-key contract.
- `os:release -- --dry-run` delegates install release dry-run and device authority dry-run in order.

Existing pattern:

- `packages/workspace/scripts/os-release-install.ts` owns hosted installer release.
- Root `package.json` exposes operator release scripts.
- `packages/workspace/SCRIPTS.md` documents operator scripts.

Focused red command:

`bun run os:release-device-auth -- --help`

Expected red failure before implementation:

The root script is missing.

- 2026-06-13 16:08:13 append: `.task/os/add-unified-os-release-command/workpad.md`

- 2026-06-13 16:08:51 write: `packages/workspace/scripts/os-release-device-auth.ts`

- 2026-06-13 16:09:04 write: `packages/workspace/scripts/os-release.ts`

- 2026-06-13 16:10:00 patch lines 296-296: `package.json`

- 2026-06-13 16:10:41 patch lines 65-85: `packages/workspace/SCRIPTS.md`

## workspace-owned: test selection

- changed files: `.task/os/add-unified-os-release-command/current.json`, `.task/os/add-unified-os-release-command/evidence-log.json`, `.task/os/add-unified-os-release-command/read-log.json`, `.task/os/add-unified-os-release-command/session.json`, `.task/os/add-unified-os-release-command/verify.json`, `.task/os/add-unified-os-release-command/workpad.md`, `.task/tasks/os/add-unified-os-release-command.json`, `package.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/scripts/os-release-device-auth.ts`, `packages/workspace/scripts/os-release.ts`
- matched rules: `workspace-audit-docs`
- selected suites: `workspace audit tests`
- run results: `workspace audit tests` passed
- failed suites: none

## implementation summary

- Deployed the current `os.consuelohq.com` device authority Worker directly from `packages/os/cloudflare/os-device-authority`.
- Added `bun run os:release-device-auth` for the OS device approval authority Worker.
- Added `bun run os:release` as the default wrapper for both public OS surfaces.
- Kept `bun run os:release-install` as the installer-only release command.
- Updated `packages/workspace/SCRIPTS.md` and root `package.json`.

## validation evidence

- Live device authority deploy: `trc_525a6deef183` — Worker version `72b0ad87-1676-4757-ad07-3e7b4591231e`.
- Live health check: `trc_45dd1ef6082c` — `/health` returned ok.
- Live hardening check: `trc_dcc6f3d50cc2` — missing public key returns `device_public_key_required`.
- Red script check: `trc_c8dd8a99967c` — `os:release-device-auth` missing before implementation.
- Help checks: `trc_ebaf4a4b7b3f`, `trc_5cc0779ca4da`.
- Device authority verify-only: `trc_c6e05b437f74`.
- Device authority dry-run: `trc_de3a1f86085f`.
- Unified release dry-run: `trc_e68c30c4f7b9`.
- OS syntax/typecheck: `trc_2019cc93b613`.
- Review gate: `trc_eecf9c9d4ae8` — 0 blocking issues.
- Verify gate: `trc_8e844d5c3d19` — publish-valid, workspace audit test passed.

- 2026-06-13 16:16:45 append: `.task/os/add-unified-os-release-command/workpad.md`
