# CodeRabbit packet for PR #362

Source: PR #362 (`stream/os` -> `main`) comments reviewed against `task/os/os-local-testing-readiness` on 2026-06-01.

## Critical before local Mac testing

- `packages/os/scripts/browser.js`: fixed for this task. Browser profile, screenshot directory, and app URLs are env-driven with portable defaults; screenshot directory creation no longer shells out.
- `packages/os/scripts/generate-system-daemons.sh`: fixed for this task. The script parses simple `.env` key/value lines instead of sourcing arbitrary shell, generates user LaunchAgent plists, and uses productized labels: `com.consuelo.system`, `com.consuelo.watchdog`, and `com.consuelo.portless.system`.
- `packages/os/scripts/install-system-daemons.sh`: fixed for this task. Dry run performs shell syntax checks and `plutil -lint`; the normal path installs user LaunchAgents in `~/Library/LaunchAgents` and does not require `sudo`.
- `packages/os/scripts/workspace-watchdog.sh`: fixed for this task. Restarts target the user launchd domain instead of `system/...` and use the productized Consuelo OS labels.
- `packages/os/Dockerfile`: fixed for this task to avoid reviving `server.py`; it now uses the Bun runtime and `scripts/server.ts`.

## Valid, but can wait

- `packages/os/scripts/gh.js`: command construction should move from shell strings to argument-vector execution before accepting arbitrary user input. Not required for local startup validation.
- `packages/os/scripts/doctor-analytics.ts` and `packages/os/scripts/doctor-errors.ts`: option parsing can still accept empty or flag-like values. Handle in a follow-up observability hardening pass.
- `packages/os/scripts/doctor-watch.ts`: malformed historical `output_json` can still throw during artifact counting. Wrap parse in a safe fallback later.
- Helper hardening comments in capabilities, artifacts, git, indexer, install, and review helpers should be handled after local Mac readiness.

## Outdated or already fixed

- `packages/os/scripts/lib/facade/executor.ts`: comments mentioning `executeInternalTool`, `task.pin`, or `task.ensureSynced` are stale against current OS code.
- `packages/os/scripts/tools-search.ts`: current OS facade exposes `tools.search` from `dev-tool-manifest.json` and returns ranked usage guidance.
- `packages/os/skills/consuelo-design/references/agents.md`: duplicate heading and absolute path comments appear fixed by current searches.

## Obsolete path or wrong file

- `packages/os/server.py` and Python server tests are obsolete for this task. Do not recreate or extend `server.py`; the OS runtime stays Bun/TypeScript via `scripts/server.ts` and package scripts.
- `packages/workspace/**` comments are not OS-scoped for this PR unless the same issue exists in `packages/os`.
- Twenty app and docs-nav comments are outside this local Mac testing readiness scope.

## Validation checklist

- `bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json`
- `cd packages/os && bun run tools:search tools.search --limit 3`
- `cd packages/os && bun run install:system-daemons:dry-run`
- `cd packages/os && bun test tests/facade/facade.test.ts`
- `cd packages/os && bun run generate:types`
- `cd packages/os && bun run generate:docs`
