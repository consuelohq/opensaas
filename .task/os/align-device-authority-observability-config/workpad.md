# align device authority observability config

branch: `task/os/align-device-authority-observability-config`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1919/align-device-authority-observability-config
github pr: https://github.com/consuelohq/opensaas/pull/1919
started: 2026-08-13

## acceptance criteria

- [x] Mirror the Cloudflare dashboard observability settings for `consuelo-os-device-authority` in `wrangler.toml` so future deploys preserve the manually enabled behavior.
- [x] Keep logs and traces enabled at 100% head sampling for Branch 8 Canary acceptance.
- [x] Persist Worker logs and traces in the Workers dashboard and include invocation logs.
- [x] Do not touch secrets, bindings, routes, or unrelated Worker behavior.
- [x] Validate Wrangler parsing/deploy dry-run and inspect the focused diff; stream promotion is the remaining publish step.

## plan

1. Compare the repo Wrangler config with the exact Cloudflare-generated observability JSON Ko enabled in the dashboard.
2. Make the smallest TOML-only change needed to represent those settings.
3. Run a Wrangler dry-run and diff/static validation.
4. Push and promote the task into `stream/os`, then clean up the task.

## Test-first contract

- Behavior under test: a future Wrangler deployment must preserve the manually enabled Cloudflare Workers Logs/Traces persistence and invocation-log settings.
- Existing local pattern: `packages/os/cloudflare/os-device-authority/wrangler.toml` already owns the Device Authority deployment configuration and Branch 7 already added nested observability tables there.
- Test decision: no new unit test. This is a declarative TOML-only deployment-config synchronization; the meaningful proof is Wrangler's own config parser/deploy dry-run plus exact diff inspection.
- No-test waiver: adding an application/unit test would duplicate Wrangler's parser without proving Cloudflare accepts the config. Replacement validation is `wrangler deploy --dry-run`, config reread, and `git diff --check`/structured diff inspection.

## current status

- Config is updated locally to match the Cloudflare-generated settings Ko enabled manually. Wrangler dry-run accepts the TOML and `git diff --check` is clean. Strict review attributes 0 issues/blockers to this task. Full verify reaches a clean review and DB guard but is not publish-valid because the pre-existing noncritical whole `@consuelo/os package test` fails; stream promotion remains.

## files changed

- `packages/os/cloudflare/os-device-authority/wrangler.toml`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-13 21:18:54 `review.run`: passed — OK
- 2026-08-13 21:27:04 `verify`: failed — COMMAND_FAILED

## key decisions

- Treat Wrangler as the durable source of truth. The dashboard change is correct for immediate runtime behavior, but repo config must mirror it before Branch 8 or a later deploy can safely own the setting.
- Preserve the Cloudflare-generated top-level `observability.enabled = false` exactly while explicitly enabling nested logs/traces; do not infer a different parent value.

## notes for ko

- This task does not redeploy the Worker or touch the secret values. It only makes the repo configuration durable so the next deployment preserves the dashboard settings.
- Ko explicitly approved publishing this config-only task despite the unrelated noncritical whole-OS verify failure. The focused Wrangler/config validation, task-attributed review, and DB guard are clean.

## improvements noticed

- none yet

## issues and recovery

- First `fs.apply_patch` workpad call used the wrong field name (`patch` instead of `patchText`) and returned a validation error. Retried once with the typed schema and succeeded; no repo content was lost.
- The typed `verify` facade hit repeated transient MCP connection failures. Fallback execution of the same verify script completed and showed the task's review + DB guard pass, with failure only in the existing noncritical whole OS package suite (including unrelated facade/runtime-bundle failures).
- That verify run regenerated an unrelated facade snapshot. It was inspected and restored from the task base before publish; it is not part of this change.
- The container fallback could not enter the host task worktree (`ENOENT`), so validation stayed on the workspace task surface once connectivity recovered.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/wrangler.toml`

- 2026-08-13 21:16:10 apply-patch: `.task/os/align-device-authority-observability-config/workpad.md`
- 2026-08-13 21:16:19 apply-patch: `packages/os/cloudflare/os-device-authority/wrangler.toml`

- 2026-08-13 21:16:49 apply-patch: `.task/os/align-device-authority-observability-config/workpad.md`

- 2026-08-13 21:27:56 apply-patch: `.task/os/align-device-authority-observability-config/workpad.md`

- 2026-08-13 21:30:31 apply-patch: `.task/os/align-device-authority-observability-config/workpad.md`