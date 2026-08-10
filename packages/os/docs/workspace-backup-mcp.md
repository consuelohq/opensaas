# Workspace backup MCP

Status: **design note, not implemented.**

## Why this exists

OS is a single point of failure for agent access. When the node is down, misrouted, or mid-release,
every agent loses its tools at once — which is exactly what happened on 2026-07-29, when a stale
`defaultNodeId` made `os.consuelohq.com/mcp` return `503` and no agent could reach anything.

The workspace MCP predates OS and was the manual fallback: a separate bearer-authenticated endpoint
that ChatGPT could be pointed at directly. It was removed by the uninstall on 2026-07-29 and never
restored. Restoring it is worthwhile precisely because it fails independently of OS.

## Non-negotiable: it must not collide with OS

OS occupies `46321` (node) and `46320` (Caddy ingress). The workspace backup previously used `8960`,
which is also the legacy OS default and appears in `LEGACY_DEFAULT_PORT`.

Bind the backup to a **port drawn from the ephemeral range at install time and persisted**, not a
hardcoded constant:

- pick from `49152–65535`, which IANA reserves for dynamic use and no Consuelo component claims
- probe before binding and re-pick on conflict
- persist to the workspace config so a restart is stable — a backup that moves every boot is not a
  backup you can point a client at
- never fall back to `8960`, `46320`, or `46321`

The reason to be strict: the whole value of this service is that it survives an OS problem. A backup
that collides with the thing it is backing up is worse than none, because it fails at exactly the
moment it is needed and looks like an OS fault while doing it.

## Shape

```text
ChatGPT ──bearer──► workspace backup MCP ──► workspace tools
                    (own port, own service, own auth)

ChatGPT ──oauth───► os.consuelohq.com/mcp ──► node ──► OS tools
```

Two properties matter more than feature parity:

1. **Independent failure.** Separate process, separate launchd/systemd unit, separate port, separate
   credential. It must not import OS runtime state or read the OS home, or an OS problem takes it
   down too.
2. **Static bearer, not OAuth.** The OAuth path runs through the same authority that OS depends on.
   If that authority is the thing that is broken, an OAuth-gated backup is not a backup. A
   long-lived bearer stored in the OS credential store is the right trade here, scoped to read and
   call only.

## What it should not do

- No node routing, no `defaultNodeId`, no control-plane lookups. Every one of those is a dependency
  that can fail.
- No credential resolution. The broker is OS-side; the backup should surface tools that do not need
  secrets rather than duplicate custody.
- No release/update participation. It should be boring and rarely changed.

## Open questions

1. Does it serve the same tool manifest as OS, or a deliberately smaller safe subset? A smaller
   subset is easier to keep working but means the fallback is not a true fallback.
2. Where does its bearer live so it is reachable when OS is down? Storing it in the OS credential
   store is circular if the OS node is the thing that is broken.
3. Is it per-node or per-workspace? Per-node is simpler; per-workspace needs routing, which is the
   dependency this is meant to avoid.

Question 2 is the one to answer first — it decides whether this is genuinely independent or just
appears to be.
