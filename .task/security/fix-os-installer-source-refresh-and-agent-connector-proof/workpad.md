# Fix OS installer source refresh and agent connector proof

## Acceptance criteria

- Hosted curl installs refresh the source archive by default so repeated installs do not silently reuse stale temp source.
- Keep an explicit escape hatch for local/debug runs that intentionally reuse an existing hosted source checkout.
- Workspace name prompt should stay product-level: no "spaces become hyphens" copy. Names are still normalized to slugs before URL generation.
- CLI flags --install-daemons and --skip-daemons are honored in the interactive flow and are forwarded from bootstrap into install.ts.
- OpenCode connection writes an actual OpenCode MCP config entry, not just Consuelo metadata, so OpenCode can discover Consuelo OS tools such as get_steering.

## Test-first contract

Behavior under test:
- bootstrap default sets REFRESH_SOURCE=1, has --use-existing-source, and no longer prints "pass --refresh-source" as the normal path.
- install prompt uses "enter workspace name" while still normalizing raw workspace input before host generation.
- interactive bootstrap passes daemon flags through to install.ts.
- install.ts respects preselected installDaemons/skipDaemons without re-prompting.
- provisioning OpenCode creates ~/.config/opencode/opencode.json with an enabled local mcp.consuelo-os command pointed at the installed MCP stdio proxy.

Existing pattern to follow:
- tests/bootstrap-source.test.ts source-level installer contracts.
- tests/install-workspace-bootstrap-contract.test.ts install.ts source contracts.
- tests/install-state.test.ts filesystem provisioning contracts.

Focused red command:
- CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/install-state.test.ts

Expected red failure before implementation:
- bootstrap still has REFRESH_SOURCE=0 and "pass --refresh-source" copy.
- install.ts still contains "enter workspace name (spaces become hyphens)".
- OpenCode provisioning only writes consuelo-os.json and does not write opencode.json MCP config.

## workspace-owned: validation evidence

- 2026-06-23 05:05:56 `review.run`: passed — OK
- 2026-06-23 05:06:51 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-os-installer-source-refresh-and-agent-connector-proof/current.json`, `.task/security/fix-os-installer-source-refresh-and-agent-connector-proof/session.json`, `.task/security/fix-os-installer-source-refresh-and-agent-connector-proof/workpad.md`, `.task/tasks/security/fix-os-installer-source-refresh-and-agent-connector-proof.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/mcp-stdio.ts`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Implementation summary

- Hosted installs now refresh the source checkout by default with --use-existing-source as the explicit reuse escape hatch.
- Removed workspace prompt implementation copy; names still normalize to URL-safe slugs internally.
- Interactive bootstrap forwards --install-daemons / --skip-daemons into install.ts.
- install.ts honors preselected daemon flags instead of reprompting and then discarding the user intent.
- OpenCode connection now writes ~/.config/opencode/opencode.json with an enabled local consuelo-os MCP server entry.
- Added scripts/mcp-stdio.ts as the stdio bridge into the existing MCP gateway.

## Validation

- Red: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/bootstrap-source.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/install-state.test.ts failed on source refresh reuse status, prompt copy, daemon flag, and OpenCode MCP config contracts.
- Green: same focused command passed, 30 tests.
- Green: bash -n packages/os/scripts/bootstrap.sh.
- Green: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/mcp-gateway.test.ts tests/tool-manifest.test.ts tests/bootstrap-source.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/install-state.test.ts passed, 53 tests.
- Green: bun run os:release-install -- --dry-run, new bootstrap SHA bef74e191a357683c4ac474ae8ca1904176cb5b86cd420e42a86a7b4167ca071.
- Green: review.run --base origin/main, 0 issues.
- Green: verify --base origin/main --no-stamp, publish-valid.
