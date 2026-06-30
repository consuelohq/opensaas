<p align="center">
  <img src="./packages/consuelo-website/public/logo.svg" width="104" alt="Consuelo" />
</p>

# Consuelo OS

Consuelo OS is an open-source gateway for AI agents. It connects ChatGPT and other MCP clients to a real workspace: the file system, approved tools, scripts, sites, traces, artifacts, and cloud services.

The OS runtime lives in [`packages/os`](packages/os).

## install

Run the hosted installer on macOS:

```bash
curl -fsSL https://install.consuelohq.com/os | bash
```

For repo-local development, run the OS installer directly:

```bash
bun --cwd packages/os ./scripts/install.ts --yes
```

The installer prepares `CONSUELO_HOME`, local runtime folders, selected skills, tool metadata, and optional agent links. When the hosted installer runs outside a checkout, it downloads the source into `~/.consuelo/source/opensaas`.

## what Consuelo OS does

Consuelo OS gives agents one controlled path into company work.

Agents ask for steering, call typed tools, run scripts, create artifacts, and leave traces. Humans keep control through approvals, workspace boundaries, and reviewable outputs.

The smallest useful loop is:

```text
get_steering -> call -> script -> result -> trace -> artifact
```

## workspaces

An OS workspace is the boundary for a company, team, or project. It owns the context, tools, sites, artifacts, traces, approvals, and agent connections that belong together.

Local workspaces run on your machine. Cloud workspaces add hosted routing, shared storage, public site snapshots, and team visibility. The model stays portable: the same scripts, manifests, artifacts, and traces can move between local and cloud runtime surfaces.

## MCP and ChatGPT

Consuelo OS is designed for MCP clients. ChatGPT connects to the OS gateway and uses a small portal:

```text
get_steering
call
```

`get_steering` loads the current operating context. `call` runs an approved tool with typed input. The agent does not need a separate MCP tool for every operation because the OS manifest describes the larger tool catalog.

## local and cloud

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

Cloud OS adds shared product surfaces. Published site snapshots and hosted connector routes can use Cloudflare Workers, D1 route records, R2 storage, cache, DNS, and WAF policy. This is the hosted routing layer.

## security

Security is a separate layer from hosted routing.

The OS security gateway uses generated Consuelo auth, scoped app and agent tokens, signed requests, replay resistance, route scopes, and audit records. The local install materializes generated security files under the OS home, including `security/generated/auth.json` and `security/generated/Caddyfile`.

Caddy is the local reverse proxy surface for the OS gateway. Cloudflare account provisioning is platform/admin work, not a requirement for public OS install. A user should be able to install OS without a Cloudflare account, Wrangler login, API token, account ID, zone ID, R2 authority, or D1 authority.

## tools, scripts, and manifests

Tools are callable capabilities. Scripts are executable implementation. Manifests describe what tools exist, their categories, their input and output shapes, and the runtime binding behind each tool.

The public tools docs start at [`packages/consuelo-docs/tools/overview.mdx`](packages/consuelo-docs/tools/overview.mdx). The OS tools overview lives at [`packages/consuelo-docs/os/tools/overview.mdx`](packages/consuelo-docs/os/tools/overview.mdx). The generated tool catalog is [`packages/os/TOOLS.md`](packages/os/TOOLS.md).

## tool categories and bundles

Tool categories are the way the full manifest groups the catalog for reference. Categories include filesystem, git, review, browser, sites, media, office, GraphQL, task lifecycle, stream, and tooling. Use the generated catalog for the current list because it is built from the manifest.

Tool bundles are different. A bundle is a selected set of tools plus just-in-time instructions for a workflow or runbook. A bundle narrows the catalog for the agent so it sees the tools and operating notes needed for that job.

## sites

Sites are OS tools for human-facing surfaces. They cover GTM pages, product pages, docs-style pages, internal pages, and public snapshots that agents can update safely.

A site can be authored locally, stored as an artifact, published as a snapshot, and routed through the hosted layer. The local OS remains the authoring layer. The cloud layer receives immutable published output plus route metadata.

## artifacts

Artifacts are tracked outputs. A file is bytes. An artifact is the record around those bytes: who created it, which tool or script produced it, what inputs were used, where it is stored, what version it is, and how to audit it later.

Reports, generated SVGs, media exports, site snapshots, decks, and data files can all become artifacts.

## tracing

Every meaningful tool run should leave a trace. A trace records what ran, which workspace it belonged to, what inputs were accepted, what outputs were produced, and what failed.

Local tracing uses SQLite. Hosted surfaces can send selected events to cloud observability systems. When an agent changes something, a human should be able to find out what happened.

## repo map

| Path | Purpose |
| --- | --- |
| [`packages/os`](packages/os) | Consuelo OS runtime, installer, local server, MCP gateway, security gateway, tools, manifests, artifacts, media, sites, and Cloudflare edge work |
| [`packages/consuelo-docs`](packages/consuelo-docs) | Mintlify documentation site |
| [`packages/consuelo-website`](packages/consuelo-website) | Public website and logo assets |
| [`packages/consuelo-design`](packages/consuelo-design) | Office and design workflow surface |
| [`packages/cli`](packages/cli) | Consuelo CLI package |

## development

Install repo dependencies from the monorepo root:

```bash
corepack enable
yarn install
```

Run OS checks through `packages/os`:

```bash
bun --cwd packages/os run doctor
bun --cwd packages/os run typecheck
bun --cwd packages/os test
```

## license

Consuelo OS is MIT licensed.
