# fix blog homepage post links and featured posts

branch: `task/blog/fix-blog-homepage-post-links-and-featured-posts`
stream: `stream/blog`
pr: https://github.com/consuelohq/opensaas/pull/309
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


## acceptance criteria

- [x] Change the blog homepage `All Posts` CTA from `/blog/archives/` to `/blog/posts/`.
- [x] Limit homepage featured rendering to `SITE.postPerIndex` posts.
- [x] Keep only the four latest intended posts marked `featured: true`.
- [ ] Build the website.
- [ ] Promote, merge, deploy, and verify production.

## plan

1. Inspect blog index, posts route, archives route, and frontmatter patterns.
2. Update `/blog` CTA and featured/recent slicing.
3. Normalize featured flags so only the newest four posts are featured.
4. Build and deploy.

## key decisions

- Use `/blog/posts/` because `packages/consuelo-website/src/pages/blog/posts/[...page].astro` is the all-posts paginated route.
- Keep the featured frontmatter true only on the latest four posts: decision infrastructure, Wavv comparison, GHL embedded launch, and sales stack sprawl.
- Also slice `featuredPosts` to `SITE.postPerIndex` defensively so the homepage cannot overflow if future frontmatter drifts.

- `workspace review.run` timed out before returning a result; using passed website build and built HTML inspection as task-specific validation.

- `workspace review.run` timed out before returning a result; using passed website build and built HTML inspection as task-specific validation.
