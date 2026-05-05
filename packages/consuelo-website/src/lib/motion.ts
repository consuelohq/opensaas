import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const HERO_READY_ATTRIBUTE = 'heroMotionReady';

const waitForNextPaint = (): Promise<void> =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

const waitForFonts = (): Promise<void> => {
  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, 360);
  });

  if (!document.fonts) {
    return timeout;
  }

  return Promise.race([document.fonts.ready.then(() => undefined), timeout]);
};

const getElement = (selector: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(selector);

const getElements = (selector: string): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(selector));

const revealImmediately = (elements: HTMLElement[]): void => {
  gsap.set(elements, {
    autoAlpha: 1,
    clearProps: 'opacity,visibility,transform,willChange',
    scale: 1,
    y: 0,
  });
};

const releaseHeroMotionGate = (): void => {
  delete document.documentElement.dataset[HERO_READY_ATTRIBUTE];
};

export const bootLaunchHeroMotion = (): void => {
  const isReady = document.documentElement.dataset[HERO_READY_ATTRIBUTE] === 'true';
  const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;

  if (!isReady || reduceMotion) {
    releaseHeroMotionGate();
    return;
  }

  const hero = getElement('[data-motion-section="hero"]');
  const header = getElement('[data-motion="hero-header"]');
  const eyebrow = getElement('[data-motion="hero-eyebrow"]');
  const title = getElement('[data-motion="hero-title"]');
  const copy = getElement('[data-motion="hero-copy"]');
  const productFrames = getElements('[data-motion="product-frame"]');
  const scanline = getElement('[data-motion="hero-scanline"]');

  const requiredElements = [hero, header, eyebrow, title, copy].filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );

  if (!hero || !header || !eyebrow || !title || !copy || productFrames.length === 0) {
    revealImmediately([...requiredElements, ...productFrames]);
    releaseHeroMotionGate();
    return;
  }

  void waitForNextPaint().then(() => {
    let split: ReturnType<typeof SplitText.create> | undefined;
    const activeAnimations: gsap.core.Animation[] = [];
    const context = gsap.context(() => {
      const frameTimeline = gsap.timeline({
        defaults: {
          ease: 'power3.out',
        },
        onComplete: () => {
          gsap.set([header, eyebrow, copy, ...productFrames], {
            clearProps: 'willChange',
          });
        },
      });

      frameTimeline
        .to(header, { autoAlpha: 1, y: 0, duration: 0.32 }, 0)
        .to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.34 }, 0.08)
        .to(productFrames, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.52,
          stagger: 0.07,
        }, 0.18)
        .to(copy, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.38);

      if (scanline) {
        frameTimeline
          .to(scanline, {
            autoAlpha: 0.46,
            xPercent: 340,
            duration: 0.72,
            ease: 'power2.inOut',
          }, 0.58)
          .to(scanline, {
            autoAlpha: 0,
            duration: 0.18,
            ease: 'power2.out',
          }, '>-0.1');
      }

      activeAnimations.push(frameTimeline);

      const revealTitle = async (): Promise<void> => {
        try {
          await waitForFonts();

          split = SplitText.create(title, {
            type: 'lines',
            linesClass: 'launch-title__line',
            aria: 'auto',
          });

          const titleLines = split.lines.filter(
            (line): line is HTMLElement => line instanceof HTMLElement,
          );
          const titleTargets = titleLines.length > 0 ? titleLines : [title];

          const titleTimeline = gsap.timeline({
            defaults: {
              ease: 'power3.out',
            },
            onComplete: () => {
              releaseHeroMotionGate();
              split?.revert();
              split = undefined;
              gsap.set(title, {
                clearProps: 'opacity,visibility,willChange',
              });
            },
          });

          titleTimeline
            .set(title, { autoAlpha: 1 })
            .fromTo(
              titleTargets,
              {
                autoAlpha: 0,
                yPercent: 105,
              },
              {
                autoAlpha: 1,
                yPercent: 0,
                duration: 0.58,
                stagger: 0.075,
              },
              0,
            );

          activeAnimations.push(titleTimeline);
        } catch {
          releaseHeroMotionGate();
          split?.revert();
          split = undefined;
          gsap.set(title, {
            autoAlpha: 1,
            clearProps: 'opacity,visibility,transform,willChange',
          });
        }
      };

      void revealTitle();
    }, document.body);

    window.addEventListener(
      'pagehide',
      () => {
        activeAnimations.forEach((animation) => animation.kill());
        split?.revert();
        context.revert();
      },
      { once: true },
    );
  }).catch(() => {
    revealImmediately([header, eyebrow, title, copy, ...productFrames]);
    releaseHeroMotionGate();
  });
};
