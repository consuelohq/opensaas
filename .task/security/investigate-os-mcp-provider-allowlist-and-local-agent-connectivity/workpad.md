# Investigate OS MCP provider allowlist and local agent connectivity

branch: `task/security/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1305/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity
github pr: https://github.com/consuelohq/opensaas/pull/1305
started: 2026-07-01

## acceptance criteria

- [ ] Keep the existing Cloudflare `/mcp` posture fail-closed: untrusted sources still block and trusted sources still skip only the intended managed phases.
- [ ] Add a code-owned way to populate the existing Cloudflare MCP allowed IP list with trusted provider egress ranges instead of editing the dashboard list by hand.
- [ ] Cover OpenAI ChatGPT connector/Codex cloud ranges and Anthropic Claude ranges from official source material.
- [ ] Do not invent Google/xAI/Grok ranges without official evidence; provide an env escape hatch for manually approved extra CIDRs.
- [ ] Keep arbitrary local-user IP allowlisting out of the automatic path; record the launcher local-agent count as a separate diagnostic.
- [ ] Add focused contract tests for provider range resolution, env parsing, Cloudflare list upsert, and platform provisioning order.

## plan

1. Recover the task worktree and rebase the bootstrap branch onto `origin/stream/security` so this PR does not carry unrelated site work.
2. Read the current Cloudflare provisioning code/tests and write the focused failing contract tests first.
3. Implement trusted provider CIDR source resolution, manual extra CIDRs, and Cloudflare account IP-list item upsert.
4. Wire platform provisioning to sync provider CIDRs before keeping the existing fail-closed WAF rules.
5. Run focused contract tests, `packages/os` typecheck, review, and verify.
6. Push/update PR #1305 and promote through `stream/security` if the task workflow allows it.

## current status

- Task session `tsk_deb6a2436c1b` recovered after the computer restart.
- Stale temp worktree cleanup was required because `task.start` found a directory with only partial task metadata and no Git worktree.
- Branch was rebased onto `origin/stream/security`; implementation changes were lost during restart and rebuilt from current files.
- Implementation is green locally and clean in workspace review. Ready for verify/publish.

## Test-first contract

- Behavior under test: platform-managed OS MCP ingress provisioning can optionally resolve trusted provider CIDRs, upsert them into the configured Cloudflare account IP list, and then keep the existing fail-closed allow/block rule pair using that same list.
- Existing local pattern to follow: `packages/os/tests/cloudflare-provisioning-contract.test.ts` and `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts` already test env parsing, fake Cloudflare API calls, and managed rule construction.
- New or changed tests: add provider CIDR source parsing with fake fetch; add env parsing for provider source ids and extra CIDRs; add Cloudflare list item POST assertion; add platform boundary test that syncs provider CIDRs before rule provisioning; assert local-user IPs are not auto-added.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/cloudflare-provisioning-contract.test.ts tests/platform-cloudflare-provisioning-contract.test.ts -t 'trusted provider|managed OS MCP ingress'` from `packages/os`.
- Expected red failure: exports/types/env parsing and Cloudflare list-item upsert support do not exist yet.
- No-test waiver: not applicable; this is security-sensitive Cloudflare provisioning behavior.

## files changed

- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-01 02:09 focused red: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/cloudflare-provisioning-contract.test.ts tests/platform-cloudflare-provisioning-contract.test.ts -t 'trusted provider|managed OS MCP ingress'` failed as expected. Signal: `workspace Cloudflare provisioning contract module is missing exports: resolveTrustedOsMcpProviderIpRanges, syncManagedOsMcpTrustedProviderIpAllowlist`; platform result missing `trustedProviderIpAllowlist`.
- 2026-07-01 02:12 focused green: same focused command passed, 11 tests passed and 15 skipped.
- 2026-07-01 02:15 full relevant contracts: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/cloudflare-provisioning-contract.test.ts tests/platform-cloudflare-provisioning-contract.test.ts` passed, 26 tests.
- 2026-07-01 02:15 `bun run typecheck` from `packages/os` passed, `workspace script syntax checks passed`.
- 2026-07-01 02:13 live OpenAI feed smoke passed: `chatgpt-connectors.json` status 200 with 217 prefixes; `chatgpt-agents.json` status 200 with 1078 prefixes.
- 2026-07-01 02:15 `review.run --base origin/stream/security` passed, 0 blocking issues.
- 2026-07-01 06:14:34 `review.run`: passed — OK
- 2026-07-01 06:15:15 `review.run`: passed — OK
- 2026-07-01 06:15:51 `verify`: passed — OK
- 2026-07-01 06:16:59 `verify`: passed — OK

## key decisions

- Keep WAF rule semantics unchanged: rules still reference `ip.src in $<Cloudflare list name>` and the new code manages list contents separately.
- Use OpenAI `chatgpt-connectors.json` for ChatGPT integrations and `chatgpt-agents.json` for Codex cloud. Fetch dynamically during platform provisioning so OpenAI range churn is handled by rerunning provisioning.
- Use only Anthropic's documented outbound MCP/tool-call CIDR, `160.79.104.0/21`; do not include Anthropic's inbound IPv6 range as Claude outbound egress.
- Do not add Google/Gemini or xAI/Grok source IDs without official stable egress range evidence. Use `CLOUDFLARE_MCP_TRUSTED_PROVIDER_EXTRA_CIDRS` for manually approved temporary ranges.
- Do not auto-allow local-user IPs in this branch; local launcher agent count should be debugged separately from hosted `/mcp` WAF provider egress allowlisting.

## notes for ko

- This should address Cloudflare blocking hosted provider egress for OpenAI/ChatGPT/Codex and Anthropic/Claude when the platform provisioner is run with the new env fields.
- The screenshot showing zero local agents is probably not caused by this WAF rule. It should be debugged by checking whether installed agents are written into local `~/.consuelo/os/config.json` under `agents`.

## improvements noticed

- If provider support grows, split provider range catalogs into a smaller platform-policy module and keep workspace route/ruleset provisioning focused on Cloudflare rule construction.

## issues and recovery

- The first pre-crash implementation was lost because it had not been committed before the computer restart. The recovered branch is being rebuilt cleanly on `origin/stream/security`.
- `task.push --changed` refused because the remote task branch still pointed at stale pre-crash bootstrap commit `0f60ccfb` with unrelated sites history. There is no task-push sync flag that preserves the clean `origin/stream/security` base, so publish recovery will commit locally and push the task branch with `--force-with-lease` against that exact stale remote SHA.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-01 06:05:33 apply-patch: `.task/security/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity/workpad.md`
- 2026-07-01 06:07:16 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-07-01 06:07:25 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-07-01 06:08:01 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-07-01 06:08:23 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-07-01 06:08:36 apply-patch: `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- 2026-07-01 06:09:09 apply-patch: `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`

- 2026-07-01 06:09:27 apply-patch: `.task/security/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity/workpad.md`
- 2026-07-01 06:09:47 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-01 06:10:01 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-01 06:10:15 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-01 06:10:47 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-01 06:11:00 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-01 06:11:07 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-01 06:11:19 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-01 06:11:38 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-01 06:11:55 apply-patch: `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`
- 2026-07-01 06:12:14 apply-patch: `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- 2026-07-01 06:13:03 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-01 06:13:14 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-07-01 06:13:23 apply-patch: `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`

- 2026-07-01 06:14:52 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`

- 2026-07-01 06:15:38 apply-patch: `.task/security/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity/current.json`, `.task/security/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity/session.json`, `.task/security/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity/verify.json`, `.task/security/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity/workpad.md`, `.task/tasks/security/investigate-os-mcp-provider-allowlist-and-local-agent-connectivity.json`, `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
