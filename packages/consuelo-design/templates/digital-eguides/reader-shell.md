# reader-shell

Apply this shell to every digital e-guide template.

## header

- Add a small, fixed top header outside `#smooth-wrapper`.
- Left side links to the design wiki at `/design-wiki` with text like `Design Wiki` or `All guides`.
- Right side can show the current template label and reading progress.
- Keep the header quiet: white/translucent background, Geist/Geist Mono, thin border, no decorative color dependency.

## smooth reader structure

Wrap the full scrollable guide body in the ScrollSmoother structure:

```html
<header class="reader-header" data-no-tap-scroll>
  <!-- fixed header content -->
</header>
<div id="smooth-wrapper">
  <main id="smooth-content">
    <!-- all e-guide article content and footer metadata -->
  </main>
</div>
```

Position fixed elements, including the header and any floating controls, outside `#smooth-wrapper` because ScrollSmoother transforms `#smooth-content`.

Always load and use GSAP, ScrollTrigger, ScrollToPlugin, and ScrollSmoother for this reader shell:

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollToPlugin.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollSmoother.min.js"></script>
```

Initialize ScrollSmoother before tap navigation. Use native scrolling with smoothing, not a fake custom scrollbar. Respect `prefers-reduced-motion` by keeping the GSAP/ScrollSmoother code path and setting smoothing durations to `0`.

Suggested smoother setup:

```js
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, ScrollSmoother);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const smoother = ScrollSmoother.create({
  wrapper: '#smooth-wrapper',
  content: '#smooth-content',
  smooth: reduceMotion ? 0 : 0.85,
  smoothTouch: reduceMotion ? 0 : 0.12,
  effects: false,
  normalizeScroll: false,
});
```

## tap-to-read navigation

Add invisible reading tap zones for mobile and tablet reading:

- Tapping the right half of the viewport scrolls down about 45vh.
- Tapping the left half of the viewport scrolls up about 45vh.
- Keep normal swipe scrolling intact; swipes should be smoothed by ScrollSmoother and should not trigger tap navigation.
- Do not trigger this when the tap starts on links, buttons, inputs, details/summary, code controls, or selectable interactive content.
- Use the same GSAP/ScrollSmoother motion layer as normal scroll. Tap navigation should call `smoother.scrollTo(...)` when ScrollSmoother exists, with a ScrollToPlugin fallback only if needed.
- Respect `prefers-reduced-motion` by using immediate movement while keeping the same code path.

Suggested tap implementation shape:

```js
const interactive = 'a,button,input,textarea,select,summary,details,[role="button"],[data-no-tap-scroll]';
let tapStart = null;

document.addEventListener('pointerdown', (event) => {
  if (event.target.closest(interactive)) {
    tapStart = null;
    return;
  }
  tapStart = { x: event.clientX, y: event.clientY, time: performance.now() };
}, { passive: true });

document.addEventListener('pointerup', (event) => {
  if (!tapStart || event.target.closest(interactive)) return;

  const dx = Math.abs(event.clientX - tapStart.x);
  const dy = Math.abs(event.clientY - tapStart.y);
  const elapsed = performance.now() - tapStart.time;
  tapStart = null;

  if (dx > 10 || dy > 10 || elapsed > 650) return;

  const direction = event.clientX > window.innerWidth / 2 ? 1 : -1;
  const y = window.scrollY + direction * Math.round(window.innerHeight * 0.45);

  if (smoother) {
    smoother.scrollTo(y, !reduceMotion);
    return;
  }

  gsap.to(window, { duration: reduceMotion ? 0 : 0.45, scrollTo: { y }, ease: 'power2.out' });
}, { passive: true });
```

Always use GSAP for this reader shell. Keep the rest of the artifact lightweight; the motion layer should be small, functional, and reader-first rather than decorative.

## footer metadata

Every guide must end with a compact metadata footer in small text. Include as many fields as are known:

- artifact title
- template: `research`, `spec`, or `plan`
- generated date/time
- published date/time when known
- source truth / source bundle / input docs when known
- Open Design project id or local artifact path when known
- design wiki link

Use the same restrained footer style as the Daily Deep Idea prototype: small text, muted gray, top border, and no marketing language.
