# fix pr 355 review findings

## acceptance criteria

- Verify each review finding against current code.
- Fix only still-valid issues.
- Keep edits minimal and scoped to PR 355 review comments.
- Validate the touched package/runtime injection path.

## findings

1. `posthog-js` manifest range still reads `^1.356.1` while lock resolves `1.372.10`; valid. Updated manifest and lock descriptor to `^1.372.10`.
2. `inject-runtime-env.sh` embeds raw env values into JS strings; valid. Added `escape_js_string` and sanitized all three injected values.
3. `POSTHOG_API_KEY` / `POSTHOG_HOST` naming nit is valid. Kept cleaner constants and added backwards-compatible `REACT_APP_POSTHOG_API_KEY` / `REACT_APP_POSTHOG_HOST` aliases.

## skipped findings

- None. All three findings were still valid against current code.

## files changed

- `packages/twenty-front/package.json`
- `yarn.lock`
- `packages/twenty-front/scripts/inject-runtime-env.sh`
- `packages/twenty-front/src/config/index.ts`

## validation results

- `yarn install --mode=skip-builds` failed because the flag is invalid for Yarn 4. Correct flag is `skip-build`.
- `yarn install --mode=skip-build` resolved and fetched, and updated `yarn.lock`, then failed in link step because `packages/cli/dist` is missing in the task worktree. This is the same local setup issue seen in the earlier PR work, not a dependency resolution failure.
- `sh -n packages/twenty-front/scripts/inject-runtime-env.sh` passed.
- Python-backed hostile-value injection smoke passed. Verified quotes, `<`, `>`, and backslashes are escaped in the injected `window._env_` block.
- `yarn nx build twenty-front` passed when output was redirected to `/tmp/twenty-front-build-review.log`; build ran the runtime env injection step.
- `review.run` against `origin/stream/general` returned `ok: true` with no `yours` findings.
- `verify` against `origin/stream/general` with `noDb` timed out at the workspace tool boundary. No lingering verify process was found afterward. Publishing uses `noVerify` with the above focused validation evidence.

## known caveats

- `review.run` still reports pre-existing `twenty-front` typecheck failures in unrelated Agent, assistant, files, GHL, navigation, and settings files.
- Browser smoke remains deferred; this review batch only touched package metadata, config aliases, and runtime env escaping.

- 2026-05-09 16:27:57 write: `.task/workpad.md`