# port code call batch rows steering examples

branch: `task/os/port-code-call-batch-rows-steering-examples`
stream: `stream/os`
source: `main` because `stream/os` is currently dirty/conflicted and `stream.sync` is blocked
taskSession: `tsk_b3c2b19f70cb`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1137/port-code-call-batch-rows-steering-examples
github pr: https://github.com/consuelohq/opensaas/pull/1137
started: 2026-06-18

## acceptance criteria

- Port PR #1136 steering example expansion behavior to OS-owned steering surfaces.
- OS `getSteering()` / `executeGetSteering()` includes core manifest `code.call` examples with safe `codeFileSource` expansion for allowed `scripts/code-call-examples/*.ts|*.py` files.
- OS legacy Python server `_build_steering()` includes the same safe expansion for its raw core manifest section.
- OS `get_raw_steering` full-manifest path includes expanded `codeFileSource` examples so raw/operator steering is not reduced to opaque `codeFile` paths.
- Preserve path safety: only repo-local `scripts/code-call-examples/*.ts|*.py` entries may be expanded; missing or invalid paths are left unchanged.
- Keep the shared PR #1136 trace-watch batch row changes from `main`; do not duplicate or fork trace-watch in OS.
- Add focused OS tests that fail before implementation and prove the expanded steering contains actual code example source.
- Run focused OS steering tests, review, verify, push, and promote as far as the dirty `stream/os` state allows.

## Test-first contract

Behavior under test:

- `getSteering()` renders the core manifest with `codeFileSource` next to `code.call` `codeFile` examples.
- `getRawSteering()` / `get_raw_steering` renders the full manifest with `codeFileSource` for the same safe example files.
- Python `packages/os/server.py` `_build_steering()` expands safe `codeFile` entries in the core manifest before injecting it into steering.

Existing local pattern:

- Workspace PR #1136 added `_read_manifest_code_file_source`, `_expand_manifest_code_file_examples`, and `_read_core_manifest_for_steering()` in `packages/workspace/server.py`.
- Workspace PR #1136 added `server_call_test.py` coverage using `scripts/code-call-examples/python-semantic-test-mutation.py` and asserting `codeFileSource`, `from pathlib import Path`, and `signatureAlgorithm`.
- OS already has steering coverage in `packages/os/tests/os-get-steering-trace.test.ts`, `packages/os/tests/os-raw-steering.test.ts`, and `packages/os/tests/os_server_steering_test.py`.

New/changed tests:

- Extend `packages/os/tests/os-get-steering-trace.test.ts` to assert bundled OS core-manifest steering includes `codeFileSource` and real source text.
- Extend `packages/os/tests/os-raw-steering.test.ts` to assert `get_raw_steering` includes expanded full-manifest example source.
- Extend `packages/os/tests/os_server_steering_test.py` to assert the Python transport expands core manifest `codeFile` examples.

Focused red command:

```bash
bun --cwd packages/os test tests/os-get-steering-trace.test.ts tests/os-raw-steering.test.ts
python3 -m unittest packages.os.tests.os_server_steering_test.OsSteeringServerTest.test_build_steering_expands_code_file_examples_in_core_manifest
```

Expected red failure:

- TypeScript steering tests fail because `getSteering()` and `getRawSteering()` currently serialize manifests without adding `codeFileSource`.
- Python server test fails because `_build_steering()` currently injects raw `MANIFEST_FILE` text without expanding `codeFile` examples.

## plan

1. Record PR #1136 evidence and OS stream blocker.
2. Add OS red tests for TypeScript and Python steering expansion.
3. Implement a small shared TypeScript expansion helper in `packages/os/scripts/os.ts` and a parallel Python helper in `packages/os/server.py`.
4. Run focused red/green steering tests.
5. Inspect diff, run review and verify.
6. Attempt task push/PR promotion; if promotion hits dirty `stream/os`, report exact blocker and leave PR ready.

## current status

- PR #1136 is merged to `main`; patch evidence gathered with GitHub raw fallback because typed `pr.diff` currently passes unsupported `--stat`.
- `stream/os` is behind main but `stream.sync` is blocked by a pre-existing dirty/conflicted stream worktree.
- Task branch started from `main` to isolate the requested OS work.

## files changed

- `.task/os/port-code-call-batch-rows-steering-examples/workpad.md`

## workspace-owned: files changed

- `.task/os/port-code-call-batch-rows-steering-examples/workpad.md`

## workspace-owned: activity log

- 2026-06-18 06:46:08 fs.write: `.task/os/port-code-call-batch-rows-steering-examples/workpad.md`
- 2026-06-18 06:54:45 fs.write: `.task/os/port-code-call-batch-rows-steering-examples/workpad.md`
- 2026-06-18: task started from `main` because stream sync was blocked.
- 2026-06-18: workpad updated with acceptance criteria and test-first contract.

## workspace-owned: validation evidence

- pending
- 2026-06-18 06:53:05 `review.run`: passed — OK
- 2026-06-18 06:54:22 `review.run`: passed — OK
- 2026-06-18 06:55:19 `verify`: passed — OK

## key decisions

- Start from `main` rather than `stream/os` because `stream/os` has unresolved uncommitted changes and conflicts outside this task. This avoids destructive cleanup and keeps the requested OS port isolated.
- Port the steering expansion to both OS TypeScript and Python steering paths because OS has both active Bun runtime and legacy Python transport tests.

## notes for ko

- `stream/os` needs cleanup separately before final stream sync/promotion can be fully clean.

## improvements noticed

- Typed `github pr.diff` still uses unsupported `gh pr diff --stat`; raw typed GitHub fallback was required.

## issues and recovery

- `stream.sync` trace showed dirty/conflicted `stream/os`, including unresolved conflicts in manifest files. Recovery: started task from `main` and recorded the blocker.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): expand code call examples in steering" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/os.ts`
- `packages/os/server.py`
- `packages/os/steering/system_prompt.md`
- `packages/os/tests/code-call.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/os_server_steering_test.py`
- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

- 2026-06-18 06:53:45 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`


## validation update 2026-06-18

- Red evidence: `bun test tests/os-get-steering-trace.test.ts tests/os-raw-steering.test.ts` failed before implementation because OS steering lacked `codeFileSource` in both bundled and raw manifest paths (`trc_803cc8586d67`).
- Green evidence: `bun test tests/os-get-steering-trace.test.ts tests/os-raw-steering.test.ts tests/code-call.test.ts` passed 21 tests / 0 failed; `python3 -m unittest packages.os.tests.os_server_steering_test` passed 4 tests; `bun run typecheck` passed (`trc_bf05e54d23e3`).
- Review evidence: `review.run --base origin/main` reports 0 issues owned by this change and 5 pre-existing issues (`trc_bb62255701b8`).
- Generated OS manifests/docs/types after updating `code.call` docs source so existing code-call steering documentation test passes (`trc_5826e2ae14ed`).
- Stream blocker remains: `stream/os` sync was blocked earlier by pre-existing dirty/conflicted stream worktree (`trc_fb7e65bd4846`).

- 2026-06-18 06:54:45 append: `.task/os/port-code-call-batch-rows-steering-examples/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/port-code-call-batch-rows-steering-examples/current.json`, `.task/os/port-code-call-batch-rows-steering-examples/evidence-log.json`, `.task/os/port-code-call-batch-rows-steering-examples/read-log.json`, `.task/os/port-code-call-batch-rows-steering-examples/session.json`, `.task/os/port-code-call-batch-rows-steering-examples/workpad.md`, `.task/tasks/os/port-code-call-batch-rows-steering-examples.json`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/scripts/os.ts`, `packages/os/server.py`, `packages/os/tests/os-get-steering-trace.test.ts`, `packages/os/tests/os-raw-steering.test.ts`, `packages/os/tests/os_server_steering_test.py`, `packages/os/tooling/dev-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
