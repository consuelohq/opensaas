# fix workspace review command

branch: `task/workspace-agents/fix-workspace-review-command`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/261
started: 2026-05-01

## acceptance criteria

- [ ] 

## plan

1. 

## files changed

- 

## key decisions

- 

## notes for ko

- 

## improvements noticed

- 

## errors i ran into

- 

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-01 07:32:01 write: `tmp/workspace-review-command-smoke.txt`
- 2026-05-01 08:08:25 patch lines 248-257: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-05-01 08:08:34 patch lines 563-563: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-05-01 08:08:39 patch lines 254-260: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-01 08:08:48 patch lines 253-267: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-01 08:09:00 patch lines 610-633: `packages/workspace/scripts/review.js`
- 2026-05-01 08:09:16 patch lines 600-657: `packages/workspace/scripts/review.js`
- 2026-05-01 08:09:24 patch lines 1539-1539: `packages/workspace/tooling/tool-manifest.json`
- 2026-05-01 08:09:38 patch lines 1574-1577: `packages/workspace/tooling/tool-manifest.json`
- 2026-05-01 08:10:46 patch lines 462-508: `AGENTS.md`
- 2026-05-01 08:10:56 patch lines 771-771: `AGENTS.md`
- 2026-05-01 08:11:03 patch lines 318-335: `packages/workspace/SCRIPTS.md`
- 2026-05-01 08:11:15 patch lines 317-318: `packages/workspace/SCRIPTS.md`
- 2026-05-01 08:11:34 patch lines 428-428: `packages/workspace/STEERING.md`
- 2026-05-01 08:11:39 patch lines 551-551: `packages/workspace/STEERING.md`
- 2026-05-01 08:11:54 patch lines 657-657: `packages/workspace/scripts/review.js`
- 2026-05-01 08:15:40 patch lines 461-462: `AGENTS.md`