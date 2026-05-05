# fix hero headline visibility after boot motion

branch: `task/website/fix-hero-headline-visibility-after-boot-motion`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/325
started: 2026-05-05

## acceptance criteria

- [x] Hero headline remains visible after the boot animation completes.
- [x] Missing/reduced-motion/fallback reveal paths release the same motion CSS gate.
- [ ] `cd packages/consuelo-website && bun run build` passes.
- [ ] `workspace review.run` passes against `stream/website`.
- [ ] Stream review PR is created/refreshed for ko.

## plan

1. Confirm the bug path in hero motion setup and CSS gate selectors.
2. Add one helper to release the hero motion-ready data attribute.
3. Release that gate before SplitText restores the title DOM and in fallback reveal paths.
4. Build/review, push the task branch, and promote into `stream/website`.

## files changed

- `packages/consuelo-website/src/lib/motion.ts`
- `.task/workpad.md`

## key decisions

- Keep the existing animation sequence and CSS selectors intact.
- Fix the root cleanup order by releasing `data-hero-motion-ready` before SplitText reverts the headline.
- Use the same gate-release helper for reduced-motion, missing-element, title-error, and outer fallback paths.

## notes for ko

- This is scoped to the disappearing headline regression after the hero boot motion.
- No visual timing changes were intentionally introduced.

## improvements noticed

- The previous task's CSS gate pattern needs this helper because SplitText restores normal DOM after the animation.

## errors i ran into

- Root standards reads for `AGENTS.md` / `CODING-STANDARDS.md` were blocked by tool safety checks in this session, so I relied on the loaded project steering and skill instructions.
- `workspace decideNext` was also blocked by tool safety checks after `workspace explore`; I continued with explicit file reads and targeted runtime evidence.

## publish checklist

```bash
bun run task:push -- --message "fix(website): keep hero headline visible after boot"
bun run task:pr
bun run task:finish
```
