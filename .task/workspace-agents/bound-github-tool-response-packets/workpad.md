# bound github tool response packets

branch: `task/workspace-agents/bound-github-tool-response-packets`
stream: `stream/workspace-agents`
taskSession: `tsk_a68dea3315e1`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1041/bound-github-tool-response-packets
github pr: https://github.com/consuelohq/opensaas/pull/1041
started: 2026-06-14

## acceptance criteria

- [x] `packages/workspace/scripts/github.js` emits a bounded packet for every operation instead of raw `data` plus raw `stdout`.
- [x] Packets stay useful: include command, operation metadata, counts, summaries, representative samples, and raw-size omission stats.
- [x] `pr.view --preset review` no longer embeds `summary.raw` or any duplicate full GitHub JSON payload.
- [x] Existing dry-run command expansion behavior remains compatible with the current tests.
- [x] Focused tests prove a large synthetic GitHub response stays bounded and marks omitted payload details.
- [x] `packages/workspace/SCRIPTS.md` documents the bounded packet contract.

## test-first contract

- Behavior under test: default GitHub facade output must be a bounded `github.packet.v1`-style result with counts, samples, and raw-size stats, and it must omit full raw payload duplicates.
- Existing pattern: `packages/workspace/tests/github.test.ts` exercises the CLI with dry-run. The script now exposes a pure packet helper for synthetic payload tests after guarding `main()`.
- New or changed tests: added a large synthetic `pr.view` review payload with many checks, reviews, and files. The test asserts serialized output stays below a small cap, samples are truncated, raw payloads are omitted, and no `summary.raw` exists.
- Focused red command: `bun x vitest run packages/workspace/tests/github.test.ts`.
- Red result: failed as expected with `TypeError: createGithubOutput is not a function` while the existing three tests passed.
- Focused green command: `bun x vitest run packages/workspace/tests/github.test.ts`.
- Green result: passed, 4 tests.
- No-test waiver: none.

## plan

1. Read workspace and coding standards, current GitHub facade implementation, docs, manifest, and tests.
2. Add a focused failing test that models the 675k-token class of failure with synthetic large GitHub payloads.
3. Replace raw `data` / `stdout` emission with a bounded packet helper that keeps detailed summaries and samples.
4. Document the bounded packet behavior in `SCRIPTS.md`.
5. Run focused green tests, syntax/file checks, smoke the CLI, verify, then publish through the task workflow.

## current status

- Implementation complete and verified.
- `github.js` now returns a bounded `github.packet.v1` envelope through `createGithubOutput`.
- Top-level raw `data` and raw `stdout` are no longer emitted by the script output. `pr.view` no longer includes `summary.raw`.
- Live task-branch smoke against PR #1041 returned a packet with summary, bounded check samples, review totals, and raw-size stats. It counted `dataJsonChars` instead of echoing the raw GitHub JSON.
- Full `verify` passed and wrote a publish-valid stamp.

## files changed

- `.task/tasks/workspace-agents/bound-github-tool-response-packets.json`
- `.task/workspace-agents/bound-github-tool-response-packets/current.json`
- `.task/workspace-agents/bound-github-tool-response-packets/evidence-log.json`
- `.task/workspace-agents/bound-github-tool-response-packets/read-log.json`
- `.task/workspace-agents/bound-github-tool-response-packets/session.json`
- `.task/workspace-agents/bound-github-tool-response-packets/verify.json`
- `.task/workspace-agents/bound-github-tool-response-packets/workpad.md`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/github.js`
- `packages/workspace/tests/github.test.ts`

## workspace-owned: files changed

- `.task/tasks/workspace-agents/bound-github-tool-response-packets.json`
- `.task/workspace-agents/bound-github-tool-response-packets/current.json`
- `.task/workspace-agents/bound-github-tool-response-packets/evidence-log.json`
- `.task/workspace-agents/bound-github-tool-response-packets/read-log.json`
- `.task/workspace-agents/bound-github-tool-response-packets/session.json`
- `.task/workspace-agents/bound-github-tool-response-packets/verify.json`
- `.task/workspace-agents/bound-github-tool-response-packets/workpad.md`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/github.js`
- `packages/workspace/tests/github.test.ts`

## workspace-owned: activity log

- 2026-06-14 15:11 ET: stream context showed `stream/workspace-agents` behind `main` by 37 commits.
- 2026-06-14 15:11 ET: ran `stream.sync`; sync succeeded.
- 2026-06-14 15:11 ET: started task branch from `stream/workspace-agents`.
- 2026-06-14 15:12 ET: bounded trace searches for recent GitHub rows returned no visible trace rows.
- 2026-06-14 15:13 ET: read GitHub facade implementation and tests.
- 2026-06-14 15:14 ET: confirmed `github.js` emits raw `data`, raw `stdout`, and `summary.raw` for review preset.
- 2026-06-14 15:15 ET: added focused synthetic large-payload test.
- 2026-06-14 15:15 ET: focused red run failed on missing `createGithubOutput` helper as expected.
- 2026-06-14 15:16 ET: implemented bounded GitHub packet output and helper export.
- 2026-06-14 15:17 ET: documented bounded GitHub output in `SCRIPTS.md`.
- 2026-06-14 15:18 ET: live PR smoke returned bounded packet output.
- 2026-06-14 15:20 ET: full verify passed with publish-valid stamp.
- 2026-06-14 19:20:22 fs.write: `.task/workspace-agents/bound-github-tool-response-packets/workpad.md`

## workspace-owned: validation evidence

- Red: `bun x vitest run packages/workspace/tests/github.test.ts` failed as expected: `TypeError: createGithubOutput is not a function`; 3 existing tests passed.
- Green: `bun x vitest run packages/workspace/tests/github.test.ts` passed; 4 tests.
- Syntax: `node --check packages/workspace/scripts/github.js` passed.
- Check files: `checkFiles` passed for `packages/workspace/scripts/github.js` and `packages/workspace/tests/github.test.ts`.
- Smoke: `bun packages/workspace/scripts/github.js pr.view --pr 1041 --preset review` returned `github.packet.v1` style output with bounded check samples and `raw.dataJsonChars`; no raw `data` or raw `stdout` echo.
- Full verify: `verify --base origin/stream/workspace-agents` passed, review checks passed, workspace audit suite passed, DB guard passed with 0 findings, publish-valid stamp written.

## key decisions

- Fix at the source script (`packages/workspace/scripts/github.js`) rather than in the generic facade executor so every path that invokes the GitHub script receives bounded JSON.
- Keep dry-run command metadata stable for existing tests.
- Preserve detail via samples, counts, preview text, and raw-size stats instead of full raw payloads.
- Leave manifest/schema output as generic `RawOutput` for this task; a future cleanup can add a dedicated packet output schema if needed.

## notes for ko

- ELI5: the GitHub tool was mailing the whole warehouse instead of a labeled box. It now sends a manifest with samples, counts, and size numbers, not the raw crate contents.

## improvements noticed

- `TOOLS.md` still describes the GitHub output as `RawOutput`; if this fix stabilizes the packet shape, a later manifest/schema cleanup could introduce a dedicated GitHub packet output schema.
- `checkFiles` tries `node --check` on markdown files if they are passed directly. Use it for code files only and validate docs through review/verify.

## issues and recovery

- The exact oversized trace did not appear in `context.trace` for this session. Recovered by inspecting the implementation and reproducing the payload class with a synthetic test.
- A first `fs.patch` attempt used unified diff syntax, but this tool requires explicit `from` / `to`; recovered with a `tmp` content file and `fs.patch --content-file`.
- A first `checkFiles` call included `SCRIPTS.md` and failed because markdown is not a Node-checkable file; reran for code/test files and passed.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): bound github facade packets" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/github.js`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/tests/github.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

- 2026-06-14 19:20:22 write: `.task/workspace-agents/bound-github-tool-response-packets/workpad.md`
