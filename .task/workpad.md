# add gsap motion docs dependency

branch: `task/website/add-gsap-motion-docs-dependency`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/269
started: 2026-05-02

## acceptance criteria

- [x] `packages/consuelo-website/animations.md` is included in the website package.
- [x] `gsap` is added to the website package dependencies.
- [x] Website package lockfile is updated with only the GSAP dependency/package entry.
- [x] Website build passes.
- [ ] Workspace review passes or reports only pre-existing issues.

## plan

1. Copy Ko-created animation guide into the task branch.
2. Add `gsap` to `packages/consuelo-website` dependencies.
3. Keep lockfile diff scoped to GSAP only.
4. Run website build and workspace review.
5. Push task branch and refresh stream review PR.

## files changed

- `packages/consuelo-website/animations.md`
- `packages/consuelo-website/package.json`
- `packages/consuelo-website/bun.lock`

## key decisions

- This task is setup-only. It adds the animation guide and dependency without implementing animation code or adding motion hooks.
- `@gsap/react` was not added because the requested dependency was `gsap`; the guide documents the optional React helper for future React-island animation work.
- The initial `bun add` rewrote the lockfile heavily. Restored the stream lockfile and added only the GSAP package entry to keep the PR clean.

## notes for ko

- `bun add gsap` had to run scoped to `packages/consuelo-website`; running it at repo root fails because root workspaces include missing inherited package paths.

## improvements noticed

- The existing package manifest still has duplicate `@tailwindcss/typography` entries in dependencies and devDependencies. Bun warns about it, but this setup task leaves it unchanged.

## validation

- Passed: `packages/consuelo-website` build via task worktree.
- Workspace review through the facade did not complete cleanly in this environment: `review.run` hit active-task ambiguity from root, and a base-scoped review attempt timed out.

## errors i ran into

- Initial read of `packages/consuelo-website/animations.md` in the task branch failed because the file existed only in Ko’s main local worktree. Copied it into the task worktree.
- Initial root-level `bun add gsap` failed due inherited workspace package paths; scoped package install succeeded.

- 2026-05-02 02:48:57 write: `.task/workpad.md`