# expand how to speak guide

branch: `task/design/expand-how-to-speak-guide`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1099/expand-how-to-speak-guide
github pr: https://github.com/consuelohq/opensaas/pull/1099
started: 2026-06-16

## acceptance criteria

- [x] Re-ingest the live How To Speak guide and save the packet to durable context.
- [x] Ingest the YouTube source and save the packet to durable context.
- [ ] Preserve the existing guide body and append a new source-derived agent-speech section.
- [ ] Add the canonical Bun render command to the guide.
- [ ] Bump the canonical reader shell from 1.2.0 to 1.3.0 with focused test coverage.
- [ ] Render, validate, and publish the updated guide over `/daily-deep-idea/2026-06-07-how-to-speak` using the current base version.
- [ ] Verify the live page, archive/wiki path, and reader shell markers.

## test-first contract

Behavior under test:

- The canonical reader shell advertises version `1.3.0` in exported metadata, body attributes, and default footer text.
- The guide content change is append-only and uses the existing How To Speak attention-design voice.

Existing local pattern to follow:

- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts` already asserts shell affordances and live How To Speak title behavior.
- Digital guide source is typed `content.json`; rendered HTML is presentation truth; publish is durable archive truth.

New or changed tests:

- Add a focused renderer test that asserts `READER_SHELL_VERSION === '1.3.0'`, `data-reader-shell-version="1.3.0"`, `version:'1.3.0'`, and the generated footer contains `canonical Consuelo reader shell 1.3.0`.

Focused red command:

`bun run test:reader`

Expected red failure:

- The version test fails before implementation because the current source exports `READER_SHELL_VERSION = '1.2.0'`.

No-test waiver:

- The guide body expansion itself is content-only and will be validated by rendering the typed guide, running the reader validator, and browser/page checks instead of a unit test.

## plan

1. Read the ingested live guide and YouTube packet before writing.
2. Update renderer version test first; confirm red.
3. Bump `READER_SHELL_VERSION` to `1.3.0`.
4. Build an append-only typed guide source in `packages/consuelo-design/out/daily-deep-idea/2026-06-07-how-to-speak/content.json`.
5. Render with `bun run wiki:render -- --template guide --input <content.json> --out <index.html>`.
6. Publish with `bun run consuelo-design publish --target <artifact-dir> --path /daily-deep-idea/2026-06-07-how-to-speak --base-version 2026-06-07T16-07-52-102Z`.
7. Validate route, office archive, legacy wiki compatibility, reader markers, review, verify, and task PR state.

## current status

- Both ingests succeeded and were saved to context.
- Current archive version read from the design archive: `2026-06-07T16-07-52-102Z`.
- Existing guide captured from the live page uses the attention-design spine; expansion will append source-specific agent-speech moves rather than rewrite the body.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-16 23:05:33 fs.write: `.task/design/expand-how-to-speak-guide/workpad.md`
- 2026-06-16 23:14:31 fs.write: `.task/design/expand-how-to-speak-guide/workpad.md`
- 2026-06-16: ingested YouTube source `Unzc731iCUY` into context.
- 2026-06-16: ingested live How To Speak guide into context.
- 2026-06-16: read renderer/test/source paths and archive current version.

## workspace-owned: validation evidence

- pending
- 2026-06-16 23:13:39 `consueloDesign.check`: passed — OK
- 2026-06-16 23:14:58 `review.run`: passed — OK
- 2026-06-16 23:15:11 `verify`: passed — OK

## key decisions

- Treat the user-requested most recent 1.3 as a semantic reader shell bump in this task because repo search showed only `1.2.0` currently exists.
- Preserve current guide lessons and append a new section focused on agent/hook speech.
- Use design archive publish, not OS Sites pages, because the live URL is served by the Consuelo design archive under `/office/...` and the current archive registry owns the existing version.

## notes for ko

- The append section should teach agents that hook output is inter-agent speech: state, delta, evidence, risk, next action.

## improvements noticed

- The existing guide footer still says shell 1.0.0 because it was authored in content; the new render should let the 1.3.0 shell footer be the source of truth.

## issues and recovery

- `task.call` failed in this worktree with `Script not found task:exec`; command execution is using `mac.call` with the task worktree cwd as the scoped fallback.

---

## publish checklist

`bun run task:push -- --message "feat(design): expand how to speak guide" --changed`
`bun run task:pr`
`bun run task:finish`

## workspace-owned: files read

- `areas/consuelo-design/AGENTS.md`
- `package.json`
- `packages/consuelo-design/package.json`
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/scripts/validate-consuelo-reader.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/tests/sites-cli.test.ts`
- `packages/workspace/scripts/consuelo-design.ts`

- 2026-06-16 23:11:01 apply-patch: `packages/workspace/scripts/consuelo-design.ts`

## implementation update - 2026-06-16

- Ingested the Winston video source and the current live How To Speak guide; both were saved to context before edits.
- Added a focused reader shell version test, confirmed red on 1.2.0, then bumped the reader shell to 1.3.0.
- Rendered typed guide source under packages/consuelo-design/out/daily-deep-idea/2026-06-07-how-to-speak/.
- Preserved the existing attention-design spine and appended agent-facing sections: agent-speech, agent-hook-packet, and render-contract.
- Added the Bun render command inside the rendered guide.
- Fixed the missing archive root redirect helper in packages/workspace/scripts/consuelo-design.ts, which blocked publish.
- Published the guide as version 2026-06-16T23-12-33-911Z.

## validation update - 2026-06-16

- Red reader test failed as expected on shell version 1.2.0 vs 1.3.0, trace trc_0f635aa04252.
- Green reader test passed with 18 tests and 114 assertions, trace trc_63fe3f61a426.
- Render produced readerShellVersion 1.3.0, trace trc_70594009bb7c.
- Reader validation returned ok true and no missing markers, trace trc_d17def2559d9.
- Final publish succeeded, trace trc_4c60e339ee98.
- Browser validation confirmed the live guide contains the agent-speech appendix, trace trc_fe1478a8a154.
- Browser validation confirmed office and design-wiki indexes show How To Speak first, traces trc_450d4337a78a and trc_80aa8af09d34.
- Syntax check passed for the touched TypeScript scripts, trace trc_f09d32f45608.
- Design boundary check passed, trace trc_e4ddf43735cd.

## publish recovery note

The first publish attempt failed after partial task-local archive state was created. I restored the full archive into the task worktree, republished against the original base version, confirmed the archive retained 20 entries, and copied the materialized archive back to the main Open Design archive so the route survives task cleanup.

- 2026-06-16 23:14:31 append: `.task/design/expand-how-to-speak-guide/workpad.md`

## workspace-owned: test selection

- changed files: `.task/design/expand-how-to-speak-guide/current.json`, `.task/design/expand-how-to-speak-guide/evidence-log.json`, `.task/design/expand-how-to-speak-guide/read-log.json`, `.task/design/expand-how-to-speak-guide/session.json`, `.task/design/expand-how-to-speak-guide/workpad.md`, `.task/tasks/design/expand-how-to-speak-guide.json`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/workspace/scripts/consuelo-design.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
