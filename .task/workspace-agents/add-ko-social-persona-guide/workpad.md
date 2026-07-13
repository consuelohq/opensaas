# add ko social persona guide

branch: `task/workspace-agents/add-ko-social-persona-guide`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1365/add-ko-social-persona-guide
github pr: https://github.com/consuelohq/opensaas/pull/1365
started: 2026-07-04

## acceptance criteria

- [x] Create root `persona.md` as a reusable, skill-style operating manual for Ko's social persona.
- [x] Preserve the durable positioning: persona first, product second, invisible mechanics made visible, TikTok foundation carried into X.
- [x] Include practical rules future agents can follow for posts, replies, quote posts, media, topics, and product-adjacent framing.
- [x] Validate the Markdown for required anchors, balanced fences, and no em or en dashes.

## plan

1. Inspect existing repo docs and saved social strategy context.
2. Write `persona.md` at the repo root.
3. Inspect the diff and run lightweight Markdown validation.
4. Push the task branch for review.

## current status

- `persona.md` created and Markdown validation passed.

## files changed

- `persona.md`

## workspace-owned: files changed

- `persona.md`

## workspace-owned: activity log

- 2026-07-04 17:20:22 fs.write: `persona.md`

## workspace-owned: validation evidence

- 2026-07-04 17:24:36 `review.run`: passed — OK
- 2026-07-04 17:24:37 `review.run`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-04 17:20:22 write: `persona.md`
