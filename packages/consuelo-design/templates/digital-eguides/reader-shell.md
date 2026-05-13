# reader-shell

Apply this shell to every digital e-guide template.

## header

- Add a small, fixed top header outside `#smooth-wrapper`.
- Left side links to the Consuelo Wiki at `/design-wiki` with text `Consuelo Wiki`.
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
  smooth: reduceMotion ? 0 : 0.60,
  smoothTouch: reduceMotion ? 0 : 0.28,
  effects: false,
  normalizeScroll: true,
});
```

Use a medium `smooth` value so scrolling feels polished without lagging behind the finger or wheel. Keep `smoothTouch` shorter than desktop smoothing because long touch smoothing can feel disconnected from the swipe.

## tap-to-read navigation

Add invisible reading tap zones for mobile and tablet reading:

- Tapping the right half of the viewport scrolls down  `70vh`.
- Tapping the left half of the viewport scrolls up about `70vh`.
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
- Consuelo Wiki link

Use the same restrained footer style as the Daily Deep Idea prototype: small text, muted gray, top border, and no marketing language.


## design system

The reader shell must follow `packages/consuelo-website/DESIGN.md`.

Do not define a separate visual theme here. Use the Consuelo design system for typography, spacing, cards, shadow-as-border treatment, focus states, labels, and color roles.

The reader shell owns behavior:
- fixed header
- `/design-wiki` Consuelo Wiki link
- GSAP ScrollSmoother
- tap-to-read navigation
- back-to-top affordance
- metadata footer

The design system owns appearance.

## resume reading

Always remember Ko’s last reading position.

Use `localStorage` to save the current scroll position or current section for this artifact. When Ko reopens the guide, show a quiet `Resume reading` chip near the top or bottom-right.

Behavior:

- Save progress while scrolling, throttled/debounced.
- Key storage by artifact path or slug so different guides do not conflict.
- Show the chip only when saved progress is meaningful, e.g. more than `25vh` down the page.
- Clicking the chip scrolls back to the saved position using the same GSAP/ScrollSmoother motion language.
- After clicking resume, hide the chip.
- Include a small dismiss/clear option if easy.
- Mark the chip with `data-no-tap-scroll`.
- Respect `prefers-reduced-motion`.

Suggested marker:


<button class="reader-resume" type="button" data-no-tap-scroll hidden>
  Resume reading
</button>

**Suggested implementation shape:**

const resumeButton = document.querySelector('.reader-resume');
const storageKey = `reader-progress:${location.pathname}`;
const minResumeY = Math.round(window.innerHeight * 0.25);

const saveProgress = gsap.utils.throttle
  ? gsap.utils.throttle(() => {
      localStorage.setItem(storageKey, String(Math.round(window.scrollY)));
    }, 500)
  : () => localStorage.setItem(storageKey, String(Math.round(window.scrollY)));

window.addEventListener('scroll', saveProgress, { passive: true });

const savedY = Number(localStorage.getItem(storageKey) || 0);
if (resumeButton && savedY > minResumeY) {
  resumeButton.hidden = false;
  gsap.fromTo(
    resumeButton,
    { autoAlpha: 0, y: 8 },
    { autoAlpha: 0.78, y: 0, duration: reduceMotion ? 0 : 0.28, ease: 'power2.out' }
  );

  resumeButton.addEventListener('click', () => {
    const y = clampScroll(savedY);

    if (smoother) {
      gsap.to(smoother, {
        scrollTop: y,
        duration: reduceMotion ? 0 : 0.95,
        ease: 'power3.inOut',
      });
    } else {
      gsap.to(window, {
        scrollTo: { y },
        duration: reduceMotion ? 0 : 0.95,
        ease: 'power3.inOut',
      });
    }

    gsap.to(resumeButton, {
      autoAlpha: 0,
      y: 8,
      duration: reduceMotion ? 0 : 0.2,
      ease: 'power2.out',
      onComplete: () => {
        resumeButton.hidden = true;
      },
    });
  });
}

## section completion rail

For long digital e-guides, add a quiet vertical section completion rail on the right side of the viewport.

The rail should show one small dot per major section. Dots fill as Ko scrolls past each section. This is orientation, not gamification.

Behavior:

- Place the rail fixed on the right side, vertically centered.
- Use one dot per major section or table-of-contents anchor.
- Current section dot should be slightly brighter/larger.
- Completed section dots should be filled.
- Future section dots should be muted/hollow.
- Clicking a dot scrolls to that section using GSAP/ScrollSmoother.
- Hide or simplify the rail on very small screens if it crowds the reader.
- Mark the rail with `data-no-tap-scroll`.
- Respect `prefers-reduced-motion`.

Suggested marker:


<nav class="reader-section-rail" data-no-tap-scroll aria-label="Section progress">
  <button type="button" data-section-target="hero" aria-label="Go to Hero"></button>
  <button type="button" data-section-target="source" aria-label="Go to Source"></button>
  <button type="button" data-section-target="walkthrough" aria-label="Go to Walkthrough"></button>
</nav>

**Suggested behavior:**
const rail = document.querySelector('.reader-section-rail');
const railDots = Array.from(document.querySelectorAll('.reader-section-rail [data-section-target]'));

railDots.forEach((dot) => {
  const id = dot.getAttribute('data-section-target');
  const section = id ? document.getElementById(id) : null;
  if (!section) return;

  dot.addEventListener('click', () => {
    const y = clampScroll(section.getBoundingClientRect().top + window.scrollY - 72);

    if (smoother) {
      gsap.to(smoother, {
        scrollTop: y,
        duration: reduceMotion ? 0 : 0.85,
        ease: 'power3.inOut',
      });
    } else {
      gsap.to(window, {
        scrollTo: { y },
        duration: reduceMotion ? 0 : 0.85,
        ease: 'power3.inOut',
      });
    }
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    end: 'bottom center',
    onEnter: () => setActiveRailDot(id),
    onEnterBack: () => setActiveRailDot(id),
  });
});

function setActiveRailDot(activeId) {
  let activeIndex = railDots.findIndex((dot) => dot.getAttribute('data-section-target') === activeId);

  railDots.forEach((dot, index) => {
    const isActive = index === activeIndex;
    const isComplete = index < activeIndex;

    dot.toggleAttribute('data-active', isActive);
    dot.toggleAttribute('data-complete', isComplete);

    gsap.to(dot, {
      scale: isActive ? 1.28 : 1,
      opacity: isActive || isComplete ? 0.9 : 0.34,
      duration: reduceMotion ? 0 : 0.2,
      ease: 'power2.out',
      overwrite: true,
    });
  });
}
- **Section completion rail**: a quiet vertical dot rail on the right side showing major-section progress and allowing quick jumps.
