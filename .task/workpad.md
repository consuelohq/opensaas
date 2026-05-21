# plan bun runtime switch for consuelo os

branch: `task/os/plan-bun-runtime-switch-for-consuelo-os`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/419/plan-bun-runtime-switch-for-consuelo-os
github pr: https://github.com/consuelohq/opensaas/pull/419
started: 2026-05-21

## acceptance criteria

- [x] Start a planning task from `stream/os`.
- [x] Read root `AGENTS.md` and `CODING-STANDARDS.md` before proposing code changes.
- [x] Inspect the actual OS package runtime files before asking Ko for approval.
- [x] Preserve the distinction that manifests are manifests and skills are skills.
- [x] Ko approves the targeted Bun runtime switch plan before code changes begin.
- [x] Implement only the approved runtime scope.
- [x] Keep manifest files intact.
- [x] Add Bun/TypeScript server path.
- [x] Add minimal local runtime state with SQLite and `CONSUELO_HOME`.
- [x] Keep Python server as temporary compatibility wrapper instead of deleting it.
- [x] Validate Bun CLI smoke, server smoke, review, and verify.

## investigated files

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/package.json`
- `packages/os/server.py`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/tooling/tool-manifest.json`
- `packages/os/scripts/revenue/daily-revenue-brief.ts`
- `packages/os/scripts/lib/graphql-client.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/README.md`
- `packages/os/docs/runtime-surfaces.md`
- `packages/os/scripts/server.js`
- `packages/os/setup.sh`
- `packages/os/Dockerfile`

## current runtime findings

- The OS package already had a Bun CLI spine in `packages/os/scripts/os.ts` with `get-steering`, `get-dev-steering`, and `call` commands.
- `packages/os/server.py` was the remaining Python/FastMCP transport wrapper. It exposed `get_steering`, `get_dev_steering`, and `call`, then shelled out to Bun for `call`.
- `server.py` defaulted `PORT` to `8851`, while setup and copied workspace server scripts mostly used `8850`.
- `server.py` defaulted `BUN_BIN` to `/opt/homebrew/bin/bun`, which was machine-specific.
- `tooling/tool-manifest.json` is small and currently declares `daily-revenue-brief` only. It stayed a manifest.
- `tooling/dev-tool-manifest.json` preserves the copied workspace/operator typed facade registry for `get_dev_steering`. It stayed intact.
- The old TypeScript type name `SkillManifestEntry` blurred the manifest/skill boundary.
- `daily-revenue-brief` is already a Bun script and calls the GraphQL connectivity proof.
- Artifacts were descriptors only; no local OS home, SQLite, or persisted run record existed before this task.
- Docker is Python-first and currently exposes `8000`. Docker was documented as out of local runtime scope.

## implemented

- Added `packages/os/scripts/server.ts` as the Bun/TypeScript local OS server.
  - Exposes `/health`, `/get_steering`, `/get_dev_steering`, and `/call`.
  - Uses `127.0.0.1` and `CONSUELO_OS_PORT`, defaulting to `8850`.
  - Supports `CONSUELO_OS_BEARER_TOKEN` and legacy `MCP_BEARER_TOKEN` for compatibility.
- Updated `packages/os/scripts/os.ts`.
  - Exports `getSteering`, `getDevSteering`, `executeCall`, and `parseCallInput`.
  - Adds trace IDs and duration to call output.
  - Records execution start/finish events through local runtime state.
  - Includes `CONSUELO_HOME`, SQLite path, and artifact storage mode in runtime identity.
- Added `packages/os/scripts/lib/runtime-state.ts`.
  - Defaults `CONSUELO_HOME` to `~/.consuelo/os`.
  - Creates `artifacts`, `logs`, `runs`, and `tmp` folders.
  - Creates `consuelo.db` with `skill_executions` and `execution_events` tables.
- Renamed the confusing TS type `SkillManifestEntry` to `OsManifestEntry` without changing manifest files or manifest shape.
- Updated `packages/os/scripts/server.js` to manage the Bun server instead of Python.
- Updated `packages/os/server.py` as a temporary legacy wrapper.
  - Defaults to port `8850`.
  - Defaults `BUN_BIN` to `bun` from `PATH`.
  - Supports `CONSUELO_OS_BEARER_TOKEN` while keeping legacy `MCP_BEARER_TOKEN` compatibility.
- Updated `packages/os/.env.example` to OS-specific env names.
- Updated `packages/os/setup.sh` to require Bun, initialize local OS folders, and verify the Bun spine instead of creating a Python venv.
- Updated `packages/os/README.md` and `packages/os/docs/runtime-surfaces.md` for Bun-first runtime truth.

## files changed

- `packages/os/.env.example`
- `packages/os/README.md`
- `packages/os/docs/runtime-surfaces.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server.js`
- `packages/os/scripts/server.ts`
- `packages/os/server.py`
- `packages/os/setup.sh`
- `.task/workpad.md`

## key decisions

- Bun/TypeScript is now the product runtime path.
- Python remains temporarily as a compatibility wrapper; it was not deleted.
- Manifests remain manifests.
- `tooling/tool-manifest.json` and `tooling/dev-tool-manifest.json` were not renamed and their shape was not changed.
- Local OS state defaults to `~/.consuelo/os`.
- The local server default port is `8850`.
- Local OS does not require Docker.

## notes for ko

- Current Bun server is HTTP portal-shaped, not a full replacement for every behind-the-scenes agent transport mode. The old Python transport stays as compatibility while the Bun path becomes the product runtime foundation.
- A Python process was already listening on local port `8850` during validation, so the Bun server smoke used alternate test ports `8899`, `8900`, `8901`, `8902`, and `8903`.
- The earlier plan incorrectly implied manifests could be renamed/reframed as skills. This work preserves the correction: manifests are manifests; skills are skills.

## improvements noticed

- Docker remains Python-first and misaligned with the Bun/local runtime direction. This belongs in a separate deployment task.
- Agent transport compatibility should be its own task if the Bun server needs to speak an SDK-backed protocol instead of plain HTTP portal routes.
- Artifact descriptors now have execution provenance through SQLite, but artifact bytes are still not written through a full artifact service.

## errors i ran into

- A batch read attempt failed because this workspace facade session did not accept the batch input shape. I switched to individual `fs.read` calls.
- `fs.patch` rejected multiline inline content as expected. I used task-scoped commands for multiline edits.
- First server `/call` smoke returned `401` because the workspace environment included `MCP_BEARER_TOKEN`; reran with auth env unset for the local smoke.
- First `verify` failed because review flagged issues in the new files. Fixed SQL query literal style and replaced `console.*` in the changed server manager.

## validation commands and results

- `cd packages/os && CONSUELO_HOME=$(mktemp -d)/os bun ./scripts/os.ts call '{"name":"daily-revenue-brief"}'`: passed, returned `ok: true`, trace ID, duration, artifact descriptor, and `graphqlStatus: missing_env`.
- `cd packages/os && CONSUELO_HOME=$(mktemp -d)/os bun run smoke:steering`: passed.
- `cd packages/os && CONSUELO_HOME=$(mktemp -d)/os bun run smoke:daily-revenue-brief | python3 -m json.tool`: passed.
- Bun server health smoke on port `8899`: passed, returned `runtime: bun`, `tools: 3`.
- Bun server `/call` smoke on port `8903` with auth env unset: passed and created local `consuelo.db`.
- `cd packages/os && bun run typecheck`: passed.
- `workspace checkFiles` for touched TS/JS runtime files: passed.
- `python3 -m py_compile packages/os/server.py`: passed.
- `git diff --check`: passed.
- `workspace review.run --base origin/stream/os --no-tests`: passed with no `yours` or `preExisting` findings after fixes.
- `workspace verify --base origin/stream/os --no-db`: passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-21 04:32:55 write: `.task/workpad.md`