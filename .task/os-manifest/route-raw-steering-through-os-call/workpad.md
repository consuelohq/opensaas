# route raw steering through os call

branch: `task/os-manifest/route-raw-steering-through-os-call`
stream: `stream/os-manifest`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/721/route-raw-steering-through-os-call
github pr: https://github.com/consuelohq/opensaas/pull/721
started: 2026-06-03

## acceptance criteria

- [ ] OS server-visible surface reports exactly two tools: `get_steering` and `call`.
- [ ] The old dev steering direct route is removed from Bun and Python compatibility transports.
- [ ] Dev/operator full-manifest steering behavior is renamed to `get_raw_steering` / `getRawSteering`.
- [ ] Raw steering is available through the normal OS `call` path as the named OS skill `get_raw_steering`.
- [ ] Generated full manifest preserves all prior entries plus the new `get_raw_steering` OS skill.
- [ ] Core steering continues to include raw core manifest JSON and does not expose raw/full steering as a top-level server tool.
- [ ] Docs and generated surfaces describe the two-tool portal and call-based raw steering.
- [ ] Focused tests, generation, review, and verify pass before push.

## plan

1. Confirm current server surfaces and consumers.
2. Update tests first for the expected two-tool portal and `get_raw_steering` call behavior.
3. Add `get_raw_steering` to the source OS skill manifest.
4. Rename dev steering implementation to raw steering in TypeScript and route it through `executeCall`.
5. Remove the old dev steering direct route from Bun/Python server surfaces.
6. Regenerate OS tool manifests/docs/types/snapshots.
7. Run focused tests, inspect diff, run review/verify, push, and promote into `stream/os-manifest`.

## test-first contract

Behavior under test:

- Bun HTTP server health exposes exactly `get_steering` and `call`.
- Bun HTTP server no longer serves the old dev steering direct route.
- OS `call` accepts `name: "get_raw_steering"` and returns raw dev/operator steering containing the canonical full tool manifest.
- Generated full manifest includes `get_raw_steering` as an OS skill and preserves all existing names.
- Core manifest keeps `get_raw_steering` out of default core steering unless explicitly added later.

Existing pattern to follow:

- Workspace exposes exactly two server entrypoints: `get_steering` and `call`.
- OS skill calls route through `executeCall`, manifest lookup, guardrail validation, structured `CallOutput`, and runtime tracing.
- The manifest generator preserves source manifest definitions exactly and derives generated full/core artifacts from source/config.

Focused red commands:

```bash
bun --cwd packages/os test tests/tool-manifest.test.ts
bun --cwd packages/os test tests/os-raw-steering.test.ts
```

Expected red failure:

- `get_raw_steering` is not in the OS skill manifest yet.
- Existing server surfaces still expose a direct dev steering route.

No-test waiver:

- None.

## current status

- Task started from `stream/os-manifest` after `stream.sync` reported already up to date.
- Relevant OS server, script, manifest, docs, and tests inspected.
- Test-first contract written before implementation.

## files changed

- `.task/os-manifest/route-raw-steering-through-os-call/workpad.md`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/tool-manifest.test.ts`

## workspace-owned: files changed

- `.task/os-manifest/route-raw-steering-through-os-call/workpad.md`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/tool-manifest.test.ts`

## workspace-owned: activity log

- 2026-06-03 03:40:32 fs.write: `.task/os-manifest/route-raw-steering-through-os-call/workpad.md`
- 2026-06-03 03:41:28 fs.write: `packages/os/tests/os-raw-steering.test.ts`
- 2026-06-03 03:42:02 fs.patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-06-03 03:48:36 fs.patch: `packages/os/tests/os-raw-steering.test.ts`
- 2026-06-03 03:48:54 fs.patch: `packages/os/tests/os-raw-steering.test.ts`
- Inspected current dev steering references and OS server/tool surfaces.
- Loaded stream context for `stream/os-manifest`.
- Ran `stream.sync`; stream was already up to date with `main`.
- Started `task/os-manifest/route-raw-steering-through-os-call` from the stream.

## workspace-owned: validation evidence

- 2026-06-03 03:52:23 `review.run`: passed — OK
- 2026-06-03 03:52:42 `verify`: passed — OK

## key decisions

- Raw/full dev steering should be a named OS skill behind `call`, not a third top-level server tool.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- First `task.start` call used `startFrom: stream/os-manifest`; schema requires `stream`, so I retried with the corrected value.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): route raw steering through call" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/README.md`
- `packages/os/STEERING.md`
- `packages/os/docs/runtime-surfaces.md`
- `packages/os/manifests/manifest.config.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/local-guardrails.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server.ts`
- `packages/os/server.py`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tooling/tool-manifest.json`

## workspace-owned: test selection

- changed files: `.task/os-manifest/route-raw-steering-through-os-call/current.json`, `.task/os-manifest/route-raw-steering-through-os-call/evidence-log.json`, `.task/os-manifest/route-raw-steering-through-os-call/read-log.json`, `.task/os-manifest/route-raw-steering-through-os-call/session.json`, `.task/os-manifest/route-raw-steering-through-os-call/workpad.md`, `.task/tasks/os-manifest/route-raw-steering-through-os-call.json`, `packages/os/README.md`, `packages/os/STEERING.md`, `packages/os/docs/runtime-surfaces.md`, `packages/os/manifests/tool.manifest.json`, `packages/os/package.json`, `packages/os/scripts/os.ts`, `packages/os/scripts/server.ts`, `packages/os/server.py`, `packages/os/tests/os-raw-steering.test.ts`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
