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
- [ ] Ko approves the targeted Bun runtime switch plan before code changes begin.
- [ ] After approval, implement only the approved runtime scope.

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

- The OS package already has a Bun CLI spine in `packages/os/scripts/os.ts` with `get-steering`, `get-dev-steering`, and `call` commands.
- `packages/os/server.py` is the remaining Python/FastMCP transport wrapper. It exposes `get_steering`, `get_dev_steering`, and `call`, then shells out to Bun for `call`.
- `server.py` currently defaults `PORT` to `8851`, while setup and copied workspace server scripts mostly use `8850`.
- `server.py` currently defaults `BUN_BIN` to `/opt/homebrew/bin/bun`, which is machine-specific.
- `tooling/tool-manifest.json` is small and currently declares `daily-revenue-brief` only. It should stay a manifest.
- `tooling/dev-tool-manifest.json` preserves the copied workspace/operator typed facade registry for `get_dev_steering`.
- The current TypeScript type name `SkillManifestEntry` is confusing because the file is a manifest entry, and Ko clarified that manifests are not skills.
- `daily-revenue-brief` is already a Bun script and calls the GraphQL connectivity proof.
- Artifacts are currently descriptors only; no local OS home, SQLite, or persisted run record exists yet.
- Docker is Python-first and currently exposes `8000`, while local scripts expect `8850`.
- `setup.sh`, `scripts/server.js`, `start-brain*`, daemon scripts, and Docker are copied workspace bootstrap surfaces and still carry Python/MCP/workspace wording.

## locked product constraints

- Product docs and user-facing language say OS and portal.
- Public portal shape is `get_steering` and `call`.
- `get_dev_steering` is internal/dev/operator only.
- Use skills as the product capability concept.
- Use scripts for executable implementation.
- Manifests stay manifests. Do not rename manifests to skills.
- Local OS should not require Docker.
- Local OS should use Bun, SQLite, and a Consuelo home folder.
- Hosted/team OS should stay in the regular OpenSaaS repo/deployment path first.

## targeted approval plan

### phase 1: replace the Python transport wrapper with a Bun transport wrapper

Build a Bun/TypeScript server entrypoint for the OS portal and route it to the existing Bun CLI/runtime code instead of continuing to run `server.py` as the product path.

Target files likely touched:

- `packages/os/package.json`
- `packages/os/scripts/os.ts`
- new `packages/os/scripts/server.ts` or `packages/os/src/server.ts`
- `packages/os/scripts/server.js`
- `packages/os/README.md`
- `packages/os/docs/runtime-surfaces.md`

Rules:

- Keep `tooling/tool-manifest.json` intact as a manifest.
- Keep `tooling/dev-tool-manifest.json` intact as the internal/operator manifest.
- Do not rename manifest files.
- Do not delete `server.py` until Ko approves deletion after the Bun server smoke passes.
- Do not change docs navigation in this runtime task.

### phase 2: clean runtime defaults

- Standardize local default port to `8850`.
- Add `CONSUELO_OS_PORT` as the OS-specific override.
- Use `bun` from `PATH`; remove `/opt/homebrew/bin/bun` as the default path.
- Keep `BUN_BIN` only as an override if still needed for compatibility.

### phase 3: add minimal local runtime state

Add the smallest useful local state layer for observability:

- `CONSUELO_HOME`, defaulting to `~/.consuelo/os`.
- local folders for `runs`, `logs`, `artifacts`, and `tmp`.
- SQLite file at `~/.consuelo/os/consuelo.db`.
- execution table/event table for `call` records.

The first implementation records execution metadata and events. Artifact bytes and versioning can stay descriptor-only until the artifact service task.

### phase 4: fix naming inside TS types without touching manifest files

Rename code types away from `SkillManifestEntry` to a neutral manifest name such as `OsManifestEntry` or `PortalManifestEntry`.

Keep skill language where it describes the product capability being run, such as error codes and user-facing messages.

### phase 5: update internal docs for runtime truth

Update only package/runtime docs touched by the runtime change:

- Bun is the product runtime path.
- Python/FastMCP is bootstrap/legacy during transition.
- Docker is deferred for local use.
- `get_dev_steering` is internal-only.
- manifests remain manifests.

## out of scope until separate approval

- Rename manifest files.
- Change public docs navigation.
- Delete Python files outright.
- Implement Slack/Discord approvals.
- Implement S3 artifact storage.
- Implement hosted/cloud deployment split.
- Rebuild the copied workspace operator scripts.
- Rewrite the internal workspace app runtime.

## stop conditions

- Ask Ko before deleting `server.py`, `requirements.txt`, or Python tests.
- Ask Ko before changing `tooling/tool-manifest.json` shape.
- Ask Ko before changing `tooling/dev-tool-manifest.json`.
- Ask Ko before changing docs navigation.
- Ask Ko before adding Docker or hosted deployment work.
- Ask Ko if the Bun transport requires introducing a new transport dependency with unclear long-term fit.

## validation plan after approval

- `cd packages/os && bun run smoke:steering`
- `cd packages/os && bun run smoke:daily-revenue-brief`
- `cd packages/os && bun run typecheck`
- local health check against `127.0.0.1:8850/health`
- `workspace check-files` for touched TS files
- `workspace review.run --base origin/stream/os --no-tests`
- `workspace verify --base origin/stream/os --no-db` if no DB migrations are added

## files changed

- `.task/workpad.md`

## key decisions

- No implementation has started.
- This task is waiting for Ko approval of the targeted runtime plan.

## notes for ko

- The earlier plan incorrectly implied manifests could be renamed/reframed as skills. This workpad preserves the correction: manifests are manifests; skills are skills.
- Current code already has a Bun CLI runtime. The targeted switch is mainly replacing the Python server/transport wrapper and adding local runtime state, not rewriting all scripts.

## improvements noticed

- `server.py` and local setup disagree on default port.
- `BUN_BIN` default is machine-specific.
- Docker is Python-first and misaligned with the local Bun direction.
- `SkillManifestEntry` type name blurs the manifest/skill boundary.

## errors i ran into

- A batch read attempt failed because this workspace facade session did not accept the batch input shape. I switched to individual `fs.read` calls.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-21 03:54:02 write: `.task/workpad.md`