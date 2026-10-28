# Regenerate Cloudflared connector definitions from managed runtime binary

branch: `task/os/regenerate-cloudflared-connector-definitions-from-managed-runtime-binary`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2124/regenerate-cloudflared-connector-definitions-from-managed-runtime-binary
github pr: https://github.com/consuelohq/opensaas/pull/2124
started: 2026-08-16

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

- 2026-08-16 04:11:37 fs.write: `.task/os/regenerate-cloudflared-connector-definitions-from-managed-runtime-binary/workpad.md`
- 2026-08-16 04:20:37 fs.write: `.task/os/regenerate-cloudflared-connector-definitions-from-managed-runtime-binary/workpad.md`
- 2026-08-16 04:21:53 fs.write: `.task/os/regenerate-cloudflared-connector-definitions-from-managed-runtime-binary/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 04:21:29 `review.run`: passed — OK
- 2026-08-16 04:21:45 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: after ingress dependency reconciliation persists a managed `CLOUDFLARED_BIN`, `install-system-daemons.sh --definitions-only` must rewrite every generated Cloudflared connector LaunchAgent to that persisted managed binary before copying it into `~/Library/LaunchAgents`, while leaving the loaded tunnel process untouched.
existing local pattern: dynamic connector plists live under `node/security/generated` and are collected/copied by `install-system-daemons.sh`; generic Caddy/system plists are regenerated separately. The state `.env` already contains the verified `CLOUDFLARED_BIN` path after the preceding updater step.
new or changed tests: extend the focused `runtime-ingress-dependency-convergence.test.ts` suite to reproduce a generated connector plist whose ProgramArguments[0] is stale and require definitions reconciliation to point at the persisted managed path. Keep lifecycle ingress tests proving no Cloudflared launchctl restart during routine update.
focused red command: `bun x vitest run packages/os/tests/runtime-ingress-dependency-convergence.test.ts`
expected red failure: current installer copies the generated connector plist unchanged, so the stale executable path remains in both generated and installed definitions.
no-test waiver: none.

## Live reproduction
- Managed Cloudflared 2026.6.1 was installed and persisted successfully (`trc_072104c51e32`).
- Running definitions-only afterward still produced `/opt/homebrew/bin/cloudflared` in the connector LaunchAgent (`trc_e7b0938f500c`), proving the dynamic connector plist is a separate reconciliation surface.

- 2026-08-16 04:11:37 append: `.task/os/regenerate-cloudflared-connector-definitions-from-managed-runtime-binary/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/tests/runtime-ingress-dependency-convergence.test.ts`

## RED / GREEN evidence
- RED `trc_22f1b0f67794`: focused suite failed because connector plist reconciliation did not exist.
- First live definitions-only attempt (`trc_2ab8eb86536e`) exposed a BSD sed portability failure under production `set -e`; replaced extraction with portable awk and tightened the test shell to `set -euo pipefail`.
- Focused GREEN (`trc_c245e93dd8e0`): 24/24 across runtime ingress dependencies, lifecycle ingress continuity, and lifecycle restart contract; shell syntax passed.
- Live definitions-only GREEN (`trc_6b8a3878353a`): generated and installed Cloudflared connector plists now use `/Users/kokayi/.consuelo/bin/cloudflared`; loaded tunnel PID 46294 was unchanged because definitions-only does not restart services.

- 2026-08-16 04:20:37 append: `.task/os/regenerate-cloudflared-connector-definitions-from-managed-runtime-binary/workpad.md`

## Final gate
- Critical lifecycle/platform gate: 200/200 passed; syntax passed; lifecycle facade 9/9; selection 39/39 (`trc_f26985ab6e8b`).
- Strict review: 0 issues / 0 blockers (`trc_7cbd0f6bd4d5`).
- Formal verify: `publishValid=true` (`trc_f2d7e1867e51`).
- Acceptance criteria complete: dynamic Cloudflared definitions converge to the persisted managed binary without restarting the live tunnel.

- 2026-08-16 04:21:53 append: `.task/os/regenerate-cloudflared-connector-definitions-from-managed-runtime-binary/workpad.md`
