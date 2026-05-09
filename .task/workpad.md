# fix twenty-front posthog dependency and config

## objective

Restore PostHog telemetry in `twenty-front` by declaring the runtime dependency and wiring frontend-safe runtime config through build and runtime injection.

## acceptance criteria

- `twenty-front` declares `posthog-js` as a runtime dependency.
- `~/config` exports `POSTHOG_API_KEY` and `POSTHOG_HOST` for the telemetry initializer.
- Runtime env injection includes PostHog public config and matches the markers in `index.html`.
- Static/build validation proves dependency resolution and runtime config injection.
- Browser smoke is deferred until Ko reviews the PR or local dev setup is available.

## files changed

- `packages/twenty-front/package.json`
  - Added `posthog-js` dependency.
- `yarn.lock`
  - Added `posthog-js@1.372.10` and transitive dependencies.
- `packages/twenty-front/src/config/index.ts`
  - Added `POSTHOG_API_KEY` from `window._env_.REACT_APP_POSTHOG_API_KEY` / `process.env.REACT_APP_POSTHOG_API_KEY`.
  - Added `POSTHOG_HOST` from `window._env_.REACT_APP_POSTHOG_HOST` / `process.env.REACT_APP_POSTHOG_HOST`, defaulting to `https://us.i.posthog.com`.
- `packages/twenty-front/vite.config.ts`
  - Added PostHog env vars to Vite env loading and define values.
- `packages/twenty-front/scripts/inject-runtime-env.sh`
  - Injects `REACT_APP_POSTHOG_API_KEY` and `REACT_APP_POSTHOG_HOST` into `window._env_`.
  - Uses `Consuelo Config` markers to match `packages/twenty-front/index.html`.

## key decisions

- Use `REACT_APP_POSTHOG_API_KEY` and `REACT_APP_POSTHOG_HOST` because `twenty-front` already uses `REACT_APP_` env prefix and Vite is configured with `envPrefix: 'REACT_APP_'`.
- Default PostHog host to `https://us.i.posthog.com`, matching the existing Consuelo website config.
- Keep `initPostHog` no-op behavior when the key is empty.

## validation results

- `sh -n packages/twenty-front/scripts/inject-runtime-env.sh` passed.
- Manual runtime injection smoke passed against a copied `index.html`; generated block included `REACT_APP_SERVER_BASE_URL`, `REACT_APP_POSTHOG_API_KEY`, and `REACT_APP_POSTHOG_HOST`.
- `yarn nx build twenty-front` passed and ran `Injecting runtime environment variables into index.html...`.
- `grep -A6 -B2 'twenty-env-config' packages/twenty-front/build/index.html` confirmed built output contains:
  - `REACT_APP_SERVER_BASE_URL`
  - `REACT_APP_POSTHOG_API_KEY`
  - `REACT_APP_POSTHOG_HOST: "https://us.i.posthog.com"`
- `review.run` with `base=origin/main` and `noTests=true` returned `ok: true`, with no `yours` findings.

## known validation caveats

- `yarn workspace twenty-front add posthog-js@^1.356.1` wrote package and lock changes, then failed during link because `packages/cli/dist` is missing in the task worktree. The dependency changes were retained and validated by the successful `yarn nx build twenty-front`.
- `yarn nx typecheck twenty-front` fails on 76 existing errors across unrelated `agent`, `assistant`, `files`, `GHL`, `navigation`, and settings files. No failures pointed at the touched PostHog/config/runtime files.
- `checkFiles` passed for plain `.ts` files (`config/index.ts`, `posthog.ts`) and failed on TSX because Node cannot `--check` `.tsx` files directly. Vite build covers the TSX import path.
- Browser/runtime PostHog capture smoke was intentionally deferred until after PR review or a confirmed local dev setup.

## next step

Publish the task branch and promote the stream review PR.

- 2026-05-09 15:20:18 write: `.task/workpad.md`