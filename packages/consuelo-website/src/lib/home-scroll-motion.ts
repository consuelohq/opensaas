import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const getElement = (selector: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(selector);

export const bootHomeScrollMotion = (): void => {
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
    return;
  }

  const cleanups: (() => void)[] = [];

  const section = getElement('[data-motion-section="feature-preview"]');
  if (section) {
    const featureContext = gsap.context(() => {
      const artworks = section.querySelectorAll<HTMLElement>('[data-motion="feature-artwork"]');

      artworks.forEach((artwork) => {
        const frame = artwork.closest<HTMLElement>('.feature-preview__artwork');
        if (!frame) {
          return;
        }

        gsap.fromTo(
          artwork,
          { yPercent: 5 },
          {
            yPercent: -5,
            ease: 'none',
            scrollTrigger: {
              trigger: frame,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });
    }, section);

    cleanups.push(() => featureContext.revert());
  }

  ScrollTrigger.refresh();

  window.addEventListener(
    'pagehide',
    () => {
      cleanups.forEach((cleanup) => cleanup());
    },
    { once: true },
  );
};