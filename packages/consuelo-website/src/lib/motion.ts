import gsap from 'gsap';
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText, ScrollTrigger);

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

export const bootHomeHeroMotion = (): void => {
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

export const bootProofSvgMotion = (): void => {
  const section = getElement('[data-motion-section="proof-svg"]');

  if (!section) {
    return;
  }

  const getOpacity = (element: Element, fallback: number): number => {
    const opacity = element.getAttribute('data-motion-opacity');

    if (!opacity) {
      return fallback;
    }

    const parsedOpacity = Number(opacity);

    return Number.isFinite(parsedOpacity) ? parsedOpacity : fallback;
  };

  const getLength = (element: SVGGeometryElement): number => {
    try {
      return element.getTotalLength();
    } catch (error: unknown) {
      void error;
      return 0;
    }
  };

  const getChartRoots = (): HTMLElement[] =>
    Array.from(section.querySelectorAll('.launch-stats__chart[data-motion="svg-grid"]')).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );

  const getChartPaths = (root: HTMLElement): SVGGeometryElement[] =>
    Array.from(root.querySelectorAll('[data-motion="svg-path"]')).filter(
      (element): element is SVGGeometryElement => element instanceof SVGGeometryElement,
    );

  const getChartBars = (root: HTMLElement): SVGRectElement[] =>
    Array.from(root.querySelectorAll('[data-motion="svg-bar"]')).filter(
      (element): element is SVGRectElement => element instanceof SVGRectElement,
    );

  const getChartSquares = (root: HTMLElement): SVGRectElement[] =>
    Array.from(root.querySelectorAll('[data-motion="svg-square"]')).filter(
      (element): element is SVGRectElement => element instanceof SVGRectElement,
    );

  const getHeatmapGrid = (root: HTMLElement): [number, number] => {
    const grid = root.querySelector('[data-motion-grid="heatmap"]');
    const rows = Number(grid?.getAttribute('data-motion-rows'));
    const columns = Number(grid?.getAttribute('data-motion-columns'));

    return [Number.isFinite(rows) ? rows : 18, Number.isFinite(columns) ? columns : 23];
  };

  const showChartRestingState = (root: HTMLElement): void => {
    const paths = getChartPaths(root);
    const bars = getChartBars(root);
    const squares = getChartSquares(root);

    paths.forEach((path) => {
      gsap.set(path, {
        opacity: getOpacity(path, 1),
        strokeDasharray: getLength(path),
        strokeDashoffset: 0,
        clearProps: 'willChange',
      });
    });

    bars.forEach((bar) => {
      gsap.set(bar, {
        opacity: getOpacity(bar, 1),
        scaleY: 1,
        transformOrigin: '50% 100%',
        clearProps: 'willChange',
      });
    });

    squares.forEach((square) => {
      gsap.set(square, {
        opacity: getOpacity(square, 0.1),
        scale: 1,
        transformOrigin: '50% 50%',
        clearProps: 'willChange',
      });
    });
  };

  const chartRoots = getChartRoots();

  if (chartRoots.length === 0) {
    return;
  }

  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
    chartRoots.forEach((root) => showChartRestingState(root));
    return;
  }

  const setup = (): void => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const cleanupCallbacks: (() => void)[] = [];

    chartRoots.forEach((root) => {
      const paths = getChartPaths(root);
      const bars = getChartBars(root);
      const squares = getChartSquares(root);

      if (paths.length === 0 && bars.length === 0 && squares.length === 0) {
        return;
      }

      let ambientTimeline: gsap.core.Timeline | null = null;
      let drawTimeline: gsap.core.Timeline | null = null;
      let trigger: ScrollTrigger | null = null;

      const context = gsap.context(() => {
        paths.forEach((path) => {
          const length = getLength(path);
          const restingOpacity = getOpacity(path, 1);

          gsap.set(path, {
            opacity: Math.max(0.02, restingOpacity * 0.12),
            strokeDasharray: length,
            strokeDashoffset: length,
            willChange: 'opacity, stroke-dashoffset',
          });
        });

        bars.forEach((bar) => {
          gsap.set(bar, {
            opacity: getOpacity(bar, 1),
            scaleY: 0.06,
            transformOrigin: '50% 100%',
            willChange: 'transform',
          });
        });

        squares.forEach((square) => {
          const restingOpacity = getOpacity(square, 0.1);

          gsap.set(square, {
            opacity: Math.max(0.01, restingOpacity * 0.12),
            scale: 0.42,
            transformOrigin: '50% 50%',
            willChange: 'opacity, transform',
          });
        });

        drawTimeline = gsap.timeline({
          defaults: {
            ease: 'power2.out',
          },
          onComplete: () => {
            gsap.set([...paths, ...bars, ...squares], {
              clearProps: 'willChange',
            });

            const ambientPathCount = Math.max(1, Math.ceil(paths.length * 0.1));
            const ambientBarCount = Math.max(1, Math.ceil(bars.length * 0.1));
            const ambientSquareCount = Math.max(1, Math.ceil(squares.length * 0.1));
            const ambientPaths = paths.slice(-ambientPathCount);
            const ambientBars = bars
              .filter((_, index) => index % 10 === 3)
              .slice(0, ambientBarCount);
            const ambientSquarePool = squares.filter((square) => getOpacity(square, 0.1) >= 0.4);
            const ambientSquares = ambientSquarePool
              .filter((_, index) => index % 4 === 1)
              .slice(0, ambientSquareCount);

            ambientTimeline = gsap.timeline({
              defaults: {
                ease: 'sine.inOut',
              },
              repeat: -1,
              repeatDelay: 2.4,
            });

            ambientPaths.forEach((path, index) => {
              const length = getLength(path);

              if (length <= 0) {
                return;
              }

              ambientTimeline
                ?.to(
                  path,
                  {
                    strokeDashoffset: length * 0.075,
                    duration: 0.34,
                  },
                  0.06 + index * 0.055,
                )
                .to(
                  path,
                  {
                    strokeDashoffset: 0,
                    duration: 0.52,
                  },
                  '>-0.08',
                );
            });

            if (ambientBars.length > 0) {
              ambientTimeline
                .to(
                  ambientBars,
                  {
                    scaleY: 0.93,
                    duration: 0.42,
                    stagger: {
                      each: 0.035,
                      from: 'end',
                    },
                  },
                  0.12,
                )
                .to(
                  ambientBars,
                  {
                    scaleY: 1,
                    duration: 0.5,
                    stagger: {
                      each: 0.03,
                      from: 'end',
                    },
                  },
                  '>-0.12',
                );
            }

            ambientSquares.forEach((square, index) => {
              const restingOpacity = getOpacity(square, 0.1);

              ambientTimeline
                ?.to(
                  square,
                  {
                    opacity: Math.min(0.92, restingOpacity + 0.18),
                    scale: 1.08,
                    duration: 0.22,
                  },
                  0.18 + index * 0.04,
                )
                .to(
                  square,
                  {
                    opacity: restingOpacity,
                    scale: 1,
                    duration: 0.46,
                  },
                  '>-0.02',
                );
            });
          },
          paused: true,
        });

        paths.forEach((path, index) => {
          drawTimeline?.to(
            path,
            {
              opacity: getOpacity(path, 1),
              strokeDashoffset: 0,
              duration: isMobile ? 0.72 : 1.05,
            },
            index * (isMobile ? 0.015 : 0.026),
          );
        });

        if (bars.length > 0) {
          drawTimeline.to(
            bars,
            {
              scaleY: 1,
              duration: isMobile ? 0.52 : 0.78,
              stagger: {
                each: isMobile ? 0.008 : 0.014,
                from: 'center',
              },
            },
            0,
          );
        }

        const dimSquares = squares.filter((square) => getOpacity(square, 0.1) <= 0.12);
        const midSquares = squares.filter((square) => {
          const restingOpacity = getOpacity(square, 0.1);
          return restingOpacity > 0.12 && restingOpacity < 0.6;
        });
        const brightSquares = squares.filter((square) => getOpacity(square, 0.1) >= 0.6);
        const heatmapGrid = getHeatmapGrid(root);
        const squareStagger = (each: number): gsap.StaggerVars => ({
          each,
          from: 'center',
          grid: heatmapGrid,
        });

        if (dimSquares.length > 0) {
          drawTimeline.to(
            dimSquares,
            {
              opacity: 0.1,
              scale: 1,
              duration: 0.42,
              ease: 'back.out(1.45)',
              stagger: squareStagger(isMobile ? 0.002 : 0.003),
            },
            0,
          );
        }

        if (midSquares.length > 0) {
          drawTimeline.to(
            midSquares,
            {
              opacity: 0.4,
              scale: 1,
              duration: 0.56,
              ease: 'back.out(1.35)',
              stagger: squareStagger(isMobile ? 0.003 : 0.004),
            },
            0.08,
          );
        }

        if (brightSquares.length > 0) {
          drawTimeline.to(
            brightSquares,
            {
              opacity: 0.8,
              scale: 1,
              duration: 0.62,
              ease: 'back.out(1.28)',
              stagger: squareStagger(isMobile ? 0.004 : 0.006),
            },
            0.14,
          );
        }

        trigger = ScrollTrigger.create({
          trigger: root,
          start: isMobile ? 'top 72%' : 'top 70%',
          once: true,
          onEnter: () => {
            drawTimeline?.play(0);
          },
        });
      }, root);

      cleanupCallbacks.push(() => {
        ambientTimeline?.kill();
        drawTimeline?.kill();
        trigger?.kill();
        context.revert();
      });
    });

    ScrollTrigger.refresh();

    window.addEventListener(
      'pagehide',
      () => {
        cleanupCallbacks.forEach((cleanup) => cleanup());
      },
      { once: true },
    );
  };

  type ProofIdleWindow = Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };

  window.setTimeout(() => {
    const idleWindow: ProofIdleWindow = window;

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(setup, { timeout: 900 });
      return;
    }

    window.requestAnimationFrame(() => setup());
  }, 720);
};
