# Managed components

Consuelo OS manages component provenance and update correctness independently of AI. The engine covers skills, tools, site templates, scripts, and job templates.

## Storage

Managed state lives under `$CONSUELO_HOME/components/`:

- `installed-skills.json`: selected immutable runtime skills plus legacy custom entries awaiting explicit migration.
- `installed-tools.json`: immutable runtime tool index plus legacy custom entries awaiting explicit migration.
- `provenance.json`: one stable record per managed component.
- `update-plan.json`: deterministic, content-free update decisions.
- `retention.json`: content-base references required by unresolved review work; Worker 05 consumes this handoff when pruning runtime releases.
- `content-bases/<sha256>.json`: content-addressed base, local, upstream, and reviewed merge trees used by explicit operations.

Bundled skills and tools execute from the active immutable runtime bundle. Fresh installs do not create editable bundled copies under hidden `skills/` or `tools/` directories. Existing hidden directories are preserved as legacy custom content; provisioning does not read, merge, move, or overwrite them.

## Identity and ownership

A component key is `<kind>:<stable-id>`. Kinds are `skill`, `tool`, `site-template`, `script`, and `job-template`.

Ownership is one of:

- `bundled-managed`: installed from an immutable runtime bundle and eligible for deterministic updates.
- `custom`: user-owned content that is preserved and never inferred to be bundled from a matching name.
- `detached`: formerly managed content excluded from future automatic updates.

## Provenance schema

`provenance.json` uses schema version 1 and stores:

- component kind and stable ID;
- ownership;
- source bundle ID, source version, and source path;
- base content hash/reference;
- current local and upstream hashes;
- install and update timestamps;
- resolution state;
- optional visible local path.

The update engine rejects duplicate identities, invalid IDs, path traversal, secret-bearing paths, token/private-key-like content, and content hash mismatches.

## Update plan

`update-plan.json` uses schema version 1, has a stable item order by component key, and never embeds component content. Each item has exactly one action:

| Action | Meaning | Automatic |
|---|---|---|
| `install` | New bundled component is indexed from the upstream bundle. | Yes |
| `update-clean` | Local content still matches base; upstream may replace it. | Yes, after live hash verification |
| `preserve-custom` | User-owned or locally modified content remains untouched. | No write |
| `merge-clean` | A real three-way comparison proved a conflict-free merged tree. | Yes, after live hash verification |
| `conflict` | Local and upstream edits overlap or cannot be proven safe. | No |
| `remove-upstream` | Upstream removed the component; modified local content requires review. | Only when review is not required |
| `detach` | Component remains local and is excluded from managed updates. | No write |
| `no-change` | Base, local, and upstream state are equivalent. | No write |

The comparison inputs are the retained base tree, the current local tree captured during planning, and the next runtime bundle's upstream tree. A clean merge is materialized only when the deterministic merge algorithm proves non-overlap. Conflicts retain all three content references for inspection.

## Apply and resolution safety

Every write boundary:

1. resolves the destination inside the explicit visible user root;
2. rejects symbolic links and unsupported filesystem entries;
3. re-hashes the live visible tree and compares it with the planned local hash;
4. writes a complete temporary tree;
5. atomically swaps the tree, removing stale files while preserving the old tree on failure.

The typed CLI supports plan inspection, safe automatic application, conflict inspection, accept-upstream, keep-local, reviewed merge application with expected hashes, detach, and restore-default to a new visible path. Restore never overwrites an existing destination.

## Lifecycle retention handoff

Worker 06 does not prune runtime releases. `retention.json` contains only sorted base references needed by items whose `requiresReview` field is true. Worker 05 must retain runtime/content bases represented by those references and may prune other releases according to its own current/previous/pinned/count/TTL rules.

## Settings and Worker 07 summary

Settings reads `installed-skills.json` first and falls back to the legacy `skills/skills.json` registry only for compatibility. Worker 07 should derive compact steering/status data from:

- selected skill IDs and legacy custom skill IDs from `installed-skills.json`;
- `update-plan.json.summary.total` and `summary.requiresReview`;
- the count of items whose action is not `no-change`;
- update-notification preferences from the lifecycle settings boundary.

Steering should expose counts and concise state only, not content bases, conflict bodies, secrets, or `decision.md`.

## Rehearsal checkpoint

This temporary-home command does not modify an installed Consuelo OS:

```bash
sandbox="$(mktemp -d)"
HOME="$sandbox/user" CONSUELO_HOME="$sandbox/os" bun --cwd packages/os -e \
  "import { provisionLocalOs } from './scripts/lib/install-state.ts'; provisionLocalOs({ mode: 'local', selectedSkills: ['task'] });"
bun --cwd packages/os managed-components -- inspect-plan --home "$sandbox/os" --json
```

Expected result: JSON with `ok: true`, schema version 1, `summary.requiresReview: 0`, and no editable bundled directory at `$sandbox/os/skills/task` or `$sandbox/os/tools/status`.
