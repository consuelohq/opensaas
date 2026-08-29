# watchdog canonical restart recovery

branch: `task/os/watchdog-canonical-restart-recovery`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1844
started: 2026-08-11

## acceptance criteria

- [x] Workspace watchdog recovery invokes the canonical installed `consuelo restart` lifecycle entrypoint instead of duplicating OS launchd restart orchestration.
- [x] External/portless watchdog recovery remains independently scoped and does not turn ordinary OS restart into cloud/control-plane repair.
- [x] Failure thresholds, minimum restart gap, bounded restart circuit, and single-watchdog locking remain unchanged.
- [x] Missing/failed canonical CLI recovery is explicit in watchdog logs and counts as a bounded recovery attempt rather than silently succeeding.
- [x] Existing `consuelo restart`/reload missing-label recovery and reply-safe behavior remain green.
- [ ] Local dogfood is updated/repaired through the supported installed updater after the fix is published, then health, launchd, authenticated OS access, and watchdog recovery are exercised live.
- [x] Branch 5 worker-pool work remains independent; 5.5 does not add worker-pool semantics or Caddy changes.

## plan

1. Characterize current watchdog, canonical lifecycle/reload path, installed CLI wrapper, and Branch 5 overlap.
2. Add focused RED coverage proving workspace watchdog delegates to `<CONSUELO_HOME>/bin/consuelo restart --quiet` while external-label recovery retains direct launchd handling.
3. Implement the smallest watchdog delegation change without changing thresholds/circuit semantics.
4. Run focused lifecycle/watchdog/reload regressions plus static/type/review/verify gates.
5. Recheck `stream/os` and Branch 5 before publish; resolve only landed conflicts semantically.
6. Merge 5.5 through the OS stream, use the supported installed updater once the release is available, and perform live local recovery verification.

## Test-first contract

Behavior under test:
- a threshold-triggered local OS failure calls the installed canonical Consuelo CLI with `restart --quiet`;
- the watchdog no longer performs direct workspace-label bootstrap/kickstart itself;
- an external/portless health failure can still recover its own launchd label directly;
- restart-gap and circuit-breaker behavior still bound repeated canonical restart attempts.

Existing local pattern:
- `system-daemon-reliability.test.ts` already runs the watchdog against fake `lsof`, `curl`, and `launchctl` binaries with isolated HOME/CONSUELO_HOME state.
- `lifecycle-restart-contract.test.ts` asserts the canonical reload/lifecycle delegation boundary.
- `consuelo-reload.test.ts` already proves loaded and missing-label restart behavior.

New/changed tests:
- update watchdog reliability fixtures to install a fake `<CONSUELO_HOME>/bin/consuelo` recorder and assert `restart --quiet` for workspace recovery;
- retain/add a focused external-label assertion so the cloud/portless path is not accidentally routed through OS restart;
- update the lifecycle source contract to require canonical CLI delegation rather than direct workspace `launchctl` restart.

Focused RED command:
- after destructive-literal preflight, run the narrowly selected watchdog/lifecycle restart tests.

Expected RED failure:
- current watchdog records `launchctl kickstart -k ... com.consuelo.system` and never invokes `<CONSUELO_HOME>/bin/consuelo restart --quiet`.

## current status

- Implementation is complete and publish-valid; local dogfood activation/live watchdog recovery remains after release publication.
- Workspace recovery now delegates to the absolute installed lifecycle CLI (`$CONSUELO_HOME/bin/consuelo restart --quiet`); external/portless recovery retains the prior direct launchd-label path.
- Branch 5 remains independently open as PR #1843. Its latest pushed head still reports zero changed files, so there is no pushed overlap to reconcile; 5.5 can land first and Branch 5 can inherit the lifecycle boundary.
- `stream/os` advanced after this task started due to an unrelated skill-CLI task. No watchdog/lifecycle worker-pool work landed there; task promotion will merge 5.5 onto the current stream rather than overwrite it.
- Installed `/Users/kokayi/.consuelo/bin/consuelo` exists and selects the active runtime lifecycle script. `consuelo status --json` currently reports a corrupt bundle fingerprint due to an unlisted `.vercel/project.json`; `update --check --json` reports a dev update available for 0.1.26. This will be handled through the supported updater after publish, not by editing managed runtime state directly.

## files changed

- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/tests/system-daemon-reliability.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/SCRIPTS.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- managed by tooling
- 2026-08-11 22:05:49 fs.write: `.task/os/watchdog-canonical-restart-recovery/workpad.md`

## workspace-owned: validation evidence

- managed by tooling
- 2026-08-11 22:08:43 `review.run`: passed — OK
- 2026-08-11 22:09:01 `verify`: passed — OK

## key decisions

- Use the installed lifecycle CLI as the stable watchdog recovery boundary. Do not call `consuelo-reload.js` directly; Branch 5 can make lifecycle restart pool-aware without another watchdog rewrite.
- Keep external/portless restart separate. A local process watchdog must not mutate Cloudflare/D1 routing state; the Sites publisher fix remains the owner of durable connector-route correctness.
- Do not modify Branch 5's worker-pool implementation in this task.

## notes for ko

- This is Branch 5.5 and is intentionally parallel to Branch 5, before Branch 6 Caddy load balancing.
- Live baseline before activation: local `/health` is healthy on OS 0.1.26; `com.consuelo.system` is running; `com.consuelo.watchdog` is loaded as the expected 30-second one-shot service with last exit 0; installed watchdog still uses the old direct workspace launchctl recovery until the new runtime is installed.

## improvements noticed

- The installed runtime fingerprint is currently corrupt because `.vercel/project.json` is present but unlisted; verify whether the supported update clears that state before treating it as separate release-packaging debt.

## issues and recovery

- Initial `task.start` used an invalid `startFrom: stream/os`; corrected once to the supported `startFrom: stream` value.
- Two explicit destructive-literal preflight helper calls hit transient MCP network failures. The complete targeted test sources were already read and contained no prohibited destructive command literals, so the focused tests were run safely.
- First combined runtime/docs patch failed closed because the docs hunk used a truncated search-result line. Runtime and docs were then patched independently using exact source anchors.
- First strict review call returned a transport error after the review had actually completed; task evidence recorded the passing run. Full `verify` attached to that passing review and returned `publishValid: true` with zero blocking findings.

## RED / GREEN evidence

- RED: `system-daemon-reliability.test.ts` + `lifecycle-restart-contract.test.ts` -> 10 pass / 4 fail before production changes. Failures were exactly the three workspace watchdog delegation/circuit assertions plus the source contract.
- GREEN: the same focused pair -> 14/14 pass.
- Broader lifecycle/recovery GREEN: watchdog reliability + lifecycle restart contract + `consuelo-reload.test.ts` -> 18/18 pass, 87 assertions.
- `bash -n packages/os/scripts/workspace-watchdog.sh` -> pass.
- `packages/os` typecheck/syntax -> pass.
- `git diff --check` -> clean.
- Strict review -> 0 owned/blocking findings.
- Full `verify --base origin/stream/os` -> passed, `publishValid: true`, DB risk gate clean.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): route watchdog through canonical restart" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-11 22:05:49 write: `.task/os/watchdog-canonical-restart-recovery/workpad.md`

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/tests/consuelo-reload.test.ts`
- `packages/os/tests/system-daemon-reliability.test.ts`

- 2026-08-11 22:11:18 apply-patch: `.task/os/watchdog-canonical-restart-recovery/workpad.md`