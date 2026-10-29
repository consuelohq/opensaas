# Correct trace routing documentation claims

branch: `task/trace-site-makeover/correct-trace-routing-documentation-claims`
stream: `stream/trace-site-makeover`
pr: https://github.com/consuelohq/opensaas/pull/2693
started: 2026-10-29

## acceptance criteria

- [x] Remove the unsupported Work routing claim identified by review, without runtime changes.

## plan

1. Compare the claim with the MCP trace whitelist.
2. Correct the docs only, validate/build, and pass the full gate.
3. Promote through the approved stream and merge; close the original review finding.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(trace-site-makeover): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract and acceptance

- [x] Inspect review #2692 / comment 4417415439 against the MCP trace whitelist at packages/os/scripts/server/routes/mcp.ts:355. Only default/explicit/task are preserved there; documentation must not promise Work provenance.
- [x] Remove the unsupported work route source claim from the trace docs, retaining the verified Local fallback explanation.
- [ ] Docs validate/foundation/build and strict full verify; promote through approved stream, merge to main, and resolve the superseded review claim.

No-test waiver: this is a copy-only correction to an unsupported documentation claim, with no runtime behavior change. Source comparison plus docs validation, existing foundation tests and build replace a new test. Do not widen the UI task into changing route execution or gateway authentication. The tracing runtime release from PR2692 continues independently and remains required through native install verification.

- 2026-10-29 20:27:50 append: `.task/trace-site-makeover/correct-trace-routing-documentation-claims/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 20:27:50 fs.write: `.task/trace-site-makeover/correct-trace-routing-documentation-claims/workpad.md`
- 2026-10-29 20:27:50 apply-patch: `packages/documentation/src/content/docs/observe/traces.mdx`
- 2026-10-29 20:29:47 fs.write: `.task/trace-site-makeover/correct-trace-routing-documentation-claims/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 20:29:00 `verify`: passed — OK

## Validation

- Source inspection confirmed the trace route whitelist accepts default/explicit/task. The docs now match it and retain the verified Local fallback explanation.
- Docs validate and 19 foundation tests passed; build trc_e3d08b640ddd passed after reusing the installed documentation dependencies.
- Full verify trc_3bef5edeb135 is publish-valid, with zero failed suites/findings. No runtime or gateway behavior changed. Main promotion and review resolution pending.

- 2026-10-29 20:29:47 write: `.task/trace-site-makeover/correct-trace-routing-documentation-claims/workpad.md`
