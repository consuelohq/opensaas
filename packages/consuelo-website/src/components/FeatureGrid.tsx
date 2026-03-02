import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const features = [
  {
    label: "power dialer",
    title: "Placeholder headline for power dialer",
    description:
      "Placeholder description — dialers suck, too expensive, increasing talk time, getting in contact with leads.",
    link: "/features/power-dialer",
  },
  {
    label: "AI coaching",
    title: "Placeholder headline for AI coaching",
    description:
      "Placeholder description — feedback after calls, post call analytics, unused CRM.",
    link: "/features/ai-coaching",
  },
  {
    label: "automation",
    title: "Placeholder headline for automation",
    description:
      "Placeholder description — lead automation, dripped leads from campaigns, re-engagement, sharing leads.",
    link: "/features/automation",
  },
  {
    label: "integrations",
    title: "Placeholder headline for integrations",
    description:
      "Placeholder description — resold leads even on ads, CRM access, team management.",
    link: "/features/integrations",
  },
] as const;

function FeatureCard({
  feature,
  index,
  onInView,
}: {
  feature: (typeof features)[number];
  index: number;
  onInView: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-40% 0px -40% 0px" });
  const animateInView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (inView) onInView(index);
  }, [inView, index, onInView]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={animateInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="grid grid-cols-1 gap-8 border border-(--color-border) p-8 sm:grid-cols-[1fr_1.5fr] sm:p-10"
    >
      <div className="flex flex-col justify-center gap-4">
        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {feature.title}
        </h3>
        <p className="text-sm leading-relaxed text-(--color-muted) sm:text-base">
          {feature.description}
        </p>
        <a
          href={feature.link}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
        >
          Explore {feature.label} →
        </a>
      </div>

      {/* illustration placeholder */}
      <div className="flex items-center justify-center rounded-sm border border-(--color-border) bg-(--color-surface-1) p-12 sm:min-h-[280px]">
        <span className="text-xs tracking-wide text-(--color-muted)">
          illustration — {feature.label}
        </span>
      </div>
    </motion.div>
  );
}

export function FeatureGrid() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerInView = useInView(sectionRef, { once: true, margin: "-80px" });
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section ref={sectionRef} className="py-20 sm:py-28">
      <div className="mx-auto max-w-[1100px] px-6">
        {/* section header */}
        <div className="mb-6 flex items-center justify-between">
          <motion.p
            initial={{ opacity: 0 }}
            animate={headerInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="font-mono text-xs tracking-[0.1em] text-(--color-muted)"
          >
            [01] POWERFUL PLATFORM
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={headerInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="font-mono text-xs text-(--color-muted)"
          >
            / ITEM {activeIndex + 1} ⋮ {features.length}
          </motion.p>
        </div>

        {/* headline + subcopy */}
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="max-w-[700px] text-3xl font-bold tracking-tight sm:text-5xl"
        >
          Placeholder headline.{" "}
          <span className="text-(--color-muted)">
            Placeholder subcopy that describes the platform capabilities in one
            or two sentences.
          </span>
        </motion.h2>

        {/* feature cards */}
        <div className="mt-14 flex flex-col gap-6">
          {features.map((feature, i) => (
            <FeatureCard
              key={feature.label}
              feature={feature}
              index={i}
              onInView={setActiveIndex}
            />
          ))}
        </div>

        {/* bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          className="mt-16 text-center"
        >
          <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Start with a 14-day free trial of Pro.
          </h3>
          <a
            href="/signup"
            className="mt-6 inline-block border border-(--color-fg) bg-(--color-fg) px-7 py-3 text-sm font-medium text-(--color-bg) transition-opacity hover:opacity-80"
          >
            Start for free
          </a>
        </motion.div>
      </div>
    </section>
  );
}
