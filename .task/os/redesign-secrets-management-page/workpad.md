# redesign-secrets-management-page

branch: `task/os/redesign-secrets-management-page`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2035/redesign-secrets-management-page
github pr: https://github.com/consuelohq/opensaas/pull/2035
started: 2026-08-15

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

- 2026-08-15 06:49:23 fs.write: `.task/os/redesign-secrets-management-page/workpad.md`
- 2026-08-15 06:51:54 fs.write: `.task/os/redesign-secrets-management-page/workpad.md`
- 2026-08-15 06:57:53 fs.write: `.task/os/redesign-secrets-management-page/workpad.md`
- 2026-08-15 07:14:21 fs.write: `.task/os/redesign-secrets-management-page/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 06:59:51 `verify`: failed — COMMAND_FAILED
- 2026-08-15 07:01:38 `verify`: failed — COMMAND_FAILED
- 2026-08-15 07:14:01 `verify`: passed — OK

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

behavior under test: Secrets page provides a concise redaction-safe management surface with a clear Add secret control, safe secret creation flow, persistent visibility of configured secret metadata without exposing values, and no duplicated explanatory copy.
existing local pattern: pending focused discovery of current secrets renderer, secret gateway endpoints, and existing redaction/storage contracts.
new or changed tests: add/extend Secrets site and gateway tests for Add secret UI, submit path, redacted metadata rendering, empty state, and no plaintext secret values in rendered HTML/snapshots.
focused red command: pending after locating the existing Secrets tests.
expected red failure: current Secrets page lacks an Add secret control/creation form and currently renders the old verbose empty-state copy.
no-test waiver: not applicable.

Parallel-task boundary: do not modify Overview default routing, shared workspace route menu ordering/Guides, shared top-bar centering, or global light/dark mode behavior; another agent owns those changes.

- 2026-08-15 06:49:23 append: `.task/os/redesign-secrets-management-page/workpad.md`

Focused RED: `bun --cwd packages/os test tests/secrets-surface.test.ts tests/secrets-hono-routes.test.ts` failed as expected (`trc_90046e7759f6`): write service count is still 1, `/gateway/secrets/setup` and `/install` are 404, and the rendered page lacks search/add/browser-sealing UI and still contains the old duplicated warning copy.

- 2026-08-15 06:51:54 append: `.task/os/redesign-secrets-management-page/workpad.md`

## Implementation status

Acceptance criteria:
- [x] Secrets page is compact: one short lede, searchable inventory, masked stored-value indicator, and clear `+ New secret` action.
- [x] New/replace flow never posts plaintext: browser WebCrypto seals with X25519 + HKDF-SHA256 + AES-GCM before `/gateway/secrets/install`.
- [x] Node setup endpoint returns only the signed node's public X25519 key; install returns descriptor metadata only.
- [x] Plaintext payloads, recipient mismatches, and cross-workspace/node binding overwrites are rejected without echoing secret values.
- [x] No reveal/value endpoint exists.
- [x] Signed Workspace Edge routes distinguish `/gateway/secrets/install` as a write surface and the full edge -> node bridge is covered.
- [x] Secrets UI/client/styles live in `secrets-site.ts`; shared workspace chrome/menu/default-route/mobile/theme code is untouched for the parallel Overview task.
- [x] Secret-specific styles use semantic site tokens so they inherit the shared light/dark theme work.

Validation so far:
- RED before implementation: `trc_90046e7759f6` (9 expected failures: no write registration/routes/UI/sealing flow).
- Focused GREEN: `trc_d38967fbfc37` (51 tests) plus browser WebCrypto/server interoperability `trc_05a7b49498c8`.
- Bun-native signed edge integration + explicit route policy GREEN: `trc_fdc1b8fdee45` (16 tests).
- A prior grouped Vitest invocation (`trc_632f8b223e67`) also exposed an existing runner mismatch for Bun-native `bun:sqlite`; the same affected bridge/policy tests pass under their Bun-native runner above.

Key files:
- `packages/os/scripts/lib/secrets-site.ts` — isolated Railway/Tufte-style Secrets UI and browser sealing ceremony.
- `packages/os/scripts/server/routes/secrets.ts` — public-key setup + sealed install endpoints.
- `packages/os/scripts/lib/node-sealed-credential-store.ts` — ownership guard for binding IDs.
- `packages/os/scripts/lib/consuelo-sites-secrets-adapter.ts`, `workspace-edge-route-seed.ts`, route policy/type files — signed read/write routing.
- Secrets surface/Hono/store/settings/edge integration tests updated or added.

- 2026-08-15 06:57:53 append: `.task/os/redesign-secrets-management-page/workpad.md`

## Final verification and test taxonomy

- Existing `os-internal-workspace-shell` suite was coupling shell rendering to the unrelated flaky local-agent MCP handshake test. TDD RED `trc_55e30977f650` proved the taxonomy bug.
- Split `local-agent-connectivity.ts` / `local-agent-connectivity.test.ts` into dedicated critical exclusive `os-local-agent-connectivity`; shell coverage no longer runs that unrelated handshake test. Focused GREEN `trc_fd31e3f454e2`; full test-selection registry GREEN `trc_eb0b72846a24` (39/39).
- Full selected-suite run is GREEN with no failed suites: `trc_b1497fe4e857`. Secrets-specific contracts: 52 sealed/UI/store tests, 16 Bun-native signed edge-to-node tests, syntax, plus existing Workspace Edge route preservation coverage all pass.
- Formal review + verifier: `trc_1d52a141c0f8` — 0 review findings, DB route-seed warning only, verification passed, `publishValid: true`.
- Final working tree contains only Secrets/runtime routing/tests, focused test-selection taxonomy, and task metadata. No `workspace-chrome.ts`, Overview/default-route implementation, route-menu/Guides/Documentation UI, mobile centering, or global theme implementation is changed by this task.

Delivery policy: keep PR #2035 separate and do not merge it automatically, because Ko explicitly branched the conversation to avoid colliding with the parallel Overview/navigation/theme task.

- 2026-08-15 07:14:21 append: `.task/os/redesign-secrets-management-page/workpad.md`
