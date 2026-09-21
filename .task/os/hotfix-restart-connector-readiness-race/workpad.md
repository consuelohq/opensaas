# hotfix restart connector readiness race

branch: `task/os/hotfix-restart-connector-readiness-race`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2366
started: 2026-09-01

## acceptance criteria

- [x] Reproduce the redundant public-health gate as a focused deterministic failure.
- [x] Accept only after the existing heartbeat reports routable public MCP readiness.
- [x] Preserve fail-closed behavior for missing connector configuration and failed heartbeats.
- [x] Pass the focused lifecycle and heartbeat suites plus OS syntax/type validation.
- [ ] Ship the hotfix to `stream/os`, complete one review round, and promote the resulting signed runtime to canary.

## plan

1. Correlate local lifecycle, heartbeat, Caddy, and public MCP evidence.
2. Add a focused regression before changing connector readiness.
3. Remove the redundant outer health gate while retaining the stronger heartbeat proof.
4. Verify, review once, publish to `stream/os`, then promote and install the canary runtime.

## files changed

- `packages/os/scripts/lib/lifecycle/connector-readiness.ts`
- `packages/os/tests/lifecycle-connector-readiness.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## key decisions

- Treat `workspace-node-heartbeat.ts` as the authoritative acceptance probe because it already checks connector health, reconciles authority routing, and performs a signed public `/mcp` request.
- Remove only the preliminary `/health` gate; keep bounded retries and every existing `routeReady` / `mcpReady` fail-closed condition.

## notes for ko

- This is an acceptance-race hotfix. It does not reset connector credentials, weaken authorization, or alter route ownership.

## improvements noticed

- none yet

## errors i ran into

- The first task start omitted the required area and was retried with `area=os`.
- The regression harness initially reached `Bun.spawn` under Node-based Vitest; the test now stubs the Bun child process deterministically.
- The first full verifier fell through to the broad OS package suite, overloaded the installed node, and failed. A focused exclusive selector now owns connector-readiness changes; the bounded verifier then passed.

## validation evidence

- RED: focused connector-readiness test failed with `expected false to be true`.
- GREEN: focused connector-readiness test passed 1/1.
- Focused suite: lifecycle, connector readiness, heartbeat script, and heartbeat client passed 81/81 across 4 files.
- OS syntax/type validation: `bun --cwd packages/os run typecheck` exited 0.
- Selector contract went RED on the broad OS package fallback, then GREEN after adding and regenerating `os-lifecycle-connector-readiness`.
- Full publish verification passed with `publishValid: true`; the single requested review round found 0 issues and 0 blockers, and the DB guard found 0 risks.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: lifecycle connector readiness must trust a successful signed public MCP heartbeat even when the separate public /health probe is transiently unavailable after a local restart.
existing local pattern: workspace-node-heartbeat.ts already verifies connector health, reconciles authority routing, and performs a signed public /mcp tools/list request; connector-readiness.ts currently performs a redundant /health gate before invoking that stronger proof.
new or changed tests: add packages/os/tests/lifecycle-connector-readiness.test.ts with a stub heartbeat that reports routeReady=true and mcpReady=true while global fetch returns 503; acceptance must succeed and must not depend on the redundant outer health request.
focused red command: bun --cwd packages/os test tests/lifecycle-connector-readiness.test.ts
expected red failure: current connector readiness returns false because the 503 outer /health response suppresses the successful heartbeat proof.
no-test waiver: not applicable

## Incident evidence

- Installed runtime is valid canary 0.1.99, bundle sha256:8dcf43c90265d8fff4bbe1f4b4782a1b137a4fb2afefa14321703f15dd3a3f0c.
- Three 2026-09-01 restart attempts reached local health, reported advisory connectivity false, entered connector-readiness, and never recorded completion.
- Current public MCP traffic and heartbeat state recovered to routeReady=true and mcpReady=true without reinstall/reset, proving an intermittent acceptance failure rather than a persistent connector outage.
- Caddy recorded transient worker readiness timeouts and brief 502/connection-refused windows that recovered within seconds.

- 2026-09-01 17:12:17 append: `.task/os/hotfix-restart-connector-readiness-race/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 17:12:17 fs.write: `.task/os/hotfix-restart-connector-readiness-race/workpad.md`

- 2026-09-01 17:12:53 apply-patch: `packages/os/tests/lifecycle-connector-readiness.test.ts`
- 2026-09-01 17:13:20 apply-patch: `packages/os/scripts/lib/lifecycle/connector-readiness.ts`
- 2026-09-01 17:14:12 apply-patch: `packages/os/tests/lifecycle-connector-readiness.test.ts`

## workspace-owned: files read

- none yet

## workspace-owned: validation evidence

- RED: focused connector-readiness test failed with `expected false to be true`.
- GREEN: focused connector-readiness test passed 1/1.
- Focused suite: lifecycle, connector readiness, heartbeat script, and heartbeat client passed 81/81 across 4 files.
- OS syntax/type validation: `bun --cwd packages/os run typecheck` exited 0.
- 2026-09-01 17:16:57 `verify`: failed — COMMAND_FAILED
- 2026-09-01 17:19:14 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-01 17:19:32 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-09-01 17:20:52 `verify`: passed — OK

- 2026-09-01 17:21:28 apply-patch: `.task/os/hotfix-restart-connector-readiness-race/workpad.md`