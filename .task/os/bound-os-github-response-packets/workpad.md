# bound OS GitHub response packets

branch: `task/os/bound-os-github-response-packets`
stream: `stream/os`
taskSession: `tsk_f8f304a2adec`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1042/bound-os-github-response-packets
github pr: https://github.com/consuelohq/opensaas/pull/1042
started: 2026-06-14

## acceptance criteria

- [x] `packages/os/scripts/github.js` emits bounded `github.packet.v1` output instead of raw GitHub `data`, raw `stdout`, and duplicated `summary.raw`.
- [x] Output remains useful: operation metadata, command, counts, summaries, bounded samples, and raw-size omission stats.
- [x] Existing dry-run command expansion behavior stays compatible.
- [x] OS-local regression test proves large synthetic GitHub payloads stay bounded and raw payloads are omitted.
- [x] `packages/os/SCRIPTS.md` documents the bounded packet contract.
- [x] Focused OS tests, syntax checks, smoke output, and verify run against `origin/stream/os` before publish.

## test-first contract

Behavior under test:

- OS GitHub facade output must omit full raw payloads and emit a bounded packet for large PR review payloads.
- `pr.view --preset review` must not embed `summary.raw`.
- Existing dry-run command generation must remain stable.

Existing local pattern:

- There was no OS-specific GitHub test file. Added `packages/os/tests/github.test.ts`, mirroring the workspace CLI test pattern against `packages/os/scripts/github.js`.

New or changed tests:

- Added a synthetic large-payload test that imports `createGithubOutput` from `packages/os/scripts/github.js` after guarding `main()`.
- Kept dry-run coverage for `pr.view`, `branch.compare`, and raw reason validation.

Focused red command:

- `bun --cwd packages/os test tests/github.test.ts`

Red result:

- Failed as expected with `TypeError: createGithubOutput is not a function`; 3 existing command-shape tests passed.

Focused green command:

- `bun --cwd packages/os test tests/github.test.ts`

Green result:

- Passed; 4 tests.

No-test waiver:

- None. Focused test added and run red/green.

## plan

1. Confirm OS has the same raw-output GitHub implementation.
2. Add OS-local failing regression test.
3. Port bounded packet helper/output from workspace GitHub script into OS GitHub script.
4. Document bounded output in `packages/os/SCRIPTS.md`.
5. Run focused green, syntax checks, live smoke, verify, push, promote to stream, and finish.

## current status

- Implementation complete and verified.
- `packages/os/scripts/github.js` now returns bounded `github.packet.v1` output through `createGithubOutput`.
- Top-level raw `data`, raw `stdout`, and `summary.raw` are removed from OS GitHub output.
- Live task-branch smoke against PR #1042 returned summary/details/raw-size stats and counted `dataJsonChars` rather than echoing raw GitHub JSON.
- Full `verify --base origin/stream/os` passed and wrote a publish-valid stamp.

## files changed

- `.task/os/bound-os-github-response-packets/current.json`
- `.task/os/bound-os-github-response-packets/evidence-log.json`
- `.task/os/bound-os-github-response-packets/read-log.json`
- `.task/os/bound-os-github-response-packets/session.json`
- `.task/os/bound-os-github-response-packets/verify.json`
- `.task/os/bound-os-github-response-packets/workpad.md`
- `.task/tasks/os/bound-os-github-response-packets.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/github.js`
- `packages/os/tests/github.test.ts`

## workspace-owned: files changed

- `.task/os/bound-os-github-response-packets/current.json`
- `.task/os/bound-os-github-response-packets/evidence-log.json`
- `.task/os/bound-os-github-response-packets/read-log.json`
- `.task/os/bound-os-github-response-packets/session.json`
- `.task/os/bound-os-github-response-packets/verify.json`
- `.task/os/bound-os-github-response-packets/workpad.md`
- `.task/tasks/os/bound-os-github-response-packets.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/github.js`
- `packages/os/tests/github.test.ts`

## workspace-owned: activity log

- 2026-06-14 17:06 ET: `stream.context` for `os` showed `stream/os` behind `main` by 12 commits and multiple active task PRs/worktrees.
- 2026-06-14 17:06 ET: `stream.sync` merged latest `main` into local `stream/os`; sync checks had pre-existing temporary-worktree module resolution failures.
- 2026-06-14 17:07 ET: started task branch from `stream/os` with taskSession `tsk_f8f304a2adec`.
- 2026-06-14 17:08 ET: read OS GitHub script and confirmed raw output issue.
- 2026-06-14 17:09 ET: added OS-local GitHub regression test.
- 2026-06-14 17:09 ET: focused red run failed on missing `createGithubOutput` as expected.
- 2026-06-14 17:10 ET: implemented bounded packet output in `packages/os/scripts/github.js`.
- 2026-06-14 17:10 ET: focused green run passed.
- 2026-06-14 17:11 ET: documented bounded GitHub output in `packages/os/SCRIPTS.md`.
- 2026-06-14 17:11 ET: code syntax checks passed.
- 2026-06-14 17:12 ET: live PR smoke returned bounded packet output.
- 2026-06-14 17:12 ET: full verify passed and wrote publish-valid stamp.
- 2026-06-14 21:13:11 fs.write: `.task/os/bound-os-github-response-packets/workpad.md`

## workspace-owned: validation evidence

- Red: `bun --cwd packages/os test tests/github.test.ts` failed as expected: `TypeError: createGithubOutput is not a function`; 3 existing tests passed.
- Green: `bun --cwd packages/os test tests/github.test.ts` passed; 4 tests.
- Syntax: `checkFiles` passed for `packages/os/scripts/github.js` and `packages/os/tests/github.test.ts`.
- Smoke: `bun packages/os/scripts/github.js pr.view --pr 1042 --preset review` returned bounded output with summary/details/raw-size stats and `raw.dataJsonChars`; no raw `data` or `stdout` echo.
- Full verify: `verify --base origin/stream/os` passed. Review static rules, eslint, typecheck, and spec compliance passed. DB guard passed with 0 findings. Publish-valid stamp written.
- Verify note: registry selected zero suites; focused OS GitHub test was run manually and recorded above.

## key decisions

- This is an OS-surface fix, not just a workspace fix.
- Keep manifest/schema output as generic raw output for now; this task changes runtime packet behavior and docs.
- Match the workspace packet contract exactly enough for agents to rely on the same `github.packet.v1` shape across both surfaces.

## notes for ko

- ELI5: OS had its own copy of the GitHub tool, and it was still sending the giant box. It now sends the same bounded manifest packet as workspace: samples, counts, and size numbers, not the raw crate contents.

## improvements noticed

- OS and workspace currently duplicate `github.js`; a future cleanup should share the packet builder or generate both copies from one source.

## issues and recovery

- `stream.sync` verification failed in the stream sync worktree because dependency modules were unavailable from that temporary worktree (`zod`, Nx modules). The stream merge itself succeeded, and focused task-worktree validation passed.
- A repeated focused test command was blocked by tool safety after already passing once. Did not depend on the retry; used the existing green evidence and proceeded with syntax/smoke/verify.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): bound github facade packets" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/scripts/github.js`
- `packages/os/SCRIPTS.md`
- `packages/os/TOOLS.md`
- `packages/os/manifests/tool.manifest.json`

- 2026-06-14 21:13:11 write: `.task/os/bound-os-github-response-packets/workpad.md`
