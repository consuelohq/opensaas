# add research ingest packet generator

branch: `task/workspace-agents/add-research-ingest-packet-generator`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/365
started: 2026-05-11

## acceptance criteria

- [x] Add a `research:ingest` script that wraps `summarize` and creates a reusable packet directory.
- [x] Default output goes under the OS temp directory so visual frames/slides are temporary by default.
- [x] `--keep` and `--out-dir` support durable output locations.
- [x] `--visual` passes summarize slide/OCR extraction into the run directory with a configurable frame budget.
- [x] Extraction falls back to summary mode when `summarize --extract` is unsupported or empty.
- [x] `--dry-run --json` exposes the planned summarize calls without running external extraction.
- [x] Expose the command through package scripts, workspace facade schema/manifest, and generated docs/types.
- [x] Update `packages/workspace/SCRIPTS.md` with usage and cleanup behavior.
- [x] Validate syntax, dry-run, fake summarize packet generation, generated surfaces, review, and verify.

## plan

1. Read steering, standards, workspace script patterns, facade schema, manifest, docs, and summarize CLI help.
2. Implement `packages/workspace/scripts/research-ingest.js` as a packet generator around `summarize`.
3. Wire `research:ingest` into `package.json`, `tool-manifest.json`, facade schemas, generated docs/types, and `SCRIPTS.md`.
4. Validate with syntax checks, dry-run JSON, fake summarize output, generated surface checks, review, and verify.
5. Push and promote to the stream review PR.

## files changed

- `packages/workspace/scripts/research-ingest.js`
- `package.json`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`

## key decisions

- Use `summarize` as the ingestion engine and keep this wrapper focused on consistent local packet output.
- Default runs write to the OS temp directory returned by `os.tmpdir()`; `--keep` writes to `~/Documents/consuelo-research`.
- Use summarize's native `--slides-dir`, `--slides-max`, and OCR flags for visual extraction instead of implementing separate frame extraction.
- Keep `--dry-run --json` fast and safe for direct CLI testing. Facade `dryRun` validates the built command without executing the script.

## validation

- `summarize --help` inspected; local binary exists at `/opt/homebrew/bin/summarize`.
- `node --check packages/workspace/scripts/research-ingest.js` passed.
- `bun --check packages/workspace/scripts/lib/facade/schemas.ts` passed.
- `bun run research:ingest -- <url> --visual --slides-max 8 --dry-run --json` passed and showed OS-temp output plus slide flags.
- Fake summarize smoke generated `packet.md`, `manifest.json`, `extracted.md`, raw stdout/stderr, confirmed fallback from empty extract to summary, and confirmed `--slides-max` forwarding.
- `bun run generate-types && bun run generate-docs` passed.
- `cd packages/workspace && bun run test tests/facade/facade.test.ts` passed: 439 tests, snapshot updated for `research.ingest`.
- `workspace checkFiles` passed for `research-ingest.js` and `schemas.ts`.
- `workspace audit { scripts: true }` passed: 47 documented, 47 actual, no missing/undocumented scripts.
- `workspace review.run` passed with no findings, confidence 0.81.
- Full `workspace verify` timed out twice through the connector before returning a result. Branch-local `bun run verify -- --base stream/workspace-agents --no-db --json` passed; DB validation is not relevant to this script/docs/tooling-only change.
- `git diff --check` passed.

## notes for ko

- `summarize` supports podcasts, videos, YouTube, local media, slides, OCR, transcriber selection, and `--video-mode` locally.
- `summarize --extract` is unsupported for stdin and non-media local text, so the wrapper intentionally falls back to summary mode when extraction has no usable stdout.
- Default frame/slide output goes inside the run directory under OS temp. Use `--keep` when the packet should survive cleanup.

## improvements noticed

- The new typed `task.exec` timeout field appears to be interpreted in milliseconds when passed inside input. Use the outer workspace tool timeout unless intentionally setting command milliseconds.

## errors i ran into

- `stream.sync` failed because an existing sync worktree owns `stream/workspace-agents`; stream context showed ahead/behind 0, so this was non-blocking.
- A large heredoc write failed because tmux rejected the long command. Switched to workspace `fs.write` and verified with `node --check`.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): add research ingest packet generator" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-11 17:44:30 write: `.task/workpad.md`