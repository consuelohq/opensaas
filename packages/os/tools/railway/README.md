# Railway provider adapter

This package implements Railway deployment-provider capabilities on the shared
`packages/os/tools/deployment-provider` core. It is customer-agnostic: callers
must select services explicitly, and the adapter never reads Railway credential
files or calls private Railway APIs.

## Supported CLI contract

All provider execution uses the `railway` executable with an argv array. The
adapter currently accepts Railway CLI major versions 4 and 5.

| Capability | Railway CLI command |
| --- | --- |
| Detect CLI/version | `railway --version` |
| Authentication status | `railway whoami --json` |
| Current linked context | `railway status --json` |
| Projects | `railway list --json` |
| Services | `railway service status --all [--environment <value>] --json` |
| Deployments | `railway deployment list --service <value> [--environment <value>] --limit <n> --json` |
| Runtime logs | `railway logs [deployment] --service <value> [--environment <value>] --deployment --json --lines <n> ...` |
| Build logs | `railway logs [deployment] --service <value> [--environment <value>] --build --json --lines <n> ...` |
| Redeploy | `railway redeploy --service <value> --yes` |
| Variable names | `railway variables --service <value> [--environment <value>] --json` |
| Set variable | `railway variables --service <value> [--environment <value>] --set-from-stdin <name> [--skip-deploys]` |
| Delete variable | `railway variable delete <name> --service <value> [--environment <value>] --yes [--skip-deploys]` |

Variable values are discarded immediately after parsing. Set values are passed
through stdin and never appear in argv. Diagnostics for every variable operation
suppress command stdout and stderr so malformed provider output cannot expose a
secret through an error envelope.

## Compatibility and unsupported capabilities

- Railway CLI 4.x does not expose `variable delete`; an unknown-subcommand
  response is mapped to `UNSUPPORTED_CAPABILITY`. No token extraction or private
  GraphQL fallback is permitted.
- Structured network-flow and HTTP request logs are not exposed through a stable
  Railway CLI command, so `railway:logs --network` fails explicitly.
- Cross-project service selection is not supported by the linked-context CLI
  command. Link the desired project first with `railway link`.
- A generic new-deploy operation is not implemented. Worker 09 owns inspection,
  logs, redeploy, and environment-variable operations only.
- The package intentionally contributes no public tool definitions, handlers, or
  schemas yet. Worker 12 owns central manifest publication and should register
  `packages/os/tools/railway/manifest.ts`, then add provider-neutral public tool
  routes without changing this adapter's CLI or approval contracts.

## Compatibility entrypoints

The existing commands now route to this package:

```text
bun run railway:logs -- --service <name-or-id> [options]
bun run railway:redeploy -- --service <name-or-id> --yes [options]
```

Both commands support `--json` and `--quiet`. Redeploy can use `--wait` with a
bounded `--timeout`; logs support runtime/build selection, line bounds, Railway
filters, `--since`, `--until`, and `--latest`.

## Human live-validation checkpoint

Do not install, update, restart, reset, or uninstall Consuelo OS or Railway CLI
automatically on Ko's machines. A human with a disposable, already-linked
Railway project can run:

```text
bun run railway:logs -- --service <disposable-service> --lines 5 --json --quiet
bun run railway:redeploy -- --service <disposable-service> --yes --wait --timeout 10m --json --quiet
```

Expected result: the first command returns a bounded JSON log envelope; the
second returns the newly created deployment id and a terminal status without
selecting any other service. The redeploy command changes a remote resource and
must not be run without explicit human approval.
