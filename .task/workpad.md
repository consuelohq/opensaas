# fix decision infrastructure publish time

branch: `task/blog/fix-decision-infrastructure-publish-time`
stream: `stream/blog`
pr: https://github.com/consuelohq/opensaas/pull/301
started: 2026-05-04

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
bun run task:push -- --message "type(blog): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-04 05:27:28 patch lines 3-3: `packages/consuelo-website/src/content/blog/software-is-becoming-decision-infrastructure.md`

## implementation notes

- The post showed `19 hours ago` because `pubDatetime` was manually set to `2026-05-03T10:00:00Z` in the original draft.
- Updated `pubDatetime` to `2026-05-04T03:22:00Z`, matching the first published/merged window for the post.

## validation

- Read frontmatter before patch and confirmed the stale publish time.
- Patched only `packages/consuelo-website/src/content/blog/software-is-becoming-decision-infrastructure.md`.


## implementation notes

- The post showed `19 hours ago` because `pubDatetime` was manually set to `2026-05-03T10:00:00Z` in the original draft.
- Updated `pubDatetime` to `2026-05-04T03:22:00Z`, matching the first published/merged window for the post.

## validation

- Read frontmatter before patch and confirmed the stale publish time.
- Patched only `packages/consuelo-website/src/content/blog/software-is-becoming-decision-infrastructure.md`.
