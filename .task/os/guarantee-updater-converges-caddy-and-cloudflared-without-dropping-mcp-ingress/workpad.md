# Guarantee updater converges Caddy and Cloudflared without dropping MCP ingress

branch: `task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2122/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress
github pr: https://github.com/consuelohq/opensaas/pull/2122
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

- 2026-08-16 03:53:13 fs.write: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`
- 2026-08-16 03:56:19 fs.write: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`
- 2026-08-16 04:00:06 fs.write: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`
- 2026-08-16 04:01:57 fs.write: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`
- 2026-08-16 04:02:33 fs.write: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 04:00:34 `review.run`: passed — OK
- 2026-08-16 04:02:08 `review.run`: passed — OK
- 2026-08-16 04:02:27 `verify`: passed — OK

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

behavior under test: `consuelo update` must converge the full managed local runtime, including OS workers, generated Caddy config/service definition, Cloudflared service definition/managed binary, heartbeat/watchdog/availability sidecars, while preserving public MCP ingress. Same-version update must reconcile drift instead of returning early. Routine convergence must not bounce healthy Caddy/Cloudflared merely because OS workers roll.
existing local pattern: lifecycle engine activates immutable runtime, then delegates service reconciliation to helpers from that exact active runtime; gateway/service installers and lifecycle continuity tests already protect rolling workers and non-destructive ingress.
new or changed tests: first audit existing lifecycle/service/installer tests. If they do not prove Caddy + Cloudflared artifact/definition reconciliation on both new-version and same-version update, add the narrow missing contract(s) before production edits.
focused red command: pending exact test selection after source audit; expected to be a focused lifecycle/service contract, not the package-wide OS suite.
expected red failure: updater either skips managed gateway reconciliation, follows stale runtime helpers, or reconciles definitions without updating the corresponding managed artifact/service state.
no-test waiver: none; updater convergence is lifecycle behavior and requires executable coverage.

- 2026-08-16 03:53:13 append: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`

## workspace-owned: files read

- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/reference/configuration.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/tests/lifecycle-ingress-continuity.test.ts`

## RED evidence
- Live audit: `~/.consuelo/bin/caddy` is pinned v2.11.4, but `~/.consuelo/bin/cloudflared` is absent and the installed connector LaunchAgent still points at Homebrew `/opt/homebrew/bin/cloudflared` v2026.1.2 while runtime bootstrap pins 2026.6.1.
- Focused RED (`trc_eef18c12287f`): Cloudflared test fails because `cloudflared_version_matches` does not exist; lifecycle restart test fails because candidate runtime does not run a runtime-dependency reconciliation step before refreshing daemon definitions.
- Broad installer fixture has unrelated telemetry/setup drift; it is not being used as RED evidence for this task.

- 2026-08-16 03:56:19 append: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`

## Acceptance criteria
- [x] Same/new-version lifecycle reconciliation invokes the activated runtime's pinned ingress dependency reconcile before daemon-definition refresh.
- [x] Stale Cloudflared binaries are rejected by version and replaced with the pinned checksum-verified managed binary path.
- [x] Dependency-only reconciliation returns before onboarding/runtime install and persists only Caddy/Cloudflared paths.
- [x] Caddy/Cloudflared loaded services remain outside the routine sidecar restart loop; rolling worker continuity stays intact.
- [x] Older rollback runtimes that do not know the new dependency-only flag remain compatible under explicit recovery fallback.
- [x] `bootstrap.sh` and the focused ingress-dependency suite are owned by the critical exclusive `os-lifecycle-update-handoff` selector.

## Validation
- Candidate dry-run against this Mac (`trc_2245609077a2`): Caddy v2.11.4 accepted; stale/missing managed Cloudflared detected and planned for `~/.consuelo/bin/cloudflared`; no onboarding.
- Critical lifecycle/platform gate: 199/199 passed; lifecycle facade 9/9 passed; syntax passed; selection registry tests 39/39 passed (`trc_0f2d21254888`).

- 2026-08-16 04:00:06 append: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`

## Documentation
- Public Astro/Starlight install docs now explain pinned Caddy/Cloudflared convergence before definition refresh while loaded ingress remains up during routine worker rolling replacement.
- Configuration reference documents the machine-local persisted `CADDY_BIN` / `CLOUDFLARED_BIN` paths and warns against bypassing version/checksum reconciliation.
- Documentation validation and foundation tests passed: 19/19 (`trc_bacf73a10e6d`).

- 2026-08-16 04:01:57 append: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`

## Final gate
- Strict review after docs: 0 issues / 0 blockers / 0 docs opportunities (`trc_be320b6cf0e3`).
- Formal verify: `publishValid=true` (`trc_c00bf0fe8921`).

- 2026-08-16 04:02:33 append: `.task/os/guarantee-updater-converges-caddy-and-cloudflared-without-dropping-mcp-ingress/workpad.md`
