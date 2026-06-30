# Consuelo OS

Consuelo OS is an open-source gateway for AI agents. It connects ChatGPT and other MCP clients to a real workspace: local files, approved tools, scripts, sites, traces, artifacts, and cloud services.

The repository is named `opensaas` because it is the monorepo. The OS runtime lives in [`packages/os`](packages/os), and the workspace MCP server lives in [`packages/workspace`](packages/workspace).

## Install

Run the hosted installer on macOS:

```bash
curl -fsSL https://install.consuelohq.com/os | bash
```

For repo-local development, run the OS installer directly:

```bash
bun --cwd packages/os ./scripts/install.ts --yes
```

Dry run the installer before it writes files:

```bash
bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json
```

The installer prepares `CONSUELO_HOME`, local runtime folders, selected skills, tool metadata, and optional agent links. The hosted installer downloads the source into `~/.consuelo/source/opensaas` when it runs outside a checkout.

## What Consuelo OS does

Consuelo OS gives agents one safe way to work with your company systems.

Agents ask for steering, call typed tools, run scripts, create artifacts, and leave traces. Humans keep control through explicit approvals, workspace boundaries, and reviewable outputs.

The smallest useful loop is:

```text
get_steering -> call -> script -> result -> trace -> artifact
```

## Workspaces

A workspace is the boundary for a company, team, or project. It owns the context, tools, sites, artifacts, traces, and agent connections that belong together.

Local workspaces run on your machine. Cloud workspaces add hosted routing, shared storage, public site snapshots, and team visibility. The model stays portable: the same scripts, manifests, artifacts, and traces can move between local and cloud runtime surfaces.

## MCP and ChatGPT

Consuelo OS is designed for MCP clients. ChatGPT connects through the workspace MCP app, then uses two entrypoints:

```text
workspace.get_steering()
workspace.call({ tool, input, taskSession, timeout })
```

`get_steering` loads the operating context. `call` runs approved tools with typed inputs. Agents do not need a separate MCP tool for every operation. The gateway handles the routing and validation.

## Local and cloud

Local OS stores runtime state under `~/.consuelo/os` by default:

```text
~/.consuelo/os/
  consuelo.db
  artifacts/
  logs/
  runs/
  tmp/
```

SQLite records executions, approvals, artifact metadata, memory metadata, and health state. Raw artifact bytes stay in local artifact storage until a cloud artifact service publishes them.

Cloud OS uses hosted services for shared runtime surfaces. Cloudflare handles workspace hostname routing, WAF rules, Workers, D1 route records, R2 snapshots, and public site delivery. Caddy protects local gateway routes as a reverse proxy. This keeps the local machine powerful while letting selected surfaces become reachable from the cloud.

## Tools and scripts

Tools are the typed operations agents can call. Scripts are the implementation behind those tools.

A tool has a name, input schema, output shape, timeout, routing rule, and safety boundary. A script is the Bun, TypeScript, or shell entrypoint that does the work. The manifest connects the two.

Examples of tool families in this repo:

| Family | What it owns |
| --- | --- |
| Workspace | filesystem, git, GitHub, review, memory, task streams, worker orchestration |
| Sites | human and agent usable websites, GTM surfaces, public snapshots, route publishing |
| Office | docs, decks, guides, design artifacts, publishing workflows |
| Media | image, SVG, video, audio, overlays, captions, media export packages |
| Browser | browser checks, page inspection, screenshots, UI verification |
| GraphQL | app data access and human usable API workflows |

The workspace facade is the normal agent entrypoint:

```ts
await workspace.call({
  tool: "media.svg.convert",
  input: {
    input: "assets/logo.png",
    out: "artifacts/logo.svg",
    strategy: "both",
    traceEngine: "auto"
  },
  timeout: 120000
})
```

## Sites

Sites are first-class OS tools. They cover the GTM and product surfaces that humans can use directly and agents can update safely.

A site can be authored locally, stored as an artifact, published as a snapshot, and routed through Cloudflare. The local OS remains the authoring layer. The cloud layer receives immutable published output plus route metadata.

## Artifacts

Artifacts are tracked outputs. A file is bytes. An artifact is the record around those bytes: who created it, which tool or script produced it, what inputs were used, where it is stored, what version it is, and how to audit it later.

Artifacts make agent work reviewable. Reports, generated SVGs, media exports, site snapshots, decks, and data files can all become artifacts.

## Tracing

Every meaningful tool run should leave a trace. A trace records what ran, which workspace it belonged to, what inputs were accepted, what outputs were produced, and what failed.

Local tracing uses SQLite. Hosted surfaces can send selected events to cloud observability systems. The point is practical: when an agent changes something, a human should be able to find out what happened.

## Repo map

| Path | Purpose |
| --- | --- |
| [`packages/os`](packages/os) | Consuelo OS runtime, installer, tools, manifests, artifacts, media, sites, Cloudflare edge work |
| [`packages/workspace`](packages/workspace) | Workspace MCP server and typed facade used by ChatGPT and agents |
| [`packages/consuelo-docs`](packages/consuelo-docs) | Mintlify documentation site |
| [`packages/consuelo-website`](packages/consuelo-website) | Public website |
| [`packages/consuelo-design`](packages/consuelo-design) | Office and design workflow surface |
| [`packages/cli`](packages/cli) | Consuelo CLI package |

## Development

Install repo dependencies from the monorepo root:

```bash
corepack enable
yarn install
```

Run OS checks from the package root or through `--cwd`:

```bash
bun --cwd packages/os run doctor
bun --cwd packages/os run typecheck
bun --cwd packages/os test
```

Run workspace tooling from the monorepo root. Task worktrees do not have their own package install, so agents should use `workspace.call` or task-scoped scripts instead of running package commands inside a worktree.

## License

Consuelo OS is MIT licensed.
