# fix Explore gateway identity and runtime routing

branch: `task/explore/fix-explore-gateway-identity-and-runtime-routing`
stream: `stream/explore`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2076/fix-explore-gateway-identity-and-runtime-routing
github pr: https://github.com/consuelohq/opensaas/pull/2076
started: 2026-08-15

## acceptance criteria

- [x] Treat `gateway.consuelohq.com/v1/os/semantic-embeddings` as a platform-global route that bypasses workspace-host lookup.
- [x] Keep the Consuelo/OpenRouter credential server-side and expose only the approved Qwen3 embedding operation, never a general OpenRouter proxy.
- [x] Enforce server-side batch/item/total-size caps plus per-install and per-IP rate limits before provider spend.
- [x] Give ordinary Explore clients a stable private pseudonymous `ins_<uuid>` identity without requiring workspace auth.
- [x] Route installed facade `explore` execution through the installed `packages/os` runtime instead of the deprecated repo-root/workspace script.
- [x] Add focused publish-gating tests and avoid selecting the historically red package-wide OS suite.
- [x] Deploy the verified worker and prove the public endpoint returns a real 2560-D embedding while non-embedding compatibility routes remain closed.

## plan

1. Trace wildcard hostname routing, embedding client identity, and facade command CWD.
2. TDD the global edge route, fixed provider contract, rate limits, persistent install identity, and runtime facade routing.
3. Add deployment/readiness configuration and focused test-selection ownership.
4. Run Explore + manifest regressions, strict review, full verify, and Cloudflare dry-run.
5. Provision the existing managed OpenRouter credential into the Worker secret store, deploy, live-smoke the endpoint, then publish to `stream/explore`.

## current status

- Implementation complete and production worker deployed.
- Focused Explore/embedding suite: 8 files / 41 tests green.
- Tool manifest/layout regression: 3 files / 21 tests green.
- Strict review: 0 task-owned issues / 0 blockers; one unrelated openworkspace typecheck issue remains classified pre-existing.
- Canonical verify: full mode, publish-valid stamp written.
- Live gateway smoke: one finite 2560-D embedding returned successfully from `https://gateway.consuelohq.com/v1/os/semantic-embeddings`.
- Live confinement smoke: `/v1/chat/completions` => 404; GET semantic endpoint => 405 with `Allow: POST`.
- Pending task push and promotion into `stream/explore`.

## files changed

- `packages/os/cloudflare/workspace-edge/src/semantic-embedding-gateway.ts`
- `packages/os/tests/explore-runtime-routing.test.ts`
- `packages/os/tests/semantic-embedding-edge-gateway.test.ts`
- `packages/os/tests/semantic-embedding-identity.test.ts`

## workspace-owned: files changed

- `packages/os/cloudflare/workspace-edge/src/semantic-embedding-gateway.ts`
- `packages/os/tests/explore-runtime-routing.test.ts`
- `packages/os/tests/semantic-embedding-edge-gateway.test.ts`
- `packages/os/tests/semantic-embedding-identity.test.ts`

## workspace-owned: activity log

- 2026-08-15 18:30:39 fs.write: `.task/explore/fix-explore-gateway-identity-and-runtime-routing/workpad.md`
- 2026-08-15 18:33:49 fs.write: `.task/explore/fix-explore-gateway-identity-and-runtime-routing/workpad.md`
- 2026-08-15 18:35:19 fs.write: `packages/os/tests/semantic-embedding-edge-gateway.test.ts`
- 2026-08-15 18:35:27 fs.write: `packages/os/tests/semantic-embedding-identity.test.ts`
- 2026-08-15 18:35:32 fs.write: `packages/os/tests/explore-runtime-routing.test.ts`
- 2026-08-15 18:36:26 fs.write: `packages/os/cloudflare/workspace-edge/src/semantic-embedding-gateway.ts`

## workspace-owned: validation evidence

- 2026-08-15 18:40:10 `review.run`: passed — OK
- 2026-08-15 18:40:40 `verify`: failed — COMMAND_FAILED
- 2026-08-15 18:41:57 `verify`: passed — OK
- 2026-08-15 18:43:31 `verify`: passed — OK

## key decisions

- The free hosted embedding service is intentionally platform-global and does not depend on workspace registration or workspace auth.
- `workspace-edge` owns the wildcard hostname, so the semantic gateway is intercepted before the workspace router instead of adding a fake workspace-host registry entry.
- The Worker hard-codes `qwen/qwen3-embedding-4b`, 2560 dimensions, the OpenRouter embeddings URL, strict request keys/content hashes, POST-only semantics, and 32-item / 4k-char-per-item / 128k-total caps.
- Cloudflare abuse ceilings are 600 requests/minute per pseudonymous install and 1,200 requests/minute per IP. Missing limiter bindings fail closed before provider spend.
- The legacy Keychain credential `pi-proxy-openrouter-api-key` is reused only to provision `OPENROUTER_API_KEY` in Cloudflare; the key is never committed, printed, or returned to clients.
- Interactive clients persist a private `ins_<uuid>` at `$CONSUELO_HOME/node/identity/install-id`; valid installer IDs still take precedence.
- `explore` is `executionScope: runtime`, so installed OS tools execute the OS-native implementation regardless of caller repo root scripts.

## notes for ko

- The old `WORKSPACE_HOSTNAME_NOT_FOUND` was not an OpenRouter error. It came from `*.consuelohq.com/*` being swallowed by the generic workspace router before any semantic endpoint existed.
- The production Worker now has the managed OpenRouter secret and the new route is live.

## improvements noticed

- Cloudflare rate limiting is an abuse-control ceiling rather than exact billing/accounting; if this free service grows materially, add durable cost telemetry keyed by pseudonymous install/model before changing quotas.

## issues and recovery

- Initial RED: 8/9 tests failed for the intended missing contracts (global semantic route, persisted install identity, runtime Explore routing); the pre-existing arbitrary-path 404 was accidental wildcard-router behavior.
- First canonical verify failed only because `tool-package-baseline.json` had not been regenerated for Explore's new `executionScope: runtime`; all other selected suites passed. The baseline was regenerated from the canonical manifest, its 21 manifest/layout tests passed, and the second verify became publish-valid.
- A live smoke attempt used a relative `require()` from the temporary `code.call` program and never reached the network; the retry used a worktree-rooted `createRequire` and returned the expected 2560-D vector.

---

## publish checklist

```bash
bun run task:push -- --message "type(explore): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: pending discovery of gateway identity contract and installed facade routing boundary
existing local pattern: pending
new or changed tests: pending
focused red command: pending
expected red failure: pending
no-test waiver: not applicable

- 2026-08-15 18:30:39 append: `.task/explore/fix-explore-gateway-identity-and-runtime-routing/workpad.md`

## workspace-owned: files read

- `package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/package.json`
- `packages/os/scripts/deploy-cloudflare-worker.ts`
- `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/install-telemetry-contract.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/cloudflare-worker-release-readiness.test.ts`
- `packages/os/tests/os-universal-login.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/os/tests/tool-package-layout.test.ts`
- `packages/os/tests/tools-search-v3.test.ts`
- `packages/os/tools/decision-engine/handler.ts`
- `packages/os/tools/decision-engine/manifest.ts`

## Refined test-first contract

behavior under test:
- `gateway.consuelohq.com/v1/os/semantic-embeddings` is a platform-global route handled before wildcard workspace hostname lookup, so it never requires a registered workspace hostname.
- The gateway accepts only POSTed Consuelo semantic-embedding payloads for the approved Qwen embedding model/dimensions; it cannot proxy arbitrary OpenRouter models, URLs, or chat/completion requests.
- The shared OpenRouter key stays server-side. Requests are bounded by batch/item/total-character limits and Cloudflare rate-limit bindings (per pseudonymous install plus a high-ceiling IP abuse limit).
- Explore clients always have a stable pseudonymous `ins_<uuid>` throttle identity: inherited installer IDs win; otherwise a private ID is generated once under `CONSUELO_HOME` and reused.
- The installed facade marks `explore` runtime-owned so `bun run explore` executes from the installed `packages/os` runtime package, never the caller repo's deprecated root/workspace script.

existing local pattern:
- `packages/os/cloudflare/workspace-edge/wrangler.toml` owns `*.consuelohq.com/*`; `createWorkspaceEdgeHandler` currently falls through to workspace hostname routing.
- `packages/os/scripts/lib/index/embedding-gateway.js` already fixes the model and enforces client-side caps, but only reads install ID from env.
- `packages/os/scripts/lib/facade/executor.ts` already honors `command.executionScope === 'runtime'`; lifecycle/tools.search use this contract, Explore does not.

new or changed tests:
- add a workspace-edge semantic gateway contract covering wildcard bypass, fixed upstream/model, strict payload rejection, secret non-disclosure, method/path confinement, and rate-limit rejection.
- extend the embedding-gateway client contract with stable private install-ID persistence.
- add an Explore facade routing contract proving execution CWD is `packages/os` from an unrelated caller CWD.
- extend test-selection ownership so these focused contracts are publish-gating without selecting the historically red package-wide OS suite.

focused red command:
- `bun --cwd packages/os test tests/semantic-embedding-edge-gateway.test.ts tests/semantic-embedding-gateway.test.ts tests/explore-runtime-routing.test.ts`

expected red failure:
- no server semantic route exists; client install ID is env-only; Explore manifest lacks `executionScope: runtime`.

no-test waiver: not applicable

- 2026-08-15 18:33:49 append: `.task/explore/fix-explore-gateway-identity-and-runtime-routing/workpad.md`

- 2026-08-15 18:35:19 write: `packages/os/tests/semantic-embedding-edge-gateway.test.ts`

- 2026-08-15 18:35:27 write: `packages/os/tests/semantic-embedding-identity.test.ts`

- 2026-08-15 18:35:32 write: `packages/os/tests/explore-runtime-routing.test.ts`

- 2026-08-15 18:36:26 write: `packages/os/cloudflare/workspace-edge/src/semantic-embedding-gateway.ts`

- 2026-08-15 18:36:32 apply-patch: `packages/os/cloudflare/workspace-edge/src/index.ts`
- 2026-08-15 18:36:48 apply-patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-08-15 18:36:53 apply-patch: `packages/os/tools/decision-engine/handler.ts`
- 2026-08-15 18:37:08 apply-patch: `packages/os/tests/semantic-embedding-edge-gateway.test.ts`
- 2026-08-15 18:37:15 apply-patch: `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`
- 2026-08-15 18:37:16 apply-patch: `packages/os/cloudflare/workspace-edge/wrangler.toml`

- 2026-08-15 18:38:28 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-15 18:38:28 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-15 18:38:41 apply-patch: `packages/os/SCRIPTS.md`

- 2026-08-15 18:43:10 apply-patch: `.task/explore/fix-explore-gateway-identity-and-runtime-routing/workpad.md`
