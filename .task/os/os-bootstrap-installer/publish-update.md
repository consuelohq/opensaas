# os bootstrap installer publish update

## what changed

Implemented the first-time hosted Consuelo OS bootstrap path:

- Added `packages/os/scripts/bootstrap.sh` as a pre-Bun macOS shell bootstrap.
- Added `GET /os` in `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/os-install.controller.ts` and registered it in `consuelo-api.module.ts`.
- Added `bootstrap` package script in `packages/os/package.json`.
- Updated installer copy in `packages/os/scripts/install.ts`.
- Updated `packages/os/README.md` and `packages/os/SCRIPTS.md` with hosted/local install, prerequisites, Bun handling, LaunchAgents, logs, stop/uninstall notes, and production mapping.

## why it changed

The OS task requires a real installer command:

```bash
curl -fsSL https://install.consuelohq.com/os | bash
```

The hosted endpoint now serves the maintained bootstrap source instead of requiring an out-of-band local script or fake doc route.

## validation run

Passed:

```bash
bash -n packages/os/scripts/bootstrap.sh
bash packages/os/scripts/bootstrap.sh --help
bash packages/os/scripts/bootstrap.sh --dry-run
bash packages/os/scripts/bootstrap.sh --dry-run --no-install-bun
bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json
bun run --cwd packages/os install:system-daemons:dry-run
bun run --cwd packages/os generate:types
bun run --cwd packages/os generate:docs
bun run --cwd packages/os typecheck
git diff --check
```

Focused route smoke passed:

```bash
curl -fsSL http://127.0.0.1:4141/os
```

It returned `#!/usr/bin/env bash` with `Content-Type: text/x-shellscript; charset=utf-8`.

`bun run review -- --base origin/stream/os` after import-order cleanup reports ESLint passing and remaining broader worktree wrapper failures:

```text
ESLINT              ✓ PASS
TYPECHECK           ✗ FAIL (1)
TESTS:twenty-server ✗ FAIL (5.3s) 2 failed, 2 skipped, 2115 passed, 2119 total
```

## issues / follow-ups

- Real `npx nx run twenty-server:start:ci` could not start from the task worktree because Node cannot resolve `@nestjs/core` from `packages/twenty-server/dist/main.js`.
- `npx nx run twenty-server:typecheck` fails on missing server dependencies such as `@nestjs/common` across the worktree, including existing files.
- The exact requested `bun --cwd packages/os run install:system-daemons:dry-run` prints Bun `run` usage in this local Bun version; equivalent `bun run --cwd packages/os install:system-daemons:dry-run` validates the daemon script successfully.
- Production still needs external Railway/DNS mapping: map `install.consuelohq.com` to the app service preserving `/os`; set `CONSUELO_OS_BOOTSTRAP_SCRIPT_PATH` only if the deployed cwd is not the repo root.

## publish

Pushed task branch with commit:

```text
ff3ff60f7a28499ce1e065c0325d332d7683e5cf feat(os): add hosted mac bootstrap installer
```
