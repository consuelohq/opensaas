# hero boot motion only

branch: `task/website/hero-boot-motion-only`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/322
started: 2026-05-05

## acceptance criteria

- [ ] Homepage hero has one coherent first-load boot sequence.
- [ ] Hero media remains normal HTML and does not wait on JS animation setup.
- [ ] First-paint states avoid flash-before-animation while no-JS content stays visible.
- [ ] Motion is limited to header, announcement, headline, copy, product/demo frames, and one optional scanline.
- [ ] No below-fold reveals, SVG draw, parallax, ScrollTrigger work, FAQ motion, or mobile drawer choreography.
- [ ] `prefers-reduced-motion: reduce` shows content immediately and skips choreography.
- [ ] Mobile layout and scrolling remain intact.
- [ ] `cd packages/consuelo-website && bun run build` passes.
- [ ] `workspace review.run` passes against `stream/website`.
- [ ] Website deploy runs and browser screenshots are captured.
- [ ] Stream review PR is created/refreshed for ko.

## plan

1. Add homepage-only early `data-hero-motion-ready` boot flag before header markup.
2. Add meaningful motion hooks to the header, hero announcement, title, copy, product frames, and scanline.
3. Add CSS initial states scoped to `html[data-hero-motion-ready=true]` so no-JS and reduced-motion remain readable.
4. Add a small GSAP module for one first-load timeline with double RAF, SplitText headline lines, product-frame entrance, scanline pass, cleanup, and reduced-motion guard.
5. Reread changed files, run build, review, deploy, capture browser screenshots, then push and promote.

## files changed

- pending

## key decisions

- Use a homepage-only HTML data attribute instead of a global layout-ready class so other launch pages cannot inherit hidden header states.
- Keep hero product media in existing `<picture><img src=...>` markup; animation affects only frame opacity/transform.
- Use SplitText only on the hero headline, with line-level reveal and completion cleanup.
- Skip loops and ScrollTrigger for this phase.

## notes for ko

- This PR is deliberately a taste/performance slice for the hero boot only.

## improvements noticed

- Existing launch header and hero scripts use direct DOM listeners; future cleanup can centralize launch-page interactivity after motion taste is approved.

## errors i ran into

- Decision engine confidence is polluted by stale prior verification evidence; implementation path is based on explicit file reads and required validation gates.

---

## publish checklist

```bash
bun run task:push -- --message "feat(website): add hero boot motion" --changed
bun run task:pr
bun run task:finish
```

## wait log

Wait reason: Cloudflare Pages deployment URL is returning HTTP 200 but older HTML while the task worktree dist has heroMotionReady.
Duration: 15s polling interval, 4 attempts max.
Resume action: curl deployment URL and grep for heroMotionReady.
Expected signal: HTTP 200 plus heroMotionReady present in remote HTML.
Fallback: Document timeout and continue with local build/review evidence plus deploy URL.
