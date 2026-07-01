# os bootstrap installer

branch: `task/os/os-bootstrap-installer`
stream: `stream/os`
taskSession: `tsk_a8a8b2ee7650`
task PR: https://github.com/consuelohq/opensaas/pull/687
Graphite task PR: https://app.graphite.com/github/pr/consuelohq/opensaas/687/os-bootstrap-installer
started: 2026-06-02

## implementation

- Local pre-Bun bootstrap script: `packages/os/scripts/bootstrap.sh`.
- Hosted endpoint: `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/os-install.controller.ts`.
- Module registration: `packages/twenty-server/src/engine/core-modules/consuelo-api/consuelo-api.module.ts` includes `OsInstallController`.
- Package script: `packages/os/package.json` includes `bootstrap` as `bash ./scripts/bootstrap.sh`.
- Installer/onboarding copy updated in `packages/os/scripts/install.ts`.
- Docs updated in `packages/os/README.md` and `packages/os/SCRIPTS.md`.

## hosted endpoint

`GET /os` serves `packages/os/scripts/bootstrap.sh` with:

- `Content-Type: text/x-shellscript; charset=utf-8`
- `Cache-Control: public, max-age=300`
- `X-Content-Type-Options: nosniff`

The endpoint reads from the maintained bootstrap source. `CONSUELO_OS_BOOTSTRAP_SCRIPT_PATH` can override the script path if the deployed process does not run from the repo root.

Production mapping needed outside the repo: map `install.consuelohq.com` to the production app service that serves this Nest route and preserve `/os`. Then the user command is:

```bash
curl -fsSL https://install.consuelohq.com/os | bash
```

## prerequisite behavior

- Supports macOS only; fails clearly on non-Darwin.
- Assumes `bash`, `curl`, and `uname` at bootstrap level.
- Verifies `launchctl`, `plutil`, and `lsof` exist on supported macOS. Missing tools fail with clear incomplete-Mac-environment guidance.
- Uses `set -euo pipefail`.
- Quotes paths.
- Does not use `sudo`.
- Does not install privileged system daemons.
- Does not source arbitrary `.env` files.
- Dry-run does not install Bun or mutate LaunchAgents.

## Bun install behavior

- Uses existing `bun` if present, including `$HOME/.bun/bin/bun`.
- If Bun is missing and `--dry-run` is set, reports the official install command that would run.
- If Bun is missing and `--no-install-bun` is set, fails with manual install instructions.
- If Bun is missing interactively, prompts:

```text
Consuelo OS uses Bun to run its local background runtime.
Press Enter to install Bun, or press Control-C to cancel.
```

- If Bun is missing with `--yes`, installs via:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then updates `PATH` so `$HOME/.bun/bin/bun` is available immediately.

## source/dependency behavior

- In a repo checkout, uses the current repo as the source.
- Outside a checkout, downloads `CONSUELO_OS_REPO_ARCHIVE_URL` or the default main archive into `~/.consuelo/source/opensaas`.
- Installs OS package dependencies with Bun after confirmation unless `--yes` is used.

## onboarding handoff behavior

Normal bootstrap hands off to:

```bash
bun --cwd packages/os ./scripts/install.ts --yes
```

Dry-run hands off to:

```bash
bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json
```

Installer copy now tells the user:

```text
Consuelo OS runs a local background service on your Mac so agents and apps can reach your OS while you work. This is similar to common Mac utilities that run in the background. You can stop or uninstall it later.
```

## LaunchAgent install behavior

- `--skip-daemons`: skips LaunchAgent setup.
- `--install-daemons`: installs user LaunchAgents after onboarding.
- `--yes` alone skips LaunchAgents; `--yes --install-daemons` installs without another prompt.
- Interactive mode prompts with labels before installing.
- Dry-run only runs the daemon dry-run and does not mutate services.

Labels:

```text
com.consuelo.system
com.consuelo.watchdog
com.consuelo.portless.system
```

Plist destinations:

```text
~/Library/LaunchAgents/com.consuelo.system.plist
~/Library/LaunchAgents/com.consuelo.watchdog.plist
~/Library/LaunchAgents/com.consuelo.portless.system.plist
```

Logs:

```text
~/Library/Logs/Consuelo
```

## validation

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

Focused route smoke passed with `curl http://127.0.0.1:4141/os`, returning `#!/usr/bin/env bash` with `Content-Type: text/x-shellscript; charset=utf-8`.

Known local validation limitations:

- The exact requested local Bun command `bun --cwd packages/os run install:system-daemons:dry-run` prints Bun `run` usage in the current local Bun version instead of running the package script. Equivalent working validation used `bun run --cwd packages/os install:system-daemons:dry-run`.
- Real `npx nx run twenty-server:start:ci` route validation could not start from the task worktree because Node failed to resolve `@nestjs/core` from `packages/twenty-server/dist/main.js`. Retrying with `NODE_PATH=/Users/kokayi/Dev/opensaas/node_modules` produced the same `MODULE_NOT_FOUND` failure. Focused route smoke verified the implemented `/os` response content and headers.
- `npx nx run twenty-server:typecheck` failed because the task worktree cannot resolve server dependencies such as `@nestjs/common`, alongside many existing integration test resolution errors. `bun run --cwd packages/os typecheck` passed.
- `workspace review` against `origin/stream/os` timed out; focused guards were run instead.

Focused guards:

- `git diff --check` passed.
- No changed file matched `server.py`.
- `grep -R sudo packages/os/scripts/bootstrap.sh packages/os/README.md packages/os/SCRIPTS.md` found only documentation saying no sudo is used.

## exact command Ko should run next

After this lands on `main` and Railway/DNS maps `install.consuelohq.com` to the production app route:

```bash
curl -fsSL https://install.consuelohq.com/os | bash
```

For repo-local verification now:

```bash
bash packages/os/scripts/bootstrap.sh --dry-run
```

## notes

- `stream.sync` against `main` before the task had unrelated conflicts in workspace/design/dialer files. Work proceeded from `stream/os` per task instruction.
- Stale PR #657 was not touched.

- 2026-06-02 02:07:14 write: `.task/os/os-bootstrap-installer/workpad.md`

## files changed

- `packages/os/scripts/bootstrap.sh`


## workspace-owned: files changed

- `packages/os/package.json`
- `packages/os/README.md`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/consuelo-api.module.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/os-install.controller.ts`

## workspace-owned: activity log

- 2026-06-02 02:07:14 fs.write: `.task/os/os-bootstrap-installer/workpad.md`
- 2026-06-02 02:11:47 fs.patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/os-install.controller.ts`
- 2026-06-02 02:13:21 fs.patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/os-install.controller.ts`
- 2026-06-02 02:14:27 fs.patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/os-install.controller.ts`
- 2026-06-02 02:15:31 fs.patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/os-install.controller.ts`
- 2026-06-02 02:17:29 fs.write: `.task/os/os-bootstrap-installer/publish-update.md`

## workspace-owned: files read

- `packages/os/scripts/lib/task-workpad.js`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/csv-mapping.controller.ts`

## final review-gate update

After import ordering was fixed, `bun run review -- --base origin/stream/os` reports:

```text
ESLINT              ✓ PASS
TYPECHECK           ✗ FAIL (1)
TESTS:twenty-server ✗ FAIL (5.3s) 2 failed, 2 skipped, 2115 passed, 2119 total
```

The remaining typecheck failure is dependency resolution in the task worktree, e.g. `Cannot find module '@nestjs/common' or its corresponding type declarations`, including the new controller and many existing server files. The real `twenty-server:start:ci` curl test also failed for the same worktree dependency resolution class with `Cannot find module '@nestjs/core'` from `packages/twenty-server/dist/main.js`.

This matches the task instruction to record exact wrapper failures and use focused validation evidence when the wrapper is broken. Focused validation evidence includes shell syntax, bootstrap help/dry-run/no-install-bun dry-run, install dry-run JSON, LaunchAgent dry-run, route response smoke, docs/types generation, OS typecheck, ESLint pass, git diff check, no changed `server.py`, and no executable `sudo` use.

- 2026-06-02 02:17:29 write: `.task/os/os-bootstrap-installer/publish-update.md`

## final validation

Implemented and validated the OS bootstrap installer path. Key changed files are `packages/os/scripts/bootstrap.sh`, `packages/twenty-server/src/engine/core-modules/consuelo-api/controllers/os-install.controller.ts`, `packages/twenty-server/src/engine/core-modules/consuelo-api/consuelo-api.module.ts`, `packages/os/scripts/install.ts`, `packages/os/package.json`, `packages/os/README.md`, and `packages/os/SCRIPTS.md`.

Validation passed for shell syntax, help, dry-run, dry-run with `--no-install-bun`, onboarding dry-run JSON, LaunchAgent dry-run, docs/types generation, OS typecheck, route-smoke curl, ESLint import ordering, `git diff --check`, no changed `server.py`, and no executable `sudo` use. The broader server typecheck/start/review wrapper still fails in the task worktree because dependencies such as `@nestjs/common` and `@nestjs/core` cannot resolve; exact failures are recorded above.
