
## final security design
- Confirmed from user evidence that a human request to the affected internal /mcp path reached application bearer validation (MISSING_BEARER) instead of Cloudflare block, matching the reserved-host WAF exclusion bug.
- Decoupled customer hostname reservation from managed MCP ingress classification. internal.consuelohq.com now remains in the ordinary workspace wildcard policy; explicit non-workspace platform surfaces remain excluded, os.consuelohq.com is re-added explicitly, and c-<32-hex> connector origins retain their separate class.
- Removed implicit workspace_internal/internal.consuelohq.com route-seed defaults. Seed identity is required and blank/missing identity fails closed.
- Removed destructive route replacement path. Route seed updates always use the preserving UPSERT so Site publication cannot erase connector routes, default node, or node targets.
- Added an explicit workflow_dispatch reconciliation path for the full managed MCP ingress policy. The older connector-origin migration is intentionally separate and cannot repair hostname coverage by itself.
- No live Cloudflare mutation was performed in this task. Live protection remains unchanged until the reconciler is explicitly run after the code is merged/released.

## validation
- RED before implementation: WAF regression proved internal was excluded; seed regression proved missing identity silently selected internal.
- GREEN: 115/115 focused Cloudflare/edge/provisioning/migration/security tests passed across 11 files.
- GREEN: 8/8 workspace edge seed contract tests passed with 57 expectations.
- GREEN: OS syntax/typecheck passed.
- GREEN: strict workspace review reported 0 blocking issues / 0 issues.
- GREEN: post-fix expression diagnostic confirmed internal wildcard coverage, non-workspace exclusions, central os inclusion, connector-origin exclusion, trusted allowlist behavior, untrusted block behavior, and /mcp path scope.
- GREEN: production release workflow YAML parsed successfully with Ruby YAML.
- Validation recovery: Python YAML check could not run because PyYAML is not installed; retried with Ruby's standard YAML parser.

## workspace-owned: validation evidence

- 2026-08-12 03:35:12 `verify`: passed — OK
