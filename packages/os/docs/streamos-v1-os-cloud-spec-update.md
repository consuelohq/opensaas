# StreamOS V1 Spec — OS Cloud update

Updated: 2026-06-02
Stream: `stream/os`
Design wiki page: `/specs/streamos-v1-spec`

This document is the durable source for the June 2 StreamOS V1 spec refresh. The live design wiki artifact should mirror this content when the archive page is regenerated or patched.

## Current State / Implementation Checkpoint

You are here: local OS, hosted installer, `tools.search`, app-visible artifacts, skills, and the expanded review packet are in `stream/os`. The next useful work is local dogfood, required MCP auth hardening, and OS Cloud gateway design.

Already landed in `stream/os`:

- `packages/os` Bun/TypeScript runtime.
- Local server on `127.0.0.1:8850`.
- CLI front door and OS command surface.
- Pre-Bun bootstrap installer at `packages/os/scripts/bootstrap.sh`.
- Hosted installer endpoint: `GET /os` serves the maintained bootstrap script.
- Hosted installer domain corrected to `https://install.consuelohq.com/os`.
- User-level LaunchAgent generation/install path with labels:
  - `com.consuelo.system`
  - `com.consuelo.watchdog`
  - `com.consuelo.portless.system`
- `tools.search` ported into OS dev tooling.
- Cloud artifact adapter / Consuelo app Files API path.
- Consuelo Design skill shell and task skill import direction.
- Expanded review packet at `packages/os/docs/review/stream-os-pr-362-review-packet.md`.

Current useful work:

- Start day-one dogfood through the existing workspace MCP bridge into local OS at `127.0.0.1:8850`.
- Harden MCP auth by generating and requiring local bearer tokens.
- Design OS Cloud as the team remote gateway, not as public direct exposure of a user machine.
- Map Railway/DNS for `install.consuelohq.com` so hosted curl works from production.

## Positioning Update

Consuelo OS is now positioned as **OS Local + OS Cloud**: an agent operating layer and tool gateway for teams.

Executor validates the category. Treat it as a direct competitor/reference product, not a separate market. The shared job is giving AI agents secure, shared, policy-aware access to company tools, APIs, credentials, and execution surfaces.

Positioning line:

> Executor is an integration gateway for AI agents. Consuelo OS is an agent operating system that includes an integration gateway and adds opinionated workflows, skills, context, traces, approvals, artifacts, and team execution patterns.

Use `OS Cloud`, not `company computer`, when describing the hosted/team side.

Executor language worth learning from:

- Integration layer.
- Gateway.
- Sources.
- Tool catalog.
- Policies.
- Scopes.
- Executions.
- Resume.
- Cloud / Desktop.

Consuelo OS differentiation:

- Steering.
- Skills.
- Workpads.
- Traces.
- Task/PR workflows.
- Explore / tool search.
- Review packets.
- Design/spec workflows.
- Business workflow context.
- Agent experience orchestration, not just tool execution.

## Decisions that should not be re-litigated

### Use OS Cloud language for the hosted product

Replace older hosted `company computer` wording with `Consuelo OS Cloud` / `OS Cloud`. Local remains the developer trust wedge; cloud is the team, revenue, remote MCP URL, policy, sync, and admin-control product.

### Treat Executor as a direct competitor/reference

Executor validates the category and overlaps the same job-to-be-done. Borrow useful concepts such as sources, tool catalog, policies, scopes, executions, resume, desktop/local, and cloud language. Do not copy branding. Differentiate through Consuelo's agent experience layer: skills, steering, workpads, traces, PR/review workflows, design/spec workflows, and business context.

### Do not expose a user's machine directly as the remote product

The final remote MCP product should use Consuelo-owned team URLs and a cloud gateway. Local OS should dial out to Consuelo Cloud through an outbound connector. The gateway should route authenticated requests to the correct connected OS session. Avoid asking users to configure routers, inbound ports, DNS, or direct public tunnels to their laptop.

### Default team URLs should live under the Consuelo domain

Use a Consuelo-owned shape such as:

```text
https://<team>.os.consuelohq.com/mcp
```

A path-based shape like `https://os.consuelohq.com/mcp/<team>` is acceptable as a fallback, but subdomains are preferred for clarity, Cloudflare routing/logs, and future custom domains.

### Local dogfood can start before the full remote gateway exists

For Ko's first testing loop, ChatGPT can reach the existing workspace MCP, and the workspace MCP can call the local OS at `127.0.0.1:8850`. This is enough to find installer, runtime, LaunchAgent, tool facade, artifact, and workflow bugs.

### No remote exposure without required auth

The current local server's bearer token is optional, which is acceptable only for local-only dogfood. Before any remote/tunnel/beta exposure, the installer must generate a bearer token, the server must require it by default for non-health routes, and unauthenticated mode must require an explicit local dev flag.

### Curl installer is V1; npm/Bun/Homebrew can follow

The hosted curl installer is the correct first path because it works before Bun or npm exists. Later, add trust/polish channels such as `bunx @consuelohq/os install`, `npx @consuelohq/os install`, and Homebrew. Those should remain thin wrappers around the same bootstrap/release source.

### OS context should become SQLite-first

The current copied context command still uses Supabase memories. For product OS, local context should move into `~/.consuelo/os/consuelo.db` alongside traces, artifacts, executions, agent connections, settings, and index metadata, with optional cloud sync later.

## Ship Checklist Refresh

### 0. Current Stream Gate — PR #362

- [x] Main stream PR exists for `stream/os`.
- [x] Use OS terminology in new product/docs work: OS Local, OS Cloud, skills, sources, tools, artifacts, approvals, policies, and guardrails.
- [x] Fix hosted installer domain to `install.consuelohq.com`.
- [ ] Before final merge to main, re-run stream PR checks and confirm no stale conflict/check language remains.

### 1. Package And Local Runtime — foundation

- [x] `packages/os` exists and follows the Bun/TypeScript product runtime direction.
- [x] Local OS home defaults to `~/.consuelo/os`.
- [x] Local folder shape includes agents, skills, scripts, artifacts, logs, runs, cache, runtime, bin, tmp, and SQLite.
- [x] Bun server exposes local OS endpoints on `127.0.0.1:8850` by default.
- [ ] Remove or isolate internal-only dev context before customer deployment.

### 2. Bootstrap, CLI, And Onboarding — local agents

- [x] Consuelo CLI is wired as the front door for OS commands.
- [x] `install`, `doctor`, `start`, `status`, and server management commands exist.
- [x] Pre-Bun bootstrap script exists at `packages/os/scripts/bootstrap.sh`.
- [x] Hosted installer route serves the bootstrap script at `GET /os`.
- [x] Installer supports dry run, custom home, local/cloud mode, agent connection flags, Bun install prompts, and daemon install flags.
- [ ] Run repo-local bootstrap dogfood on Ko's Mac and record first bugs.

### 3. Background Runtime — LaunchAgents

- [x] User LaunchAgent generation/dry-run path exists.
- [x] Productized labels are `com.consuelo.system`, `com.consuelo.watchdog`, and `com.consuelo.portless.system`.
- [x] Logs default to `~/Library/Logs/Consuelo`.
- [ ] Verify real launchctl install/status/stop/uninstall and crash restart behavior locally.
- [ ] Make background service status visible during onboarding and doctor.

### 4. Agent Connections — Codex, Claude, OpenCode

- [x] Agent detection covers Codex, Claude, OpenCode, and Factory-style homes.
- [x] Agent connection writes OS portal config records and backs up existing agent config files.
- [x] Connected agents are recorded in `~/.consuelo/os/config.json`.
- [ ] Verify real Codex, Claude, and OpenCode behavior end to end, not just config writes.
- [ ] Add ChatGPT Desktop connection path once its local/remote MCP config contract is confirmed.

### 5. Skills, Steering, And Agent Experience — differentiator

- [x] `packages/os/skills` exists.
- [x] Task skill and Consuelo Design skill shape have been ported toward OS.
- [x] Skill registry JSON and progressive disclosure direction exists.
- [x] Scripts remain the executable implementation behind skills.
- [ ] Lean into skills, steering, workpads, traces, and tool chaining as Consuelo's differentiator over a generic integration gateway.
- [ ] Add skill docs that explain purpose, inputs, outputs, capabilities, artifacts, approvals, and failure modes.

### 6. Workspace Data And Artifacts — Consuelo app

- [x] Create read-only `consuelo-workspace-snapshot` skill/facade.
- [x] Wrap Consuelo GraphQL/API access in a typed Bun facade.
- [x] Cloud artifact adapter and app-visible artifact URLs use Consuelo app Files API/S3 as the source of truth.
- [x] Artifacts are publishable as app-native file records with storage behind them.
- [ ] Make Daily Revenue Brief consume the real workspace snapshot and app-visible artifacts.
- [ ] Version artifacts by creating new versions rather than mutating important outputs in place.

### 7. Tools And Sources — gateway layer

- [x] `tools.search` is available in OS dev tooling.
- [x] Dev tooling manifest/docs/types are generated for the OS facade.
- [ ] Adopt clearer product language around sources, tool catalog, policies, scopes, executions, and resume where it fits.
- [ ] Add first-class source ingestion for OpenAPI, GraphQL, MCP, and custom functions when moving beyond internal workspace tools.
- [ ] Decide which source/tool catalog primitives are local-only, cloud-synced, or team-admin governed.

### 8. Guardrails, Approvals, And Security — near blocker

- [x] Local guardrails block sensitive key/browser/system paths in tests.
- [x] Local guardrails require approval for writes outside OS home.
- [x] Destructive shell commands are blocked.
- [ ] Current bearer auth is optional. Before remote/tunnel exposure, installer must generate a token and server must require it by default for non-health routes.
- [ ] Add explicit unauthenticated local dev mode only behind `CONSUELO_OS_ALLOW_UNAUTHENTICATED_LOCAL=1`.
- [ ] Add native approval request service with explicit resume.

### 9. OS Cloud Gateway — remote MCP

- [ ] Design Consuelo-owned remote MCP URLs such as `https://<team>.os.consuelohq.com/mcp`.
- [ ] Build Consuelo Cloud Gateway that resolves team slug, authenticates client, enforces policy, audits requests, and routes to a connected local OS.
- [ ] Build outbound local connector so user machines dial out instead of accepting inbound public traffic.
- [ ] Layer Cloudflare WAF/rate limits/IP beta gates as defense in depth, not the primary identity model.
- [ ] Support token rotation, revocation, per-client scopes, and mutating/read-only policy splits.

### 10. OS Cloud Deployment — Railway + DNS

- [x] Hosted installer endpoint exists in the app server as `GET /os`.
- [x] Hosted installer command uses `https://install.consuelohq.com/os`.
- [ ] Map Railway/DNS so `install.consuelohq.com` reaches the service that serves `/os`.
- [ ] Verify hosted curl returns the maintained bootstrap shell with the expected content type and no stale domain strings.
- [ ] Document production env such as `CONSUELO_OS_BOOTSTRAP_SCRIPT_PATH` if container working directory differs.

### 11. Release Channels And Distribution — trust

- [x] Hosted curl installer is the V1 path because it works before Bun/npm exists.
- [ ] Define stable, canary, and dev/ref install channels before external beta.
- [ ] Add installed version/ref recording and update path.
- [ ] Add thin npm/Bun wrapper later: `bunx @consuelohq/os install` and `npx @consuelohq/os install`.
- [ ] Add Homebrew distribution when the bootstrap/release artifact is stable.

### 12. Local State And Context — SQLite-first

- [x] Runtime traces/executions and artifacts already use local OS paths and SQLite foundations.
- [ ] Current copied context command still depends on Supabase memories and is not product-ready for OS.
- [ ] Unify local state around `~/.consuelo/os/consuelo.db`: traces, artifacts, context entries, index metadata, settings, and agent connections.
- [ ] Add local context save/search/list/get on SQLite first, with optional cloud sync later.
- [ ] Keep secrets in env/keychain/secret store references, not raw context rows.

### 13. Observability And Execution Logs — debuggability

- [x] Every call emits a trace ID.
- [x] Every skill execution has before/after records.
- [x] Logs redact secrets, tokens, credentials, full phone numbers, and sensitive raw payloads.
- [ ] Execution records should consistently include status, duration, artifact IDs, approval status, safe error message, and source object references.
- [ ] Make trace inspection first-class in local UI/doctor and OS Cloud audit logs.

### 14. Review Cleanup And Ship Gates — PR #362

- [x] Expanded review packet exists at `packages/os/docs/review/stream-os-pr-362-review-packet.md`.
- [ ] Use the packet to split remaining Graphite/CodeRabbit cleanup across focused agents.
- [ ] Close stale/outdated review threads after validating against current stream.
- [ ] Fix remaining critical local testing blockers before dogfood becomes daily-driver work.

### 15. Competitor/Reference Research — Executor

- [x] Executor video and repository were ingested into research context.
- [x] Decision recorded: Executor is a direct competitor/reference for the same job-to-be-done.
- [ ] Deep-read Executor code for sources, schemas, MCP server, secrets, approvals, resume, daemon, desktop, and cloud/local split.
- [ ] Update Consuelo OS terminology where Executor proves clearer category language.

### 16. Optional Desktop Shell — Tauri/Electron

- [ ] Keep desktop wrapper as optional, not blocking V1 local/server dogfood.
- [ ] If pursued, prefer a two-phase app: wrapper around OS Cloud/local UI first, deeper native runtime later.
- [ ] Use desktop only if it improves onboarding, background status, logs, and team trust.
