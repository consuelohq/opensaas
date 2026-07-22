# fix runtime env backslash escaping

## acceptance criteria

- Address Codex review comment PRRC_kwDORPzu_c7Et4Rx on PR #355.
- Preserve exact runtime env values containing backslashes after HTML injection and browser JS string parsing.
- Keep existing escaping for quotes and `<`/`>` XSS defense.
- Promote fix into `stream/general`, then ship stream PR #355 to `main`.

## files changed

- `packages/twenty-front/scripts/inject-runtime-env.sh`

## implementation

- Changed the `escape_js_string` backslash replacement from emitting four backslashes to emitting two backslashes in the generated JavaScript literal.
- This keeps one original runtime backslash after browser JavaScript parsing while still escaping the string literal correctly.
- Left quote escaping and `<`/`>` encoding unchanged.

## validation evidence

- `sh -n packages/twenty-front/scripts/inject-runtime-env.sh` passed.
- Runtime env injection smoke passed with values containing backslashes, quotes, `<`, and `>`.
  - The smoke evaluated the emitted `window._env_` script with Node and verified exact value round-trip.
  - The smoke verified raw angle-bracket payloads were not present in the emitted HTML.
- `git.diff` showed only the one sanitizer code-line change plus scoped task metadata.
- `review.run --base origin/stream/general --noTests` timed out at the workspace facade; focused validation covers this one-line shell escaping fix.

## publish note

Ko approved fixing the PR #355 Codex review and then shipping `stream/general` to `main`.

- 2026-05-26 17:16:43 write: `.task/general/fix-runtime-env-backslash-escaping/workpad.md`

## workspace-owned: files changed

- `packages/twenty-front/scripts/inject-runtime-env.sh`

## workspace-owned: activity log

- 2026-05-26 17:16:43 fs.write: `.task/general/fix-runtime-env-backslash-escaping/workpad.md`
