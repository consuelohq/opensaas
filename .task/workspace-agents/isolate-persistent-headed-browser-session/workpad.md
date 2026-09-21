# isolate persistent headed browser session

branch: `task/workspace-agents/isolate-persistent-headed-browser-session`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2194/isolate-persistent-headed-browser-session
github pr: https://github.com/consuelohq/opensaas/pull/2194
started: 2026-08-26

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 04:22:47 fs.write: `.task/workspace-agents/isolate-persistent-headed-browser-session/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 04:39:11 `review.run`: passed — OK
- 2026-08-26 04:39:22 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: A human-authentication browser handoff owns a dedicated `consuelo-human` agent-browser session. While that session is active, every browser command must target `--session consuelo-human` and preserve `--headed`, so snapshots/clicks/fills/status/navigation cannot silently replace the visible Chrome with a headless process. When no human session is active, ordinary browser commands keep the existing default headless/profile behavior.
existing local pattern: `runBrowserCommandEffect` centrally prefixes the persistent profile for browser commands; `headedBrowserEffect` currently closes all and uses `--headed` only for its own launch/read sequence. agent-browser 0.25.3 has global/default session semantics and will replace a headed Chrome when any later command in that session omits `--headed`. A separate named session protects the profile from unrelated default-session calls, which fail closed on Chrome SingletonLock instead of replacing the visible process.
new or changed tests: Extend mirrored browser-service tests to require a dedicated human session for `browser.headed`, require ordinary commands/status to route through that session with `--headed` while it is active, and require fallback to the default profile path when the human session is absent. Preserve OS/workspace byte parity and the focused `os-browser-headed-handoff` test-selection rule already on the stream.
focused red command: `bun x vitest run packages/os/tests/browser-service.test.ts packages/workspace/tests/browser-service.test.ts -t "human session|headed browser|preserve the current daemon|browser status"`
expected red failure: Current routing has no human-session detection; generic commands/status still use the default profile session and omit `--session consuelo-human --headed`.
no-test waiver: not applicable.

## Runtime evidence

- agent-browser 0.25.3 supports isolated `--session <name>` sessions.
- A visible `consuelo-human` session survived an unheaded command issued to `default`; the default launch failed safely on the profile SingletonLock instead of replacing the human Chrome (`trc_2462d871f6d2`).
- A later `snapshot` issued to `consuelo-human` without `--headed` replaced the visible Chrome with a headless Chrome, proving both session targeting and headed preservation are required for every command during the handoff (`trc_c34ddde7c1fb`, `trc_cbbfdc43da5d`).

## acceptance criteria

- [x] `browser.headed` starts a dedicated human session and leaves a real visible Chrome process running.
- [x] Every browser command routes to the human session with headed preservation while that session exists.
- [x] Ordinary default/headless behavior resumes when no human session exists.
- [x] OS/workspace browser mirrors remain byte-identical.
- [x] Focused browser contracts, strict review, and canonical verify pass.
- [x] Real E2E: headed GitHub window stays visible through snapshot + navigation/interactions.
- [ ] Finish GitHub App creation/configuration using the repaired session, then ship browser fix through stream/main/Canary and update local OS.

## Current evidence

- RED: the new human-session routing expectations failed against the old router (`trc_a89e75c0cbd9`).
- GREEN: 16 focused headed/session contracts pass across both OS and workspace mirrors (`trc_e2ba4cf77179`).
- Real patched-wrapper E2E: `headed -> status -> snap` stayed on one visible Chrome process with no `--headless=new` and session `consuelo-human` (`trc_112cddc78b35`).
- The visible session remained stable through GitHub App creation, multiple snapshots/evals/clicks, a deliberate restart with the same persistent profile, and navigation into Consuelo OAuth.
- GitHub App `consuelo-source-control` was created under `consuelohq`; public GitHub metadata reports Contents read, Issues read, Pull requests write, Metadata read, and no webhook events (`trc_77f43cde352d`).
- Device Authority now lists `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, and `GITHUB_APP_PRIVATE_KEY` as configured Worker secrets (`trc_ee7812d4b62b`). The downloaded temporary private-key file was overwritten after secret publication (`trc_64dc45e4f374`).
- Customer-flow E2E is currently paused at Google's password prompt for `os.consuelohq.com`; Ko must complete that human-only authentication step in the still-open headed window before Connect GitHub can continue.
- A broad run of both browser-service files reached 34/36 passing; the two failures are pre-existing environment fixtures that expect missing `packages/os/tooling/dev-tool-manifest.json`, not browser behavior (`trc_9b742bd88097`). The task's focused changed-behavior suite is green.
- Strict review passed with 0 blocking issues (`trc_6e22086ba23d`).
- Canonical verify passed and is publish-valid (`trc_fac947f11a45`).

- 2026-08-26 04:22:47 append: `.task/workspace-agents/isolate-persistent-headed-browser-session/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/browser/cli.ts`
- `packages/os/scripts/lib/browser/service.ts`
- `packages/os/tests/browser-service.test.ts`
- `packages/workspace/scripts/lib/browser/cli.ts`

- 2026-08-26 04:23:35 apply-patch: `packages/os/tests/browser-service.test.ts`
- 2026-08-26 04:23:35 apply-patch: `packages/workspace/tests/browser-service.test.ts`
- 2026-08-26 04:24:09 apply-patch: `packages/os/scripts/lib/browser/service.ts`
- 2026-08-26 04:24:09 apply-patch: `packages/workspace/scripts/lib/browser/service.ts`

- 2026-08-26 04:38:45 apply-patch: `.task/workspace-agents/isolate-persistent-headed-browser-session/workpad.md`

- 2026-08-26 04:39:30 apply-patch: `.task/workspace-agents/isolate-persistent-headed-browser-session/workpad.md`