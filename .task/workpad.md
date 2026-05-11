# align os manifest and script runtime

branch: `task/os/align-os-manifest-and-script-runtime`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/364
started: 2026-05-11

## acceptance criteria

- [x] Keep `scripts/` as the OS runtime/runbook implementation layer.
- [x] Move `daily-revenue-brief` to `packages/os/scripts/revenue/daily-revenue-brief.ts`.
- [x] Make `packages/os/tooling/tool-manifest.json` the default revenue/business agent map.
- [x] Preserve the restored workspace/operator typed facade registry in `packages/os/tooling/dev-tool-manifest.json`.
- [x] Retarget copied operator facade generation/execution to `dev-tool-manifest.json`.
- [x] Validate get_steering, get_dev_steering, call, and restored operator facade behavior.

## plan

1. Read steering, decision, manifest, runtime, docs, and moved script paths through the workspace Bun facade.
2. Align manifests and runtime paths without deleting operator capabilities.
3. Regenerate operator docs/types from the dev/operator manifest.
4. Run smoke commands and focused syntax checks.
5. Record product friction from dogfooding the workspace scripts.

## files changed

- packages/os/tooling/tool-manifest.json
- packages/os/tooling/runbook-manifest.json (removed)
- packages/os/scripts/revenue/daily-revenue-brief.ts
- packages/os/runbooks/daily-revenue-brief.ts (moved)
- packages/os/scripts/os.ts
- packages/os/scripts/lib/manifest.ts
- packages/os/scripts/lib/facade/executor.ts
- packages/os/scripts/generate-docs.ts
- packages/os/scripts/generate-types.ts
- packages/os/server.py
- packages/os docs/steering pages that referenced the old runbook manifest

## key decisions

- `tool-manifest.json` is now the default business/revenue AI-agent manifest.
- `dev-tool-manifest.json` remains the restored dev/operator typed facade registry.
- Runtime implementation stays in Bun scripts; the manifest exposes agent-facing discovery metadata rather than owning runtime behavior.
- `get_dev_steering` continues returning the original workspace steering/decision/tool manifest with a short OS preface.

## notes for ko

- I initially used direct shell/apply_patch for the file move and first edits; after your reminder I switched back to the Bun workspace facade for reads/searches/workpad updates/validation.
- The generated operator docs/types now read from `dev-tool-manifest.json`, so shrinking `tool-manifest.json` no longer breaks the copied facade.

## improvements noticed

- Decision engine evidence appears rooted in the controller checkout/global ledger rather than this task worktree, so `decideNext` and `confidenceScore` kept reporting stale failed validation evidence. OS should isolate decision evidence by taskSession/worktree.
- The raw Bun bridge requires `taskSession` inside each batch child input; native MCP propagation is cleaner. This is worth preserving/improving for the productized OS.
- `status` with a raw `taskSession` input reported root `main` state instead of the task worktree, while `task.exec git status` worked. That mismatch should be tightened.
- `fs.patch` correctly rejected multiline inline content and required `--content-file`; that guardrail is useful for productized file edits.

## errors i ran into

- One `rg` search returned `COMMAND_FAILED` only because no matches were found; I reran with `|| true` and confirmed old runbook-manifest references were gone.
- `decideNext`/`confidenceScore` were not useful for this fresh OS package diff because of stale evidence and missing task-local indexing.

## validation

- `cd packages/os && bun ./scripts/os.ts get-steering | rg ...` passed and showed the raw default manifest with `scripts/revenue/daily-revenue-brief.ts`.
- `cd packages/os && bun ./scripts/os.ts get-dev-steering | rg ...` passed and showed the original workspace tool manifest plus `fs.read` and Consuelo Design entries.
- `cd packages/os && bun ./scripts/os.ts call '{"name":"daily-revenue-brief"}'` passed with structured `ok: true`, permission `read`, and `graphqlStatus: missing_env`.
- `python3 -m py_compile packages/os/server.py` passed.
- `cd packages/os && bun ./scripts/workspace.ts fs.read ...` passed, proving the restored operator facade still reads through `dev-tool-manifest.json`.
- `workspace check-files` passed for touched TS files.
- `workspace review.run` against `origin/stream/os` with `noTests: true` passed with no `yours` or `preExisting` findings after hardening the copied `os.ts` call path.
- `cd packages/workspace && bun ./scripts/verify.js --base origin/stream/os --no-db --json` passed from inside the task worktree; DB checks were intentionally skipped because this task has no DB/migration changes.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-11 10:01:07 patch lines 8-33: `.task/workpad.md`
- 2026-05-11 10:01:57 patch lines 8-61: `.task/workpad.md`
- 2026-05-11 10:02:51 patch lines 5-6: `packages/os/scripts/revenue/daily-revenue-brief.ts`
- 2026-05-11 10:02:56 patch lines 6-6: `packages/os/scripts/revenue/daily-revenue-brief.ts`
- 2026-05-11 10:03:23 patch lines 65-70: `.task/workpad.md`
- 2026-05-11 10:12:41 patch lines 104-107: `packages/os/scripts/os.ts`
- 2026-05-11 10:13:04 patch lines 121-123: `packages/os/scripts/os.ts`
- 2026-05-11 10:13:40 patch lines 71-71: `.task/workpad.md`