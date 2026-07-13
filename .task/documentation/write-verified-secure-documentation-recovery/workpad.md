# write verified secure documentation recovery

branch: `task/documentation/write-verified-secure-documentation-recovery`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1472/write-verified-secure-documentation-recovery
github pr: https://github.com/consuelohq/opensaas/pull/1472
started: 2026-07-13

## acceptance criteria

- [x] Publish the complete approved Secure hierarchy in navigation order: Overview, Security model, Access and permissions, Credentials, Approvals, Nodes and network access, Tailscale, Hosted MCP ingress, Security reference.
- [x] Treat the archived Network and Security Report and OS Spec as directional maps only; verify every material public claim against current source, focused tests, configuration, and runtime behavior where practical.
- [x] Distinguish identity, authentication, authorization, approval, persistent grants, per-request proof, and network transport accurately.
- [x] Document current local, edge, connector, node, Tailscale, and hosted MCP boundaries without exposing private hosts, live credentials, account IDs, secrets, or operationally sensitive values.
- [x] Mark all pages preview, add evidence metadata, and keep a checked-in Secure claim/evidence ledger.
- [x] Replace directly superseded legacy security pages only after replacements exist; add redirects and update surviving links.
- [x] Add focused contract tests first, record the red result, then add browser regression coverage for all HTML and normalized Markdown routes, section-local navigation, and responsive overflow.
- [x] Keep product changes inside `packages/documentation/**` plus workspace-owned task metadata.
- [x] Run focused security implementation tests, combined documentation contracts, validation, production build, browser suites, and package-boundary checks.
- [ ] Run strict review and full verification, push the task branch, merge it into `stream/documentation`, refresh stream PR #1448, verify the merged stream, then finish and clean up.

## discovery

- Recovery task was deliberately started from `stream/documentation` at merged Observe commit `b1247883f50b905105b9eb5e9e524607f08e704d`; its diff against the stream was clean. The first task was started from `main` and would have pulled 192 unrelated files into this docs PR, so it is superseded.
- The previous Secure section contained only a 209-byte placeholder and no section-local page hierarchy.
- Current implementation is materially ahead of the June directional reports. Verified source areas include generated local auth, scoped agent/app credentials, Ed25519 signed machine requests, timestamp and nonce replay checks, credential rotation/revocation, manifest-backed tool scopes, device authorization, workspace/node binding, Cloudflare route registration, signed connector transport, local Caddy hardening, and first-party OAuth for hosted MCP.
- Current tests explicitly reject the legacy generic `MCP_BEARER_TOKEN` fallback and prove that raw credentials are not persisted in status records, route registry rows, config, auth, or Caddy output.
- The public model keeps distinct: static Sites snapshot reads; required and workspace-session routes; OAuth bearer authentication at hosted MCP; signed edge-to-connector requests; local generated credentials; and action approval.
- Tailscale is a private Tailnet publishing/access option in current product tooling. It is not the default public MCP ingress path, which uses the managed Cloudflare workspace edge and outbound connector.
- Directly superseded legacy content was `src/content/docs/os/concepts/mcp-ingress-security.mdx`, which presented provider IP allowlisting as the primary MCP security model.
- Directional artifacts: archive entries `specs-streamos-v1-spec` and `security-network-and-security-report`. They guided discovery only and are not proof of current behavior.

## implementation evidence read

- `packages/os/scripts/lib/security-gateway.ts`: credential lifecycle, request signing/verification, scopes, tool policy, Caddy generation, public route registry, audit events.
- `packages/os/scripts/lib/mcp-gateway.ts` and `packages/os/scripts/server/routes/mcp.ts`: MCP JSON-RPC scope resolution and protected route behavior.
- `packages/os/cloudflare/os-device-authority/**`: device approval, stronger authentication, OAuth authorization-code + PKCE, account/workspace membership, connector registration, signed MCP proxying.
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts` and `workspace-cloudflare-d1-route-registry.ts`: hostname/path policy, auth modes, revocation, reserved hosts, static snapshots, signed live routes.
- `packages/os/scripts/lib/workspace-connector-transport.ts`: outbound connector transport to a loopback local service.
- `packages/os/scripts/lib/workspace-device-authorization.ts`: device-code and connector-bootstrap lifetimes.
- `packages/os/permissions.md`: read, draft, write, execute, external, and admin tiers.
- `packages/os/TOOLS.md` and `packages/os/skills/office/references/agents.md`: private Tailscale Serve publishing and durable Office artifacts.

## test-first contract

1. Added `packages/documentation/tests/secure.test.ts` before substantive documentation edits.
2. Required the full nine-page hierarchy, evidence metadata, checked-in claim ledger, verified security distinctions, legacy deletion/redirect, and package scripts.
3. Recorded the expected red result: 0 passed, 8 failed.
4. Wrote only claims supported by current source, tests, generated output, and focused runtime checks.
5. Added browser coverage after the content contract became green.

## current status

- All nine Secure pages, the claim ledger, navigation, redirects, legacy cleanup, package scripts, and responsive browser coverage are implemented.
- Documentation validation, combined contracts, translation, package boundary, all current documentation browser suites, and production build pass.
- Focused OS security verification confirms the documented gateway, device approval, OAuth, route-registry, edge-router, and dangerous-material behavior.
- Pre-existing runner and stale-contract failures are recorded below rather than hidden or changed outside this docs task.
- Strict review, publish, merge, merged-stream verification, and cleanup remain.

## files changed

- `.task/documentation/write-verified-secure-documentation-recovery/current.json`
- `.task/documentation/write-verified-secure-documentation-recovery/session.json`
- `.task/documentation/write-verified-secure-documentation-recovery/workpad.md`
- `.task/tasks/documentation/write-verified-secure-documentation-recovery.json`
- `packages/documentation/evidence/secure-claims.md`
- `packages/documentation/scripts/test-secure-browser.mjs`
- `packages/documentation/tests/secure.test.ts`

## workspace-owned: files changed

- `.task/documentation/write-verified-secure-documentation-recovery/current.json`
- `.task/documentation/write-verified-secure-documentation-recovery/session.json`
- `.task/documentation/write-verified-secure-documentation-recovery/workpad.md`
- `.task/tasks/documentation/write-verified-secure-documentation-recovery.json`
- `packages/documentation/evidence/secure-claims.md`
- `packages/documentation/scripts/test-secure-browser.mjs`
- `packages/documentation/tests/secure.test.ts`

## workspace-owned: activity log

- 2026-07-13 21:24:31 fs.write: `.task/documentation/write-verified-secure-documentation-recovery/workpad.md`
- Added section navigation, redirects, normalized Markdown/browser checks, and deleted stale ingress guidance.
- Added the focused Secure contract before content and recorded its red result.
- Completed structured scans of security implementation, exact test titles, legacy docs, navigation, validation, and existing Observe patterns.
- Corrected route-state wording after checking the exact source types: route records are active/disabled; hostname records are active/revoked.
- Created recovery task from the documentation stream after proving the original task contained 192 unrelated files against the stream.
- Replaced only the ignored worktree dependency symlink with a frozen local install after an Astro absolute-path compile cache failure.
- Wrote the nine verified Secure pages and evidence ledger.

## workspace-owned: validation evidence

- `git diff --name-only origin/stream/documentation...HEAD` returned no files before implementation.
- Red contract: 0 passed, 8 failed before the pages existed.
- Focused Secure contract: 8 passed, 0 failed, 211 assertions.
- Combined documentation contracts: 54 passed, 0 failed, 1,450 assertions.
- Documentation validation: 83 selected pages and all supported MDX adapters passed.
- Translation contract passed.
- Package-boundary contract passed; only `packages/documentation/**` and workspace-owned task metadata were accepted.
- Foundation browser regression passed with seven global groups, a 632px prose measure, and zero tablet/mobile overflow.
- Connect browser regression passed 19 routes with zero tablet/mobile overflow.
- Build browser regression passed 17 routes with zero tablet/mobile overflow.
- Sites browser regression passed 7 routes with zero tablet/mobile overflow.
- Observe browser regression passed 7 routes with zero tablet/mobile overflow.
- Secure browser regression passed all 9 HTML routes and 9 normalized Markdown routes, expanded local navigation, current deep-link state, and zero tablet/mobile overflow.
- Production build passed; Pagefind indexed 86 HTML files and all nine Secure `.md` routes were generated.
- Correct Vitest verification passed 23 security-gateway tests, 23 device-authority worker tests, 4 dangerous-material tests, and 5 device-approval hardening tests.
- Workspace gateway contracts passed: 5 gateway, 19 edge-router, and 7 D1 route-registry tests.

## key decisions

- Current code and tests are the source of truth; archived reports are discovery aids only.
- Preserve the distinction between identity, authentication, authorization, approval, and transport.
- Do not publish exact private hostnames, account identifiers, credentials, secrets, or unnecessary operational internals.
- Keep Tailscale accurately positioned as a private network option rather than the managed public MCP ingress.
- Provider IP policy is described as edge defense in depth, not as user identity or tool authorization.

## notes for ko

- This recovery branch prevents unrelated landing-page and OS/tooling work from entering Branch 7. PR #1471 is superseded by PR #1472 and will be closed during cleanup.

## improvements noticed

- `task.start` should prefer the active stream when the conversation explicitly assigns the next stacked documentation branch; defaulting to current main created a large unrelated diff.

## issues and recovery

- Superseded task PR #1471 was created from main. No production docs were written there. Recovery PR #1472 starts from the correct stream commit.
- The first Secure browser run failed because the task worktree inherited a `node_modules` symlink pointing at the main checkout, which made Astro combine two absolute paths in compile metadata. Replacing only the ignored worktree dependency link with a frozen local install fixed the environment; the browser suite then passed without tracked dependency changes.
- `mcp-gateway.test.ts` has a pre-existing cross-runner incompatibility: Vitest runs under Node and cannot import `bun:sqlite`; Bun can load it but its Vitest compatibility object lacks `vi.stubGlobal`. Ten MCP gateway tests pass under Bun before that runner-only failure. No OS code was changed.
- `install-workspace-bootstrap-contract.test.ts` currently has five failures from the same Node/`bun:sqlite` incompatibility and one stale source-order assertion for an older installer flow. The other four tests pass. No OS code was changed.
- `local-os-port-cutover.test.ts` still references legacy Start documentation paths removed by an earlier approved docs branch. This is an unrelated stale OS-side docs-path assertion and was not modified here.

---

## publish checklist

```bash
bun run task:push -- --message "docs(documentation): write verified Secure guides" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-13 21:24:31 write: `.task/documentation/write-verified-secure-documentation-recovery/workpad.md`
