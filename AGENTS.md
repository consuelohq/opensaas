# Consuelo repository agent guidance

This repository contains Consuelo OS and standalone Consuelo service packages.

## Authoritative workflow

- Read and follow `packages/workspace/senior-engineer.md` for engineering work.
- Use the Consuelo OS/workspace facade and managed task sessions for repository
  mutation.
- Preserve parallel work. Do not force-push shared branches or delete another
  agent's worktree to simplify the graph.
- Start from current remote state and verify the exact pushed SHA before promotion.
- Add focused regression coverage for non-trivial behavior changes, then run the
  repository review and verify gates.

## Current product boundaries

- `packages/os`: Consuelo OS runtime, installer, tool gateway, security, tracing,
  artifacts, sites, and hosted-edge integration.
- `packages/cli`: Consuelo CLI and OS authentication flow.
- `packages/dialer`: provider-neutral dialer algorithm/runtime library.
- `packages/dialer-server`: standalone Bun/Hono service using PostgreSQL and Redis.
- `packages/lead-connector`: lead-provider integration boundary.
- `packages/workspace`: repository workflow, verification, task, and stream tools.
- `packages/documentation`: public documentation.
- `packages/consuelo-website`: public website.
- `packages/consuelo-design`: local design/artifact facade plus vendored Open
  Design source.

The inherited CRM application tree has been removed. Do not add dependencies,
commands, migrations, or deployment assumptions that require the deleted legacy
application.

## Runtime and data

PostgreSQL and Redis are the supported root infrastructure dependencies. The
standalone dialer server owns its runtime schema/bootstrap contracts. Root
development and production commands must not silently start a removed CRM server or
frontend.

## Authentication

Supported CLI authentication uses Consuelo OS OAuth. Do not restore the retired CRM
browser-auth or SDK login path for compatibility.

## Package manager

The root workspace is still on Yarn 4 during the migration sequence. Repository
scripts may use Bun explicitly. The package-manager cutover is tracked separately;
do not solve unrelated failures by restoring deleted legacy workspaces.

## Validation

Prefer the smallest focused command that proves the changed contract, then run:

```bash
bun run review -- --strict
bun run verify
```

Use the repository's task/stream workflow for publication and promotion. A local
commit alone is not shipped.

## Licensing

This repository is multi-license. Read `LICENSE` and `NOTICE` before changing
license metadata or vendored code. Never remove a package-local or upstream license
without proving the relevant provenance.
