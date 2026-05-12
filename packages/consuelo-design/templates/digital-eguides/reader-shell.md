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
<button class="reader-back-to-top" type="button" data-no-tap-scroll aria-label="Back to top">↑</button>
<div id="smooth-wrapper">
  <main id="smooth-content">
    <!-- all e-guide article content and footer metadata -->
  </main>
</div>
```

Position fixed elements, including the header, the back-to-top affordance, and any floating controls, outside `#smooth-wrapper` because ScrollSmoother transforms `#smooth-content`.

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
  smooth: reduceMotion ? 0 : 0.65,
  smoothTouch: reduceMotion ? 0 : 0.28,
  effects: false,
  normalizeScroll: true,
});
```

Use a medium `smooth` value so scrolling feels polished without lagging behind the finger or wheel. Keep `smoothTouch` shorter than desktop smoothing because long touch smoothing can feel disconnected from the swipe.

## tap-to-read navigation

Add invisible reading tap zones for mobile and tablet reading:

- Tapping the right half of the viewport scrolls down about `88vh`.
- Tapping the left half of the viewport scrolls up about `88vh`.
- Clamp the target to `0` and `ScrollTrigger.maxScroll(window)` so the reader never overshoots the document.
- Keep normal swipe scrolling intact; swipes should be smoothed by ScrollSmoother and should not trigger tap navigation.
- Do not trigger this when the tap starts on links, buttons, inputs, details/summary, code controls, or selectable interactive content.
- Use the same GSAP/ScrollSmoother motion layer as normal scroll.
- For tap navigation, animate `smoother.scrollTop` directly with `duration: 0.95` and `ease: 'power3.inOut'` so the reader sees the page move instead of feeling an abrupt jump.
- Respect `prefers-reduced-motion` by using immediate movement while keeping the same code path.

Suggested tap implementation shape:

```js
const interactive = 'a,button,input,textarea,select,summary,details,[role="button"],[data-no-tap-scroll]';
const getMaxScroll = () => ScrollTrigger.maxScroll(window);
const clampScroll = (value) => Math.max(0, Math.min(getMaxScroll(), value));
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
  const distance = Math.round(window.innerHeight * 0.88);
  const y = clampScroll(window.scrollY + direction * distance);

  if (smoother) {
    gsap.to(smoother, {
      scrollTop: y,
      duration: reduceMotion ? 0 : 0.95,
      ease: 'power3.inOut',
    });
    return;
  }

  gsap.to(window, { duration: reduceMotion ? 0 : 0.95, scrollTo: { y }, ease: 'power3.inOut' });
}, { passive: true });
```

Always use GSAP for this reader shell. Keep the rest of the artifact lightweight; the motion layer should be small, functional, and reader-first rather than decorative.

## back-to-top affordance

Add a subtle circular back-to-top button outside `#smooth-wrapper`:

- Place it in the bottom-right corner.
- Keep it transparent and quiet at rest, then slightly stronger on hover/focus.
- Hide it until the reader has scrolled past roughly `70vh`.
- Mark it with `data-no-tap-scroll` so it never triggers page-tap navigation.
- Use GSAP to fade/scale it in and out.
- On click, animate back to the top with the same motion language as tap navigation.

Suggested implementation shape:

```js
const backToTopButton = document.querySelector('.reader-back-to-top');
const setBackToTopVisible = (visible) => {
  if (!backToTopButton) return;
  backToTopButton.toggleAttribute('data-visible', visible);
  gsap.to(backToTopButton, {
    autoAlpha: visible ? 0.72 : 0,
    scale: visible ? 1 : 0.92,
    duration: reduceMotion ? 0 : 0.24,
    ease: 'power2.out',
    overwrite: true,
  });
};

ScrollTrigger.create({
  start: () => window.innerHeight * 0.7,
  end: 'max',
  onEnter: () => setBackToTopVisible(true),
  onLeaveBack: () => setBackToTopVisible(false),
});

backToTopButton?.addEventListener('click', () => {
  if (smoother) {
    gsap.to(smoother, { scrollTop: 0, duration: reduceMotion ? 0 : 1.05, ease: 'power3.inOut' });
    return;
  }
  gsap.to(window, { scrollTo: { y: 0 }, duration: reduceMotion ? 0 : 1.05, ease: 'power3.inOut' });
});
```

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


## design system

The reader shell must follow `packages/consuelo-website/DESIGN.md`.

Do not define a separate visual theme here. Use the Consuelo design system for typography, spacing, cards, shadow-as-border treatment, focus states, labels, and color roles.

The reader shell owns behavior:
- fixed header
- `/design-wiki` link
- GSAP ScrollSmoother
- tap-to-read navigation
- back-to-top affordance
- metadata footer

The design system owns appearance.

