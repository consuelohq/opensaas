# MCP 2026 dual-era transport

branch: `task/os/mcp-2026-dual-era-transport`
stream: `stream/os`
github pr: https://github.com/consuelohq/opensaas/pull/1828
taskSession: `tsk_221d6401567a`

## acceptance criteria

- [x] Preserve legacy MCP 2024-11-05 session behavior.
- [x] Support validated, stateless MCP 2026-07-28 discovery and tool calls.
- [x] Bind routing headers to the authenticated JSON-RPC body and reject mismatches.
- [x] Reject malformed modern metadata before execution.
- [x] Stamp modern responses with complete result type and namespaced server identity.
- [x] Keep modern local-bridge requests stateless and ignore legacy session response headers.
- [x] Make local-agent verification exercise the modern stateless contract.
- [x] Make lifecycle health acceptance verify local MCP connectivity.
- [x] Preserve auth, scopes, rate limits, origin checks, and dangerous-material rejection.
- [x] Pass focused affected tests and package syntax/type validation without rebooting.

## plan

1. Preserve the recovered branch and red-test checkpoint.
2. Implement shared protocol validation, gateway, route, bridge, and verifier changes.
3. Add local MCP lifecycle acceptance.
4. Verify, review, commit, and push.

## current status

- Implementation complete; 94 affected tests pass.

## evidence

- Transport red: 33 pass, 6 fail (`trc_219f6b4703b3`).
- Lifecycle red: 0 pass, 2 fail (`trc_97d2245ef71e`).
- Downgrade red: 0 pass, 1 fail (`trc_f504e4df486c`).
- Final: 94 pass, 0 fail plus syntax/type (`trc_050db1e7ad6a`).

## key decisions

- Legacy stays sessionful; validated MCP 2026 is stateless.
- Local readiness and client-owned connector recovery are separate claims.
- Repair now verifies local MCP after loopback health.
- Modern routing headers cannot downgrade to a legacy session.


- 2026-08-10 05:33:05 write: `.task/os/mcp-2026-dual-era-transport/workpad.md`

## workspace-owned: validation evidence

- 2026-08-10 05:34:25 `review.run`: passed — OK
- 2026-08-10 05:34:38 `verify`: passed — OK
- 2026-08-10 05:34:53 `verify`: passed — OK
