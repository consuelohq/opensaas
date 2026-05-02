import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

export function playHeroBoot() {
  const root = document.querySelector("[data-motion-section=\"hero\"]");
  if (!root) return;

  const mm = gsap.matchMedia();

  mm.add(
    {
      reduceMotion: "(prefers-reduced-motion: reduce)",
      normalMotion: "(prefers-reduced-motion: no-preference)",
    },
    (context) => {
      const { reduceMotion } = context.conditions ?? {};

      if (reduceMotion) {
        gsap.set("[data-motion]", { clearProps: "all", autoAlpha: 1 });
        return;
      }

      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        // Set initial states to avoid FOUC
        gsap.set("[data-motion=\"header\"]", { autoAlpha: 0, y: -8 });
        gsap.set("[data-motion=\"hero-eyebrow\"]", { autoAlpha: 0, y: 10 });
        gsap.set("[data-motion=\"hero-copy\"]", { autoAlpha: 0, y: 15 });
        gsap.set("[data-motion=\"hero-tabs\"]", { autoAlpha: 0, scaleX: 0.95, transformOrigin: "left center" });
        gsap.set("[data-motion=\"hero-product-frame\"]", { autoAlpha: 0.72, y: 18, scale: 0.985 });

        let titleSplit: SplitText | null = null;
        const titleEl = document.querySelector("[data-motion=\"hero-title\"]");
        if (titleEl) {
          titleSplit = new SplitText(titleEl, { type: "lines" });
          gsap.set(titleSplit.lines, { autoAlpha: 0, yPercent: 105 });
        }

        // 0ms: header fades/slides in
        tl.to("[data-motion=\"header\"]", { autoAlpha: 1, y: 0, duration: 0.5 }, 0);

        // 80ms: eyebrow fades in
        tl.to("[data-motion=\"hero-eyebrow\"]", { autoAlpha: 1, y: 0, duration: 0.4 }, 0.08);

        // 140ms: hero headline split text
        if (titleSplit && titleSplit.lines.length > 0) {
          tl.to(titleSplit.lines, {
            autoAlpha: 1,
            yPercent: 0,
            duration: 0.55,
            stagger: 0.08
          }, 0.14);
        }

        // 280ms: subcopy reveals
        tl.to("[data-motion=\"hero-copy\"]", { autoAlpha: 1, y: 0, duration: 0.5 }, 0.28);

        // 380ms: tab border draws in
        tl.to("[data-motion=\"hero-tabs\"]", { autoAlpha: 1, scaleX: 1, duration: 0.4, ease: "power2.out" }, 0.38);

        // 460ms: product frame enters
        tl.to("[data-motion=\"hero-product-frame\"]", { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: "power2.out" }, 0.46);

        // 620ms: silver scanline (if implemented in CSS with a class, we could trigger it, or use GSAP to animate a generated element)
        const scanline = document.querySelector("[data-motion=\"hero-scanline\"]");
        if (scanline) {
          gsap.set(scanline, { autoAlpha: 0, y: "-10%" });
          tl.to(scanline, { autoAlpha: 0.5, duration: 0.1 }, 0.62)
            .to(scanline, { y: "110%", duration: 0.4, ease: "none" }, 0.62)
            .to(scanline, { autoAlpha: 0, duration: 0.1 }, 0.92);
        }

      }, root);

      document.addEventListener(
        "astro:before-swap",
        () => {
          ctx.revert();
        },
        { once: true }
      );
    }
  );
}

export const startHero = () => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      playHeroBoot();
    });
export const startHero = () => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      playHeroBoot();
    });
  });
};

export const setupBelowFoldScrollMotion = () => {
  const mm = gsap.matchMedia();
  mm.add(
    {
      reduceMotion: "(prefers-reduced-motion: reduce)",
      normalMotion: "(prefers-reduced-motion: no-preference)",
    },
    (context) => {
      const { reduceMotion } = context.conditions ?? {};
      if (reduceMotion) {
        gsap.set("[data-motion-reveal]", { clearProps: "all", autoAlpha: 1 });
        return;
      }
      gsap.set("[data-motion-reveal]", { autoAlpha: 0, y: 32 });
      ScrollTrigger.batch("[data-motion-reveal]", {
        start: "top 85%",
        once: true,
        onEnter: (elements) => {
          gsap.to(elements, {
            autoAlpha: 1,
            y: 0,
            duration: 0.45,
            stagger: 0.08,
            ease: "power2.out",
            overwrite: true,
          });
        },
      });
    }
  );
};

export const initMotion = () => {
  if ("fonts" in document) {
    document.fonts.ready.then(startHero);
  } else {
    startHero();
  }
  const scheduleScroll = window.requestIdleCallback ? window.requestIdleCallback : window.setTimeout;
  scheduleScroll(() => {
    setupBelowFoldScrollMotion();
  }, 900);
};