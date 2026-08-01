# fix managed cloud node enrollment so a fresh Linux node enrolls unattended

branch: `task/os/fix-managed-cloud-node-enrollment-so-a-fresh-linux-node-enrolls-unattended`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1751/fix-managed-cloud-node-enrollment-so-a-fresh-linux-node-enrolls-unattended
github pr: https://github.com/consuelohq/opensaas/pull/1751
started: 2026-08-01

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-01 00:55:39 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## discovery: four independent failures on a fresh Linux node

1. POLLER EXITS 0 MID-POLL (critical, blocks everyone). `managed-cloud-node-enroll.ts` ends with
   `main().catch(...)` fire-and-forget. The module body completes, the event loop empties, and bun
   exits 0 at ~8s with no output and no status write. Proven on cloud-1 with
   `process.on('beforeExit')`: the awaited shape polls past 25s, the fire-and-forget shape logs
   `beforeExit 0` then `exit 0` at 8s. Enrollment can never complete unless the operator authorizes
   within ~8 seconds.

2. PLACEHOLDER-OWNED KEY (critical, blocks every fresh cloud install). `lifecycle.ts install` runs
   first and seeds the unenrolled placeholder identity (`local-consuelo-os` / `local`), minting an
   encryption key under that owner. Enrollment then calls `ensureNodeEncryptionKey` with the real
   workspace and node and hits the owner-mismatch guard: `KeyOwnerMismatch`.
