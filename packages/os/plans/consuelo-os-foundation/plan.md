# Final Consuelo OS Distribution, Nodes, Updates, Providers, Web, and Native Delivery Plan

Status: final architecture baseline. The concrete environment registry in section 11.1 is complete. Wave 0 becomes dispatchable after this tracked plan and integrated review procedure reach `main`. Later product changes require an explicit plan revision rather than silent worker interpretation.

## 1. Product outcome

Consuelo OS must become a durable, updateable product that can be installed once, safely updated, customized without losing user work, connected to one workspace across nodes, and operated without requiring customers to understand the Consuelo repository or Consuelo's own Cloudflare/Railway infrastructure.

The finished system must provide:

- one lifecycle surface for install, update, repair, rollback, status, and uninstall;
- immutable runtime bundles promoted through dev, canary, beta, and stable without rebuilding;
- an always-on internal dev installation on Ko's Mac Mini;
- mandatory real-machine canary/beta acceptance on the MacBook Air before the relevant promotion, with Ko controlling when the machine is online and when installation runs;
- a server-backed node registry that can distinguish, list, route, and revoke multiple computers in one workspace without treating the newest install as the home node;
- deterministic handling of bundled, modified, and user-owned tools, skills, sites, scripts, and jobs;
- concise installed-skill, node, and update context in OS steering;
- customer-facing Railway, Vercel, and Cloudflare tools built around the providers' installed CLIs;
- workspace-local product routes such as `https://<workspace>.consuelohq.com/gtm`;
- a protected universal login and workspace-routing flow rooted at `https://os.consuelohq.com`;
- a native Swift menu-bar application that wraps the same lifecycle engine rather than reimplementing it;
- native macOS, Linux, and Windows service/install behavior;
- a mandatory isolated clean-host test lane before Ko performs any real-machine install;
- an OS-native worker workflow with task-scoped Grok 4.5 and CodeRabbit review evidence;
- one canonical tool-package layout in which manifests route to implementations without ambiguous `scripts`, `tools`, and `tooling` authorities;
- enough automated and live validation that Ko is not the first person to discover installer, updater, routing, or tool-registry failures.

## 2. Non-negotiable product decisions

### 2.1 Machine and channel roles

- The Mac Mini is the always-on `dev` node and primary internal Consuelo OS.
- The MacBook Air is the real-machine canary/beta acceptance node. It is not required to stay online between acceptance runs.
- Ko, not a worker agent, runs install, update, reset, and uninstall commands on either real Mac. Workers prepare, test, publish, observe, and provide the exact checkpoint command.
- Open pull requests run checks but do not deploy or replace a local OS installation.
- A merge to `main` evaluates the OS runtime closure and automatically publishes exactly one immutable `dev` release only when that closure changed.
- Permanent protected `canary`, `beta`, and `stable` release branches provide visible GitHub promotion state. They accept no feature work or direct human commits, but they are secondary references rather than release identity.
- Canary, beta, and stable channel manifests point to an already-built runtime bundle. Promotion never rebuilds.
- The updater supports a persistent channel setting and an explicit `--channel dev|canary|beta|stable` override.
- Stable promotion is manual.

### 2.2 GitHub workflow

Keep the existing task and stream workflow for feature integration:

```text
task branch -> stream branch/PR -> main
```

Add permanent protected release branches named `canary`, `beta`, and `stable`. They are automation-controlled, human-readable promotion refs, not alternate feature-development histories and not the source of release identity. A promotion branch may point only to a commit already integrated into `main`, and branch movement must reference the exact previously published release version and runtime-bundle digest.

```text
merge to main
  -> test
  -> classify the OS/runtime closure and calculate its version-neutral release fingerprint
  -> if unchanged from current dev: record a no-op and publish nothing
  -> if changed: calculate the next version once, build one immutable runtime-bundle set, and publish it
  -> create immutable tag consuelo-os-vX.Y.Z and matching GitHub Release assets
  -> publish the same bytes by digest to Cloudflare R2
  -> move dev channel pointer

promote dev digest -> canary branch + channel manifest + GitHub prerelease
promote canary digest -> beta branch + channel manifest + GitHub prerelease
promote beta digest -> stable branch + channel manifest + GitHub Release
```

The authority hierarchy is: signed channel manifests for current channel resolution; immutable `consuelo-os-vX.Y.Z` tags plus GitHub Releases for release identity and retained assets; GitHub Deployments for promotion evidence and approvals; and protected moving channel branches for human GitHub visibility only. Cloudflare serves signed channel manifests and bundle bytes to installers without requiring users to have GitHub or Cloudflare accounts. No branch head, package file, or local machine state may independently invent or override a version.

Version assignment is automatic and centralized:

1. Build tooling classifies the customer runtime closure and computes a deterministic, version-neutral `releaseFingerprint` before archive creation.
2. Compare that fingerprint with the current dev release. If equal, do not bump a version, rebuild bytes, create a tag, create a Release, or move a channel.
3. If changed, derive the next SemVer from the highest immutable `consuelo-os-vX.Y.Z` tag. Default to a patch bump. An explicit validated release-intent label or manual input may request minor or major. The first release uses one explicitly approved seed version because no Consuelo OS release tag exists yet.
4. Compute the version once and inject that exact value into every platform runtime-bundle manifest, the immutable tag, the GitHub Release, GitHub Deployment metadata, and the signed dev channel manifest.
5. A retry for the same source commit and release fingerprint must find and reuse the same version and assets idempotently; it must not allocate another version.
6. Promotion from dev to canary to beta to stable changes pointers and evidence only. It never changes the version, release fingerprint, bundle digest, or bytes.

`schemaVersion` is independent of the product version. It changes manually only when a manifest/config format changes and has an explicit migration or compatibility decision. The release-impact classifier must prove that docs, tests, internal audit fixtures, or unrelated GTM changes do not create an OS release when the customer runtime closure is unchanged.

### 2.3 Internal reset policy

Ko is willing to uninstall and reinstall the current internal OS while this foundation is built. Use that zero-history window to establish the correct clean baseline, but do not design an updater that depends on destructive reinstalls for future users.

Provide an explicit development-only reset bun command. Never make reset the implicit behavior of update or repair.

### 2.4 Local layout

`~/.consuelo/` is the product root. New installs must not recreate
`~/.consuelo/os/`; that path is legacy migration input only. Runtime-bundle
archives are path-neutral and are activated beneath
`~/.consuelo/runtime/releases/<bundle-id>/`, with `runtime/current` selecting
the active release. Node-local state and shared workspace configuration remain
siblings of `runtime/`, not children of a release.

Hidden machine/runtime state:

```text
~/.consuelo/
  consuelo.yaml
  runtime/
    current -> releases/<bundle-id>
    previous -> releases/<bundle-id>
    releases/<bundle-id>/
    update-cache/
  node/
    node.yaml
    keys/
    security/
    tunnels/
    caddy/
    db/
    logs/
    runs/
    tmp/
  workspaces/<workspace-id>/
    shared/
    state/
  components/
    installed-skills.json
    provenance.json
    update-plan.json
```

Visible user-owned content, created immediately by every clean install:

```text
~/Consuelo/
  Artifacts/
  Projects/
  Sites/
  Skills/
  Tools/
  Steering/
```

Built-in tools, scripts, and site templates execute from the immutable runtime
bundle. Selected bundled skills are materialized as managed visible
`SKILL.md` trees under `~/Consuelo/Skills/`, with hidden component indexes
recording their selection, provenance, and update/merge state. `~/Consuelo/Tools/`
is the custom-tool and built-in catalog surface; built-in executable code is
not copied there. User-authored tools, skills, sites, and steering live only in
the visible user-owned tree. Do not maintain two editable copies of the same
component. Do not create `~/Consuelo/Scripts`.

`system_prompt.md` remains a managed product policy in the runtime bundle. User steering belongs in `~/Consuelo/Steering/`; updates never overwrite it. Future workspace sync may synchronize approved user-owned content, but never secrets, node identity, local databases, logs, tunnel credentials, Caddy state, or the entire Consuelo home.

`consuelo.yaml` is the small human-editable OS configuration boundary for channel, update-notification, and other approved preferences. Runtime state, traces, tokens, node keys, and mutable indexes remain structured node-local data, not YAML.

### 2.5 Release retention

The runtime does not need Git.

- Keep the active `current` runtime bundle.
- Keep one known-good `previous` runtime bundle.
- Keep explicitly pinned runtime bundles.
- Keep only the content bases required for unresolved managed-component merges.
- Delete abandoned temporary installs after retaining redacted diagnostics.
- Prune every other runtime bundle.
- Development-only test homes and previews must have TTL and count limits.
- No open PR deploys automatically, so PR preview installations are not part of the default design.

### 2.6 GTM routing

GTM belongs to the authenticated workspace domain:

```text
https://internal.consuelohq.com/gtm
https://<customer-workspace>.consuelohq.com/gtm
```

`app.consuelohq.com` is not the GTM destination.

### 2.7 Provider tools

Customer-facing deployment capabilities stay in OS:

- Railway
- Vercel
- Cloudflare

Consuelo operator-only infrastructure does not ship as a customer tool:

- Consuelo OS release deployment;
- Consuelo WAF migrations;
- Consuelo route-registry administration;
- hard-coded Consuelo account, project, service, zone, repository, or workspace defaults;
- release credentials or production tokens.

The separation is capability-based, not filename-based.

### 2.8 Multiple nodes

- A verified account owns one workspace in this launch model.
- The first approved install creates the home node. A later install with the same account joins that workspace as a distinct member node.
- Every node has a stable local ID, public-key thumbprint, display name, platform, architecture, role, connector ID, capabilities, creation time, last-seen time, and revocation state.
- Node secrets and private keys never leave the node.
- Signed heartbeats establish `online`, `offline`, or `stale` presence using a bounded TTL. A powered-off Mac is reported offline, not treated as a routing failure or silently replaced.
- The workspace maintains a default node explicitly. A new member-node install cannot overwrite the home/default route.
- Calls may target an explicit authorized node. When no target is given, routing uses the workspace default and fails clearly if it is unavailable; it never falls back to another computer without disclosure.
- Authenticated settings, steering, and the native app can list safe node metadata and connection state.
- Ko performs the two-Mac acceptance login. Workers may inspect and validate only after Ko confirms each install step.

### 2.9 Product and CLI boundaries

- `consuelo` becomes the OS lifecycle CLI: install, status, restart, update, repair, rollback, channel, node, and uninstall.
- The existing sales/dialer CLI is preserved and renamed `consuelo-dialer`; it is not deleted or redesigned in this initiative.
- The current mixed `packages/cli` implementation must be split deliberately so OS lifecycle does not inherit dialer, Twenty SDK, Twilio, coaching, or GTM dependencies.
- A future GTM tool may use `consuelo-dialer`, but that work does not block OS distribution.

## 3. Confirmed current-code facts

Workers must verify these facts against their task base before editing:

- `packages/os/scripts/bootstrap.sh` already promotes hosted source into `~/.consuelo/runtime/releases/<id>` and switches `runtime/current` atomically.
- Current release promotion has no complete retention/pruning policy.
- `packages/os/scripts/lib/install-state.ts` copies broad runtime directories and currently seeds `system_prompt.md` and `decision.md`.
- `packages/os/scripts/os.ts` already excludes `decision.md` from `get_steering`.
- The installer generates an installed `skills/skills.json`, but `get_steering` does not read it.
- Device authority already persists an `AccountWorkspace` and keyed `WorkspaceNode`, sends node ID/name through install, and labels the first node `home` and later nodes `member`.
- Current node persistence cannot list a workspace's nodes, has no signed heartbeat/presence model, and does not expose authenticated node management.
- Current workspace route provisioning stores one connector target for the workspace route, so a later node provision can replace the target instead of coexisting safely.
- Current runtime identity omits safe current-node details, workspace host, and update-channel state.
- Bundled tools and skills already have source-hash metadata and preserve locally modified copies. This is the starting point for managed-component provenance, not the complete update model.
- `packages/os/manifests/tool.manifest.json` currently contains 152 generated entries from three sources; `core.manifest.json` contains 13 steering/bootstrap entries.
- `packages/os/tooling/dev-tool-manifest.json` contains 123 development tools and `media-tool-manifest.json` contains 25 media tools. Both capability sets remain product tools and must be included in the generated full catalog.
- `packages/os/tooling/tool-manifest.json` contains four legacy skill actions, including stale `get_raw_steering`, `daily-revenue-brief`, and `consuelo-workspace-snapshot` entries. Remove those legacy actions unless an inventory proves an action is still an intentional current product capability.
- `workflow-bundles.json` is actively consumed by manifest overlay, settings snapshot, install state, intent hooks, and workflow tests. It is a separate workflow runtime output, not a competing tool manifest.
- `script-parity-classifications.json` is an internal audit fixture and currently ships accidentally through broad `tooling/` copies. It must move to an internal test/audit fixture path and stay out of customer bundles.
- `tool-manifest.schema.json` supports build, test, and documentation validation. Keep it under manifest schemas, but do not ship it unless a runtime consumer is proven.
- `packages/os/scripts` currently contains roughly 95 top-level files, `packages/os/tooling` contains manifest/schema/runtime metadata, and `packages/os/tools` contains a small unrelated legacy Python collection. The directory names do not express one clear tool ownership model.
- `packages/os/scripts/consuelo-reload.js` and `packages/os/scripts/workspace-watchdog.sh` already implement mature reload behavior: reply-safe detachment, launchd/direct modes, conflicting-label cleanup, kill escalation, bounded health acceptance, and rate-limited watchdog recovery. `packages/os/scripts/server.js` contains older duplicated service orchestration that must not become a second restart authority.
- Railway tools exist but are inherited from internal workspace scripts, include Consuelo-specific defaults, synchronous shell composition, and at least one hard-coded Railway project/service/environment path.
- First-class generic Vercel and Cloudflare provider tools are not currently present.
- Root and workspace package scripts hard-code Homebrew SQLite through `DYLD_LIBRARY_PATH`; that is not portable.
- `packages/os/Dockerfile` is not a sufficient distribution contract and currently copies only a subset of runtime inputs.
- `packages/cli` currently registers both sales/dialer commands and OS commands under the `consuelo` binary, including Twenty SDK, Twilio/dialer, coaching, deploy, and OS dependencies.
- The repository root license is inherited AGPL/commercial text while `packages/os` and `packages/workspace` currently contain Apache-2.0 licenses. Ko's desired MIT position is not the current repository reality and requires a provenance/legal audit before any license replacement.
- Production hot fixes and deployed Worker state must be reconciled to `main` before the first signed baseline release; no worker may assume GitHub source and deployed Cloudflare state are identical without checking.

## 4. Runtime-bundle and channel contract

### 4.1 Runtime bundle

One build produces an immutable, platform-specific runtime bundle and a machine-readable manifest.

Required manifest fields:

```json
{
  "schemaVersion": 1,
  "product": "consuelo-os",
  "version": "0.0.0",
  "sourceCommit": "<full-sha>",
  "releaseFingerprint": "sha256:<version-neutral-runtime-closure-digest>",
  "bundleId": "sha256:<digest>",
  "platform": "darwin-arm64",
  "createdAt": "<iso8601>",
  "minimumUpdaterVersion": "0.0.0",
  "files": [],
  "migrations": [],
  "signature": {}
}
```

The runtime-bundle builder uses an allowlist. Clean-host tests, Bun compilation, installers, and native packaging consume the same bundle contract. The release workflow calculates `version` once and passes it to every platform builder; builders do not infer or increment versions.

### 4.2 Channel manifest

Each channel is a small signed pointer:

```json
{
  "schemaVersion": 1,
  "channel": "dev",
  "bundleId": "sha256:<digest>",
  "version": "0.0.0",
  "promotedAt": "<iso8601>",
  "sourceChannel": null,
  "signature": {}
}
```

Channel promotion verifies runtime-bundle existence, digest, signature, platform coverage, required test evidence, and legal transition order. It updates the protected release branch and signed channel pointer, then records a GitHub deployment and Release/prerelease without rebuilding.

The channel manifest copies the immutable release version; it has no independent version counter. The runtime-bundle manifest, immutable tag, GitHub Release, GitHub Deployment, and every channel manifest that references the release must agree on `version`, `releaseFingerprint`, source commit, and bundle digests. Promotion must reject any mismatch.

### 4.3 Channel behavior

- `dev`: latest green runtime bundle built from `main`; Mac Mini tracks this channel after Ko runs the install/update command.
- `canary`: explicitly promoted dev bundle after mandatory isolated clean-install/update gates.
- `beta`: explicitly promoted canary bundle after mandatory real-machine acceptance on the MacBook Air.
- `stable`: manually promoted beta bundle for launch users.
- A user can pin a bundle/version, pause automatic application, and disable or snooze update notices.

## 5. Lifecycle engine

Expose one typed engine and thin CLI/UI adapters:

```text
consuelo status
consuelo install [--channel]
consuelo restart
consuelo update [--channel] [--check] [--yes]
consuelo channel [show|set]
consuelo updates notifications [on|off|snooze]
consuelo repair
consuelo rollback
consuelo uninstall
consuelo dev reset
```

Lifecycle requirements:

1. Acquire a machine-local update lock.
2. Read current install and channel state.
3. Fetch and verify signed channel and runtime-bundle manifests.
4. Download to a temporary directory.
5. Verify every file digest before execution.
6. Install runtime dependencies or use the compiled runtime bundle.
7. Run preflight and schema migrations.
8. Stop only Consuelo-owned services.
9. Atomically switch `current`, retaining `previous`.
10. Reinstall/reload platform services.
11. Run bounded health, MCP, steering, and tool-call checks.
12. Roll back automatically on failed acceptance.
13. Write redacted structured diagnostics.
14. Prune according to retention policy.

Existing installs must update without repeating Google OAuth, workspace creation, skill selection, or agent onboarding unless relevant state is missing or invalid.

`consuelo restart` is a typed lifecycle adapter around the proven `consuelo-reload.js` and watchdog behavior. Preserve reply-safe asynchronous reload, launchd and direct-process modes, conflicting-label cleanup, TERM-to-KILL escalation, bounded health acceptance, and rate-limited watchdog recovery. Consolidate duplicated restart orchestration in `server.js` only after characterization tests prove parity. Restart touches only Consuelo-owned local services and never reinstalls or repeats onboarding.

Install and update are distinct state machines. The installer accepts a channel through a stable flag/environment contract; the updater reads the saved channel unless explicitly overridden. Ko performs all real-Mac lifecycle commands.

## 6. Managed components and user ownership

### 6.1 Classes

1. Immutable runtime: engine code and generated runtime assets, atomically replaced.
2. Managed bundled components: built-in tools, skills, site templates, scripts, and job templates.
3. User-owned content: custom tools, skills, sites, projects, artifacts, and jobs.

### 6.2 Provenance

Each managed component records:

- component kind and stable ID;
- source runtime-bundle/version;
- installed base hash;
- current local hash;
- target upstream hash;
- install/update timestamps;
- ownership (`bundled`, `custom`, or `detached`);
- current resolution state.

### 6.3 Update planning

Generate `update-plan.json` as runtime data. YAML remains limited to small human-edited configuration boundaries.

Each item must be one of:

- `install`
- `update-clean`
- `preserve-custom`
- `merge-clean`
- `conflict`
- `remove-upstream`
- `detach`
- `no-change`

The plan is deterministic. AI may explain, review, or propose resolution patches, but AI is not the source of update correctness.

For modified managed components, calculate a real three-way comparison:

```text
installed base -> local version -> new upstream version
```

Never overwrite a conflict. Preserve the local version and expose the conflict for review.

Updates for installed built-in components are part of the selected channel and are not optional for worker agents. A user may decline applying an available OS update, pin a version, snooze notices, or disable update notifications. That preference is stored in typed local configuration and summarized in steering without repeatedly nagging the user.

An install may still let a user choose which optional skills or integrations to enable. Once selected, their managed updates follow the lifecycle rules above; “optional selection” does not mean an agent can skip required implementation or validation work.

Study registry/source-ownership systems such as shadcn as prior art, but do not copy behavior that silently replaces local changes.

## 7. Steering contract

`get_steering` should remain compact and bootstrap-oriented.

Include:

- safe current-node identity: node ID or opaque short ID, display name, platform, architecture, channel;
- workspace identity: workspace ID/slug/host and default-node status, without credentials;
- installed skill index generated from the installed `skills.json`;
- the core tool manifest;
- a compact update summary only;
- managed `system_prompt.md` plus explicitly supported user steering files read from `~/Consuelo/Steering/`.

Do not include:

- `decision.md`;
- secrets, tokens, tunnel credentials, raw environment values, or broad filesystem details;
- complete update-plan items;
- full SKILL.md bodies;
- stale skills that were not selected/installed.

When updates are available, steering may instruct the agent to add one concise final notice such as `Consuelo OS: 2 updates available.` The agent must not read the full plan unless the user asks to inspect or apply updates.

When notifications are disabled or snoozed, steering omits that notice. Product updates never overwrite user steering.

## 8. Tool packages, manifests, and provider architecture

### 8.1 Canonical tool ownership

Use one clear Bun/TypeScript tool-package model:

```text
packages/os/tools/<domain>/
  manifest.ts
  handler.ts
  schema.ts
  handler.test.ts

packages/os/manifests/
  manifest.config.ts
  schemas/tool-manifest.schema.json
  generated/tool.manifest.json
  generated/core.manifest.json

packages/os/workflows/
  workflows.ts
  generated/workflow-bundles.json

packages/os/scripts/
  lifecycle, CLI, generator, and operator entrypoints only
```

- Every callable tool is a Bun TypeScript handler. A coherent domain package may expose several related typed actions; do not create one folder per manifest action blindly.
- A tool package owns its implementation, schema, tests, and TypeScript manifest contribution. Generated JSON is output, never editable source.
- `generated/tool.manifest.json` is the full executable and search catalog. Its verified initial target is the 123 development tools plus 25 media tools (148 total) after removing the four stale legacy skill entries. The generator, not a hard-coded count, remains authoritative as tools evolve; media tools are not deleted or split into a separate public authority.
- `generated/core.manifest.json` is the intentionally small steering/bootstrap subset. Full and core are the only shipped tool manifests.
- `workflows.ts` and generated `workflow-bundles.json` remain a separate active workflow runtime surface. They are not merged into the tool manifest and are not treated as a third tool authority.
- Move `script-parity-classifications.json` into an internal tests/audit fixture path and exclude it from runtime bundles.
- Keep `tool-manifest.schema.json` for build/test/docs validation under `manifests/schemas`; exclude it from runtime bundles unless a runtime import is proven.
- Remove stale `manifest-sources.json` and the four-entry legacy skill manifest after consumer and behavior proof. Do not preserve `get_raw_steering`, `daily-revenue-brief`, or `consuelo-workspace-snapshot` as aliases.
- `packages/os/tooling` is a migration source, not a permanent third concept. Delete it in the same release after all active consumers and tests use tool packages, generated full/core manifests, and workflow outputs.
- The small legacy Python `packages/os/tools` collection must be classified: migrate active behavior, archive intentionally external tooling, or delete dead code with proof.
- Scripts are tools when they implement callable tool behavior and must move into a domain tool package. `packages/os/scripts` remains only for true lifecycle/CLI/generator/operator entrypoints.
- Hono belongs only at HTTP route boundaries. Local tool handlers do not introduce Hono.
- This is a clean pre-launch cutover. Do not add path shims, deprecated aliases, duplicate manifests, or compatibility dispatch. Migrate consumers and tests, then delete the superseded source in the same release.

### 8.2 Provider layer

Create a provider layer using Effect for typed errors, service composition, capability checks, and testability.

Shared operations should include:

- detect CLI and version;
- report authentication state without extracting or returning secrets;
- inspect current project/account binding;
- list deployments/projects/services where supported;
- read deployment status and logs;
- deploy/redeploy with explicit approval boundaries;
- manage environment-variable names and presence without returning secret values;
- return structured, provider-neutral errors;
- offer raw CLI passthrough only as a clearly marked escape hatch.

Use argv-based process execution. Do not concatenate untrusted values into shell strings. Do not read tokens from provider config files when the provider CLI can authenticate and execute on the user's behalf.

Provider adapters:

- Railway: remove `opensaas`, `twenty-worker`, and hard-coded project/service/environment assumptions.
- Vercel: launch requirement; implement the useful minimum deeply enough for a real initial user.
- Cloudflare: customer-facing Worker/Pages/DNS/log/deploy capability, distinct from Consuelo platform provisioning.

## 9. Web, sites, GTM, and authentication

- `os.consuelohq.com` is the universal login and workspace-resolution entry.
- Pre-auth UI may show a static/sanitized blurred launcher preview, never protected workspace data hidden only through CSS.
- Google authentication resolves workspace membership.
- A same-account install resolves the existing workspace before any naming prompt, registers a distinct node, and preserves the existing home/default node unless the user explicitly changes it.
- Use a short-lived, single-use authorization handoff so the workspace host establishes its own session.
- Avoid a broad domain-wide authentication cookie when a scoped workspace session can be used.
- Existing protected routes remain protected.
- Workspace links are derived from authenticated workspace records, never hard-coded to `internal` or a test hostname.
- Internal links use `internal.consuelohq.com` only because that is Ko's authenticated workspace.
- GTM is served or routed at `/gtm` on the authenticated workspace host.
- Trace UI is per workspace and uses the existing Astro trace table/live feed behavior through the Hono server without importing the entire old dashboard.
- Route order, OAuth parameters, PKCE, token exchange, bearer challenges, redaction, and connector authorization remain regression-locked.
- Authenticated node-list, node-detail, default-node, and revoke operations return only safe metadata and enforce workspace membership.
- Connector and MCP routing select the authorized node record explicitly. No route mutation may silently replace one node with another.

## 10. Native and cross-platform delivery

### 10.1 Swift app

The Mac app is a native Swift/SwiftUI menu-bar app. It owns UX, not lifecycle business logic.

It should expose:

- current version/channel;
- update availability and apply action;
- service/tunnel/connector health;
- current workspace and node;
- safe list/presence of the workspace's other nodes;
- open launcher/settings/logs;
- repair, rollback, and uninstall confirmations;
- launch-at-login status;
- redacted diagnostic export.

Private alpha may use ad-hoc/unsigned installation. Keep signing, hardened runtime, notarization, and update-signature extension points explicit for later Apple Developer enrollment.

### 10.2 Platform adapters

- macOS: launchd, Swift app, permissions, browser integration, Apple silicon and Intel policy.
- Linux: systemd user service where available, XDG paths where appropriate, package/archive installation, distro test matrix.
- Windows: Windows service or scheduled background process chosen through a documented spike, PowerShell installer, path/ACL behavior, browser integration, executable packaging.

Shared business logic stays in Bun/TypeScript where portable. Platform operations live behind typed adapters.

## 11. Development and test environment

An isolated clean-host environment is mandatory before implementation waves can claim completion. The environment contract, fixtures, and commands are shared by all workers; individual agents do not invent one-off test homes.

Required execution lanes:

1. GitHub-hosted Ubuntu is the always-available clean Linux baseline.
2. At least one OCI-compatible container lane validates the cloud/Linux image and fresh filesystem behavior. Use Docker in CI by default; Apple's `container` may run the same OCI contract on a compatible Mac.
3. GitHub-hosted macOS validates macOS scripts and packaging without touching Ko's active installation.
4. GitHub-hosted Windows validates PowerShell, paths, ACLs, and service packaging.
5. Real Mac acceptance happens only after automated gates: Ko runs the command on the Mac Mini for dev and the MacBook Air for canary/beta.

Docker is not required on Ko's Mac, and agents must not block waiting for local Docker repair. Container validation itself is not optional; use CI when the local engine is unavailable. Cloudflare test resources are provisioned only for tests that require edge/tunnel behavior and must have TTL cleanup.

Containers validate Linux behavior and clean filesystem state. They do not validate launchd, Swift UI, macOS host permissions, Windows services, or full host process tools.

Required test layers:

- existing OS behavioral suites remain regression contracts, especially `os-get-steering-trace.test.ts`, `os-raw-steering.test.ts`, `install-state.test.ts`, `skills-registry.test.ts`, `mcp-gateway.test.ts`, and `security-gateway.test.ts`;
- pure unit tests for manifests, signatures, channels, provenance, merge classification, retention, and path resolution;
- process-level tests for CLI behavior and structured output;
- clean-home install tests;
- N-1 update tests;
- rollback and interrupted-update tests;
- Linux container/runner tests;
- macOS runner tests;
- Windows runner tests;
- Mac Mini dev smoke checks;
- MacBook Air canary/beta acceptance before beta promotion;
- two-node same-account registration, presence, default routing, explicit routing, offline, and revocation tests;
- live OAuth, MCP discovery, steering, `tools.search`, and harmless `call` acceptance before stable promotion.
- one-hour access-token expiry renewed transparently through refresh-token rotation without asking the user to reconnect; retries, duplicate refreshes, and interrupted responses cannot strand an otherwise valid connection.

No workflow should send customer secrets or unredacted diagnostics to GitHub Actions.

Before moving implementation, add characterization tests around the current behavior being reorganized. Keep existing behavioral assertions unchanged unless the approved product contract intentionally changes. For example, replace fresh-install assertions that require `decision.md` with assertions proving it is absent; do not broadly rewrite steering or gateway tests to bless a new architecture. Every intentional assertion change must cite the plan decision it implements, while all unrelated old tests continue to pass.

### 11.1 Environment registry (completed pre-dispatch gate)

The concrete registry is maintained at `packages/os/plans/consuelo-os-foundation/environment-registry.md`. Worker 01 established the local and CI harness coordinates on 2026-07-21. The architecture and worker scopes are final, but implementation workers that require a lane must use the named coordinate below rather than inventing another environment.

| Lane | Registered coordinate |
| --- | --- |
| OCI clean host | `.github/workflows/consuelo-os-distribution-environments.yaml`, job `oci-clean-host`, image `docker.io/oven/bun:1.3.14`, artifact `consuelo-os-distribution-oci-<run-id>` |
| macOS | job `native-runtime` / `macos`, runner `macos-26`, Apple Silicon arm64, artifact `consuelo-os-distribution-macos-<run-id>` |
| Windows | job `native-runtime` / `windows`, runner `windows-2025`, service behavior through injected adapters until Worker 21, artifact `consuelo-os-distribution-windows-<run-id>` |
| Linux | job `native-runtime` / `linux`, runner `ubuntu-24.04`; later Worker 20 expands distro coverage without removing this baseline |
| Cloudflare integration | GitHub environment `consuelo-os-dev`; reserved `consuelo-os-dist-test-<run-id>` resources; secret `CLOUDFLARE_OS_TEST_API_TOKEN`; six-hour maximum TTL; Worker 17 owns fail-safe live cleanup |
| Runtime-bundle fixtures | `packages/os/scripts/testing/distribution/`, server command `bun packages/os/scripts/testing/distribution/runtime-fixture-server.ts`, deterministic public fixture key, `SIGINT`/`SIGTERM` teardown |
| Product identities | `os-dist-account`, `os-dist-workspace`, `os-dist-node-dev`, `os-dist-node-canary`, and `os-dist-node-beta` |

Local Apple Container remains a fast optional loop; GitHub CI is mandatory. Worker 01 completed the shared harness. A worker whose required coordinate remains explicitly gated must stop at that gate rather than inventing another lane. The independent review procedure is already available through the existing OS subagent wrapper and is not a separately dispatched task.

## 12. Workstreams and dependency order

### Stream A: `stream/os-distribution`

1. Mandatory development/acceptance harness and clean-host environments.
2. Runtime-bundle builder and package boundary.
3. Tool-package and generated-manifest consolidation.
4. Automatic version assignment, signed channel manifests, immutable tags, GitHub Releases/Deployments, Cloudflare publication, and secondary protected promotion branches.
5. Lifecycle engine and OS CLI, including restart and notification preferences.
6. Retention, rollback, uninstall, and dev reset.
7. Managed-component provenance and deterministic update plan.
8. Steering skill/node/update integration and `decision.md` cleanup.
9. Legacy dialer/OS CLI split.
10. Distribution integration and release rehearsal.

The Grok/CodeRabbit review-evidence contract applies across all streams through `packages/os/scripts/subagent.ts` and `workers/27-grok-review-pipeline.md`; it is not another product workstream item.

### Stream B: `stream/os-provider-tools`

1. Effect provider core.
2. Generic Railway adapter.
3. Vercel adapter.
4. Customer Cloudflare adapter.
5. Manifest, discovery, approvals, and end-to-end integration.

### Stream C: `stream/os-web`

1. Authentication/session handoff contract.
2. Multi-node registry, signed presence, connector routing, and authenticated node management.
3. Universal login and workspace resolution.
4. Launcher and workspace `/gtm` routing.
5. Trace table/Hono integration.
6. Security and live end-to-end validation.

### Stream D: `stream/os-native`

1. Native app and platform research spike.
2. Swift menu-bar application.
3. macOS service integration.
4. Linux adapter and distribution.
5. Windows adapter and distribution.
6. Cross-platform release and recovery validation.

Stream B and Stream C may begin after the shared runtime-bundle/config boundaries are approved. Stream D may research immediately but integrates only after the lifecycle engine contract is stable.

### Stream E: `stream/repository-architecture`

This is a downstream, separately promoted stream. It may audit immediately but must not destabilize launch-critical OS work.

1. Inventory product boundaries, Twenty inheritance, package ownership, licenses, branding, package-manager use, generated files, and deployed-source references.
2. Decide monorepo reorganization versus OS repository extraction using measured dependency data.
3. Define the `consuelo` and `consuelo-dialer` package/repository boundary.
4. If separately approved, scaffold an OS repository from the proven runtime-bundle/package boundary without losing history or duplicating source authority.
5. Plan the broader Twenty-name cleanup, GTM product grouping, root documentation/legal correction, and Yarn-to-Bun migration as bounded follow-up programs.

## 13. Worker rules

Every worker must:

1. Bootstrap exactly once with `os.get_steering()` and read its full response.
2. Use `os.call` for repository/task work when the manifest provides the operation. Pass the task session on every task-scoped call.
3. Never silently fall back to the old workspace connector, another computer, native git, or unscoped shell after an OS error. Record the OS error and stop or use only an explicitly approved bounded fallback.
4. Read this entire plan and the assigned worker brief before inspecting or editing code.
5. Read repository steering and `packages/os/skills/senior-engineer/SKILL.md`; task workers also read `packages/os/skills/task/SKILL.md`.
6. Start/recover an isolated task session from the assigned stream and record the exact base SHA, task session, node, and OS trace IDs.
7. Verify all stated current-code assumptions and reconcile any deployed hot fix relevant to the task.
8. Add failing behavioral tests before implementation.
9. Treat existing tests as regression contracts. Add characterization coverage before moving code and change old assertions only for an explicit approved behavior change.
10. Use the mandatory shared clean-host environment where the prompt requires it.
11. Keep edits inside assigned ownership unless the prompt explicitly allows integration files.
12. Avoid reverting other workers; the repo may be changing concurrently.
13. Use structured APIs and Effect patterns already present in OS.
14. Never hard-code Ko's account, internal workspace, repository, machine, provider project, service, zone, or test hostname.
15. Never print or persist secrets in tests, logs, workpads, PRs, review prompts, or diagnostics.
16. Run focused tests, then broader OS gates.
17. Push a task PR but do not merge unless the orchestrator explicitly authorizes it.
18. Request CodeRabbit review when available and wait for actionable findings. Rate limiting is not a reason to skip the independent review lane.
19. Render `workers/grok-review-template.md` to the Git-ignored `packages/os/.tmp-reviews/<task>/grok-prompt.md` inside the task worktree and invoke the existing `packages/os/scripts/subagent.ts` wrapper with Grok 4.5, read policy, the exact task session, and workspace-first routing. Read policy must map to Grok `--permission-mode auto` with bounded turns, memory/subagents disabled, and explicit denies for built-in edit, write, and shell tools so workspace MCP reads remain executable. The wrapper must fail closed on cancelled, incomplete, or empty output. This preserves the subagent instruction-path boundary without claiming unsupported strict routing. Do not create a new product review tool.
20. Include the full master plan, assigned brief, PR/diff, existing reviews, workspace review, tests/CI, task context, nearby patterns, and unavailable-context notes. Post every new inline finding, the structured review object, consolidated agent-fix prompt, and concise top-level PR comment to GitHub.
21. Verify each review finding against current code, fix valid findings, rerun validation, and post fixed/stale/skipped dispositions to the PR. GitHub is the durable source of truth; remove `packages/os/.tmp-reviews/<task>/` after posting.
22. If the assigned environment, OS/task route, model/authentication, GitHub path, or test lane is broken, fails, is unavailable, or mismatches the registry, stop and fix or realign that environment before continuing. Do not bypass the environment, silently change providers, or fall back to another computer.
23. End only after GitHub contains changed files, exact validation, review/dispositions, known limitations, blockers, and integration instructions.
24. Return a concise user-facing closeout with the PR URL and assigned stream, what changed, validation/review results, how the work advances the master plan, and any remaining blocker or follow-up. Implementation workers must not reply with only `done`. Only a standalone Grok review task may use a `done`-only closeout after its structured review is already durable on GitHub.

No worker agent may install, update, reset, restart, or uninstall Consuelo OS on Ko's Mac Mini or MacBook Air. The worker stops at a human checkpoint and gives Ko the exact command and expected result. Read-only observation after Ko acts is allowed when explicitly approved.

## 14. Completion gates

This initiative is not complete until:

- a clean machine can install from a channel runtime bundle;
- automatic version assignment creates one SemVer only when the OS runtime closure changes and is idempotent for retries;
- immutable tags, GitHub Releases, GitHub Deployments, and signed channel manifests agree on version, release fingerprint, and runtime-bundle digests;
- protected `canary`, `beta`, and `stable` branches exist as secondary promotion refs and can advance only through the promotion workflow using a runtime bundle already built from `main`;
- GitHub Release assets and Cloudflare-served bundle bytes match by digest;
- the mandatory clean-host/container matrix passes before Ko performs a real-machine install;
- an existing machine can update without repeating onboarding;
- `consuelo restart` safely restores only Consuelo-owned services;
- a failed update rolls back automatically;
- runtime retention leaves only current, previous, and pinned runtime bundles;
- uninstall removes Consuelo-owned services and files without deleting user-owned content unless explicitly requested;
- locally modified managed components are never silently overwritten;
- steering accurately reports current node, installed skills, and compact update count while excluding `decision.md`;
- update-notification off/snooze preferences prevent repeated steering notices;
- same-account installation creates a distinct member node, preserves the home/default node, reports presence, supports explicit routing, and never silently crosses computers;
- tool implementations and generated manifests have one canonical ownership model and `packages/os/tooling` no longer acts as a competing authority;
- `consuelo` owns OS lifecycle while `consuelo-dialer` preserves the existing sales/dialer CLI;
- Railway, Vercel, and Cloudflare tools operate against a user's own authenticated CLI context without Consuelo defaults;
- `os.consuelohq.com` resolves login to the authenticated workspace;
- workspace `/gtm` and traces remain protected and work per workspace;
- the Swift app exercises the same lifecycle engine as the CLI;
- Linux and Windows have validated native service/install paths;
- dev, canary, beta, and stable all point to verifiably identical promoted runtime-bundle bytes;
- release and rollback procedures are documented and rehearsed;
- every task has CodeRabbit disposition and a Grok 4.5 structured review recorded on GitHub with inline comments for new findings, one top-level PR comment, and verified dispositions;
- a final independent integration agent verifies every requirement in this plan against code and runtime evidence.

## 15. Out of scope unless separately approved

- Automatically deploying arbitrary open PRs to the active Mac Mini OS.
- Requiring Git or GitHub on customer machines.
- Syncing secrets or entire local databases between nodes.
- Replacing the existing logical workspace database with peer-authoritative databases.
- Electron.
- A broad Hono rewrite outside the routes needed by this plan.
- A full redesign of every existing OS tool before launch.
- An auth-administration dashboard beyond the runtime/session work required here.
- Renaming the GitHub repository, changing the company/legal name, replacing repository licenses, mass-renaming every Twenty package, or migrating the whole monorepo from Yarn to Bun before the repository-architecture audit is approved.
- Extracting OS to a separate repository before the runtime-bundle boundary, dependency graph, history strategy, release ownership, and shared-package policy are proven.
