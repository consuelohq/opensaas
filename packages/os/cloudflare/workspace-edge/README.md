# consuelo-workspace-edge

`consuelo-workspace-edge` is the Cloudflare edge gateway for workspace routes. It remains the single Worker for public workspace routing instead of adding a parallel Sites Worker.

## Routing model

D1 (`WORKSPACE_ROUTE_REGISTRY`) is the routing source of truth. The Worker resolves the hostname and path, then chooses one of two read paths:

1. `service-upstream` / `os-connector`: signed proxy behavior. This preserves the existing internal/app/OS connector routing model.
2. `site-snapshot`: static Sites snapshot behavior. Public reads hit Cloudflare Cache API first, then R2 (`SITES_SNAPSHOTS`) on miss. The user machine is not in the read path.

## Sites snapshot path

The intended public read flow for stable Sites pages such as `sites.consuelohq.com/` is:

```text
browser -> Cloudflare Worker -> Cache API HIT -> response
browser -> Cloudflare Worker -> D1 route -> R2 snapshot -> Cache API put -> response
```

Snapshot routes use `x-consuelo-edge-cache-authority: sites-snapshot` so the Worker only trusts cache entries that were produced by the Sites snapshot runtime.

## Why R2 first, not KV

R2 is the durable versioned bundle store for future OS user Sites. KV can still be added later as a small-object/pointer accelerator, but this Worker does not require a KV namespace to make the read path edge-owned. This keeps the first implementation aligned with the existing Cloudflare setup: one Worker, one D1 registry, one new R2 bucket, and Cache API.

## Publisher role

Local OS/cron jobs should render and publish immutable snapshots into R2, update the D1 route pointer, then warm and verify the public URL. They should not be the origin for normal public reads.
