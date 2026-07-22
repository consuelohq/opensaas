# Clean OS installer UI and launcher freshness

## Acceptance criteria

- Dependency banner uses consistent product spacing: `C O N S U E L O  O S`, not the triple-space variant.
- Interactive install should not print duplicate skills/artifacts/agents completion rows after `local OS saved`.
- Interactive install should not print the background-service secret copy when `--install-daemons` was already explicitly passed from bootstrap.
- Launcher/site shell updates must not serve stale cached HTML after D1 points a host to a newer snapshot version.
- Static launcher shells should not use long-lived edge/CDN cache by default.

## Test-first contract

Behavior under test:
- `bootstrap.sh` source contract rejects `C O N S U E L O   O S` and requires `C O N S U E L O  O S`.
- `install.ts` source contract rejects post-save duplicate `stepComplete('skills')`, `stepComplete('artifacts')`, and `stepComplete('agents')` output.
- `install.ts` source contract rejects unconditional background-service copy after preselected daemon flags.
- Cloudflare edge router contract rejects stale cache hits when cached `x-consuelo-site-version` does not match the current D1 route target.
- Cloudflare edge router contract proves `static-shell` routes are not edge-cache populated and use `no-store`.

Existing pattern to follow:
- `tests/bootstrap-source.test.ts` source-level shell UI contracts.
- `tests/install-workspace-bootstrap-contract.test.ts` source-level install UI contracts.
- `tests/cloudflare-edge-router.test.ts` route/cache behavior contracts.

Focused red command:
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/cloudflare-edge-router.test.ts`

Expected red failure before implementation:
- Banner still contains the triple-space variant.
- Install still prints duplicate step completions after save.
- Static shell cache-control still has long `s-maxage` and cache hits do not validate the target version.

## workspace-owned: validation evidence

- 2026-06-23 05:46:36 `review.run`: passed — OK
- 2026-06-23 05:48:06 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/clean-os-installer-ui-and-launcher-freshness/current.json`, `.task/security/clean-os-installer-ui-and-launcher-freshness/session.json`, `.task/security/clean-os-installer-ui-and-launcher-freshness/workpad.md`, `.task/tasks/security/clean-os-installer-ui-and-launcher-freshness.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Implementation summary

- Normalized dependency banner spacing to `C O N S U E L O  O S`.
- Removed the post-save duplicate skills/artifacts/agents completion rows from install.ts.
- Removed the background-service explanatory info line from install.ts.
- Static launcher/site shells now return `cache-control: no-store` and are not stored in the Worker Cache API.
- Cached site snapshots are only served when `x-consuelo-site-version` matches the current D1 route target version.

## Validation

- Red: focused contract command failed on banner spacing, duplicate final steps, background copy, stale cached snapshot reuse, and static-shell long cache.
- Green: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/cloudflare-edge-router.test.ts passed, 33 tests.
- Green: bash -n packages/os/scripts/bootstrap.sh.
- Green: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/cloudflare-edge-router.test.ts tests/install-state.test.ts tests/mcp-gateway.test.ts tests/tool-manifest.test.ts tests/install-edge-site-publisher.test.ts tests/workspace-edge-sites-gateway-integration.test.ts passed, 81 tests.
- Green: bun run os:release-install -- --dry-run, new bootstrap SHA 56fb7f7b6a76e25c2adbd228e3394a3ca41742cf05eb2a091297e01a21d52d74.
- Green: review.run --base origin/main, 0 issues.
- Green: verify --base origin/main --no-stamp, publish-valid.
