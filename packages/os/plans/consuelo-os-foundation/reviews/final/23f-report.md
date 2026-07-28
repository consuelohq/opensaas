# Worker 23F — Multi-node registry and routing audit

Date: 2026-07-28  
Candidate: PR #1674, Stream/os-foundation-two, ef2530b136ec2a170915b583abfb2341899bd6ab  
Task: tsk_7b817aff2663, task/os/worker-23f-multi-node-registry-routing-audit

## Decision

DOMAIN BLOCKED

Four open P1 findings block this domain. Two P2 findings remain. The required two-Mac acceptance and live Cloudflare/D1 evidence were unavailable; PR #1674 also has two failed checks, including Workers Builds: opensaas.

## Review controls

os.get_steering was attempted exactly twice and failed at the transport/session layer both times. I inspected both envelopes and used the authorized workspace fallback. All repository work used the scoped workspace task session. No product code, shared finding ledger, real machine, or production state was modified.

PR #1674’s existing issue, review, and inline threads were read first. Its head SHA exactly matches the authorized candidate. The candidate is an ancestor of the task tree; the reviewed OS implementation paths are unchanged from that SHA. The aggregate PR has no product-code inline location for these findings, so each finding was posted as a precise top-level comment with file and line. The historical missing canonical audit refs are recorded as unavailable context, not used to substitute a candidate.

Focused local evidence:
- 52/52 passed from packages/os: workspace-node registry/routing, heartbeat client, device-authority worker, native lifecycle endpoint, and steering trace.
- 70 passed in the connector, authority architecture, universal-login, workspace-node CLI, MCP scope, and install-state suites.
- The D1 route-registry suite was explicitly skipped: 8 tests.
- A root-cwd steering invocation failed only because its subprocess resolves ./scripts/os.ts relative to packages/os; the correctly scoped rerun passed all four tests.
- No live Cloudflare authority, D1, connector, OAuth session-rotation, or two-Mac test was available.

## Intent-lineage table

Built before judging implementation, from the master plan, environment registry, Worker 23 audit, independent-review framework, and every original prompt listed in 23f.

| Original prompt | Exact requirement / section | Authority | Seam reviewers | Implementation / repair lineage | Current location | Automated evidence | Live evidence | Status | Remediation |
|---|---|---|---|---|---|---|---|---|---|
| 25 | Node record: ID, display name, role, platform, arch, channel, connector, capabilities, thumbprint, timestamps, presence, state | 23F | 23A,23C,23D | #1581 → #1586 → #1674 | types.ts; services/nodes.ts; grants.ts | registry 13; architecture 25 | unavailable | partial | R01,R04 |
| 25 | First install is home; same-account later install is member; home/default persists | 23F | 23C | #1581,#1586,#1613,#1674 | grants.ts; device approval; install.ts | universal-login 8; registry; install-state | no two-Mac run | partial | R01,R04 |
| 25 | Stable local identity and key binding across reinstall/reconnect | 23F | 23C | #1581,#1586,#1674 | install.ts; install-state.ts; workspace-device-login-client.ts | no persisted-key reconnect test | unavailable | fails | R01 |
| 25 | Signed heartbeat, freshness, nonce replay resistance, forged/revoked rejection | 23F | 23A | #1581,#1586,#1674; local repair 3f5bb419ee | workspace-nodes.ts; stores.ts; heartbeat client | heartbeat; worker 24; heartbeat 2 | unavailable | partial | R02 |
| 25 | TTL online/stale/offline states and deterministic boundaries | 23F | 23A,23D | #1581,#1586,#1674 | services/nodes.ts; D1 resolver | TTL unit cases pass | D1 skipped | unit-only | deploy timing test |
| 25 | Authenticated list/detail/default/rename/revoke | 23F | 23A,23C | #1581,#1586,#1674 | workspace-nodes.ts; workspace-node-client.ts; CLI | list/default/rename/revoke; no detail | unavailable | partial | R03,R06 |
| 25 | Explicit target routing and no silent fallback when default is unavailable | 23F | 23C | #1028,#1581,#1586,#1674 | D1 route registry; mcp-proxy.ts | explicit/offline/MCP cases pass | D1 skipped | unit-only | R03; live edge |
| 25 | Connector/MCP target and workspace binding | 23F | 23C | #1028,#1581,#1586,#1674 | connectors.ts; mcp-proxy.ts; edge router | connector 1; MCP scopes 10 | no live connector | unit-only | R03 |
| 25 | Revocation propagates to management, heartbeat, route, connector, MCP | 23F | 23A,23C | #1581,#1586,#1674 | workspace-nodes.ts; D1; MCP | node revoke/heartbeat cases pass | unavailable | partial | R03 |
| 25 | Workspace isolation and private-key/secret locality | 23F | 23A,23C,23D | #1581,#1586,#1674 | stores.ts; nodes.ts; install-state; native endpoint | cross-workspace/redaction; install 22; native 9 | no live storage | unit-only | add key-locality reconnect case |
| 07 | Steering/native safe identity, capabilities, default, role, presence; no secrets; offline not erased | 23A | 23F,23D | local b09fe7c96d; exact PR not uniquely recoverable | steering service; native endpoint | steering 4; native redaction | no outage/live steering | partial | R05 |
| 13 | Existing workspace/membership resolution before second-install prompt; auth at boundary | 23C | 23F | #1613 plus #1581/#1586 | web auth; device approval; node auth | universal-login 8 | no live rotation | partial | R03 |
| 14 | Universal login creates/joins correct node without replacing default; preserves OAuth/MCP | 23C | 23F | #1613 plus #1581/#1586 | device approval; grants; install-state | handoff and default tests | no second-machine login | partial | R01,R04 |
| 17 | Node impersonation, revoke, default, unavailable, cross-workspace fail closed | 23B | 23F | #1581,#1586,#1674 | heartbeat; route; MCP; auth | forged/revoked/isolation units | live E2E unavailable; Worker build failed | blocked | P1 fixes + E2E |
| 19 | Native safe node list, presence/default/revoked state; understandable offline behavior | 23D | 23F,23A | #1666 → #1669 → #1668 | native endpoint; Swift client | native 9; redaction | two-Mac unavailable | partial | R05 + Ko acceptance |

## Findings

### 23F-R01 — P1 High — Reinstall reuses node ID but generates a new key

Location: packages/os/scripts/install.ts:847-853; packages/os/scripts/lib/workspace-device-login-client.ts:219-227; packages/os/cloudflare/os-device-authority/src/services/grants.ts:98-107.

The installer reads and resubmits the existing node ID but does not load the persisted device key pair. requestWorkspaceDeviceCode therefore generates a new Ed25519 key when deviceKeyPair is omitted. The authority rejects the same node ID when its public-key thumbprint changes. The pair is persisted later in node/security/generated/workspace-node-heartbeat.json, but reconnect does not pass it.

Impact: valid reinstall/reprovision cannot reconnect the node; a preserved ID with missing key material is stranded instead of taking an explicit recovery path.

Fix: reuse the persisted pair, or fail closed into explicit identity recovery/rotation. Add persisted-key reconnect, missing-key recovery, and mismatched-key tests.

### 23F-R02 — P1 High — Durable nonce replay claim is non-atomic

Location: packages/os/cloudflare/os-device-authority/src/stores.ts:380-395, called at workspace-nodes.ts:367-375.

The durable store awaits get, checks expiry, and awaits put as separate operations. Concurrent identical signed heartbeats can both observe an unclaimed nonce. StorageLike exposes a transaction hook, but this claim does not use it; the in-memory double cannot model the race.

Impact: concurrent replay can be accepted twice and mutate presence/route state twice, despite sequential replay tests passing.

Fix: use an atomic transaction/CAS/idempotency claim and add a Promise.all concurrent duplicate-heartbeat test against a yielding storage double and deployed storage.

### 23F-R03 — P1 High — Membership revocation is not enforced at node/MCP boundaries

Location: packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts:57-104 and src/services/mcp-proxy.ts:169-215.

Node authorization checks bearer token, expiry, scope, and cached account workspace, but not active WorkspaceMembership. The MCP proxy repeats token/resource/scope checks without membership lookup. Web auth models membership status, but these management and route boundaries do not re-check it.

Impact: an unexpired token can continue listing, selecting default, renaming, revoking, or routing MCP after workspace membership revocation.

Fix: centralize active-membership authorization for node, MCP, steering, and native remote inspection. Test post-issuance membership revocation across every boundary without metadata leakage.

### 23F-R04 — P1 High — Concurrent first registrations can create two home/default nodes

Location: packages/os/cloudflare/os-device-authority/src/services/grants.ts:42-69 and 79-145.

registerGrantNode and rememberAccountWorkspace read before write. Two first approvals can both see no workspace, both claim home, and race home/default persistence and route default registration. No atomic first-home claim or uniqueness guard is demonstrated.

Impact: one-home and stable-default invariants can be broken by simultaneous joins or duplicate approvals; last-writer order can silently change routing.

Fix: transactionally claim the first home or enforce a unique home constraint. Convert losing concurrent joins to member and preserve committed home/default. Add concurrent approval, one-home, stable-default, and duplicate-membership tests.

### 23F-R05 — P2 Medium — Native fallback fabricates online/default registry state

Location: packages/os/scripts/lib/native-lifecycle-endpoint.ts:163-214 and 905-946.

localWorkspace builds a one-node local YAML snapshot with presence online, active state, and local activeNode as default. It cannot know remote stale/offline/revoked state or other members when authority/token inspection is unavailable.

Impact: native UI can present local YAML as authoritative remote registry state during token rotation or outage.

Fix: expose authority-unavailable or age-tagged last-known state; do not synthesize remote online/default claims. Add missing-token, 401/503, stale/revoked, and second-member tests.

### 23F-R06 — P2 Medium — Authenticated node detail operation is missing

Location: packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts:412-428 and packages/os/scripts/lib/workspace-node-client.ts:1-11.

Routes expose list/default/heartbeat/rename/revoke, but no authenticated GET /workspace/nodes/:nodeId. The client union and CLI have no detail action, despite the master plan and brief requiring list/detail/default/revoke.

Impact: settings/native callers cannot retrieve one safe authoritative node record, and detail isolation is untested.

Fix: add authenticated GET detail with shared workspace/membership guard, safe schema, non-enumerating cross-workspace failure, and client/CLI tests for active/stale/offline/revoked nodes.

## Adversarial journey matrix

| Journey | Result | Evidence / gap |
|---|---|---|
| Second-machine same-account join | partial | Sequential default-preservation passes; live two-Mac unavailable; R01,R04. |
| Replayed heartbeat | partial | Sequential duplicate returns 409; concurrent durable replay is R02. |
| Forged heartbeat | unit pass | Invalid signature rejected; no deployed evidence. |
| Reordered/delayed heartbeat | partial | Max-age and TTL units pass; no deployed clock/timing. |
| Explicit route to offline node | unit pass | WORKSPACE_NODE_OFFLINE and no fallback; D1 skipped. |
| Default offline | unit pass | Explicit no-fallback passes; native fallback is R05. |
| Revocation during active work | partial | Node revoke blocks route/heartbeat; membership revoke is R03. |
| Cross-workspace enumeration | unit pass | Negative list/route cases pass; no deployed multi-tenant check. |
| Auth/session rotation | partial | Expiry/revoke/handoff tests pass; post-issuance membership is R03. |
| Duplicate membership/first registration | partial | Sequential case passes; concurrent claim is R04. |
| Safe steering/native metadata | partial | Redaction passes; unavailable authority is R05. |
| Private-key/secret locality | unit/code pass | Safe payloads exclude credentials; no live filesystem/Cloudflare inspection. |

## Current dispositions

All are new 23F dispositions for the authorized candidate; none is fixed or waived.

| Finding | Status | Disposition |
|---|---|---|
| 23F-R01 | open | P1 merge blocker: reconnect identity fails. |
| 23F-R02 | open | P1 merge blocker: durable replay claim is non-atomic. |
| 23F-R03 | open | P1 merge blocker: membership revocation bypass. |
| 23F-R04 | open | P1 merge blocker: concurrent home/default race. |
| 23F-R05 | open | P2: native authority-unavailable semantics need repair. |
| 23F-R06 | open | P2: required detail API is absent. |

## Structured review object

{
  "schema_version": "1.0",
  "review_type": "consuelo_assigned_worker_high_signal_review",
  "review_round": 1,
  "reviewer": "23F",
  "pr": {"number": 1674, "title": "Stream/os-foundation-two", "url": "https://github.com/consuelohq/opensaas/pull/1674", "base_sha": "unavailable", "candidate_sha": "ef2530b136ec2a170915b583abfb2341899bd6ab"},
  "outcome": "issues_found",
  "confidence": "high",
  "context_checked": [
    {"source": "diff", "status": "checked"},
    {"source": "original_intent", "status": "checked"},
    {"source": "implementation_history", "status": "checked"},
    {"source": "tests_ci", "status": "checked"},
    {"source": "runtime_evidence", "status": "unavailable"},
    {"source": "existing_reviews", "status": "checked"},
    {"source": "repo_patterns", "status": "checked"}
  ],
  "findings": [
    {"id": "23F-R01", "status": "open", "authoritative_domain": "23F", "severity": "high", "priority": "P1", "category": "identity", "location": {"file": "packages/os/scripts/install.ts", "start_line": 847, "end_line": 853, "primary_line": 848, "symbol": "attemptWorkspaceDeviceLogin"}, "blocks_merge": true},
    {"id": "23F-R02", "status": "open", "authoritative_domain": "23F", "severity": "high", "priority": "P1", "category": "replay_resistance", "location": {"file": "packages/os/cloudflare/os-device-authority/src/stores.ts", "start_line": 380, "end_line": 391, "primary_line": 388, "symbol": "claimWorkspaceNodeNonce"}, "blocks_merge": true},
    {"id": "23F-R03", "status": "open", "authoritative_domain": "23F", "severity": "high", "priority": "P1", "category": "authorization", "location": {"file": "packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts", "start_line": 57, "end_line": 104, "primary_line": 92, "symbol": "authenticateWorkspaceMember"}, "blocks_merge": true},
    {"id": "23F-R04", "status": "open", "authoritative_domain": "23F", "severity": "high", "priority": "P1", "category": "consistency", "location": {"file": "packages/os/cloudflare/os-device-authority/src/services/grants.ts", "start_line": 42, "end_line": 69, "primary_line": 50, "symbol": "rememberAccountWorkspace"}, "blocks_merge": true},
    {"id": "23F-R05", "status": "open", "authoritative_domain": "23F", "severity": "medium", "priority": "P2", "category": "presence_semantics", "location": {"file": "packages/os/scripts/lib/native-lifecycle-endpoint.ts", "start_line": 163, "end_line": 214, "primary_line": 200, "symbol": "localWorkspace"}, "blocks_merge": false},
    {"id": "23F-R06", "status": "open", "authoritative_domain": "23F", "severity": "medium", "priority": "P2", "category": "api_contract", "location": {"file": "packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts", "start_line": 412, "end_line": 428, "primary_line": 416, "symbol": "registerWorkspaceNodeRoutes"}, "blocks_merge": false}
  ],
  "top_level_pr_comment": "23F found four open P1 findings and two P2 findings in the authorized candidate: reconnect key reuse, atomic heartbeat replay claims, membership revocation propagation, concurrent first-home/default creation, native authority-unavailable semantics, and missing node detail. Focused units pass, but D1 is skipped, the Workers build is failed, and Ko-owned two-Mac acceptance is unavailable. ☑️ issues found",
  "agent_fix_prompt": "Address 23F-R01 through 23F-R04 before merge: reuse persisted keys or fail closed on recovery, make nonce claims atomic, enforce active membership at every node/MCP/steering/native boundary, and make first-home/default registration transactional. Then repair R05/R06, rerun D1/Cloudflare checks, and complete Ko's two-Mac acceptance."
}

## Top-level signoff

☑️ issues found

DOMAIN BLOCKED


## Gate results

- review.run --base HEAD --strict --no-tests: completed with zero issues attributed to this task branch, zero blocking issues, and 23 pre-existing repository issues. The runner also reported missing task-worktree twenty-eslint-rules/configuration modules; these are unrelated to the report artifact.
- verify --base HEAD --no-stamp: the initial call failed with an HTTP 504 transport response; the retry did not return a result before the workspace wait was aborted. Verification is therefore unavailable, not represented as a pass.
- Focused OS suites remain the applicable local evidence: 52/52 and 70 assertions passed; D1 route-registry tests were explicitly skipped.

## Final handoff

The report is report-only and does not modify product code or the shared finding ledger. Ko owns the missing two-Mac acceptance and live Cloudflare/D1 evidence. Worker 23 should not clear 23F until R01-R04 are repaired and the unavailable runtime gates are completed.

DOMAIN BLOCKED
