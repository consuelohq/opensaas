import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const tabs = [
  { label: "Power Dialer", image: "/previews/power-dialer.webp" },
  { label: "AI CRM", image: "/previews/ai-crm.webp" },
  { label: "Coaching", image: "/previews/coaching.webp" },
  { label: "Analytics", image: "/previews/analytics.webp" },
] as const;

const proofPoints = [
  "Open Source",
  "No Contracts",
  "Free CRM Forever",
  "Local Presence",
  "AI Coaching",
];

const fade = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

export function Hero() {
  const [active, setActive] = useState(0);

  return (
    <section className="pt-24 pb-16">
      <div className="mx-auto max-w-[960px] px-6 text-center">
        {/* announcement pill */}
        <motion.a
          href="/changelog"
          variants={fade}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.4 }}
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-(--color-border) px-4 py-1.5 text-sm text-(--color-muted) transition-colors hover:border-(--color-muted)"
        >
          Open-source sales infrastructure
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </motion.a>

        {/* headline */}
        <motion.h1
          variants={fade}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.4, delay: 0.08 }}
          className="text-[1.75rem] font-bold leading-[1.08] tracking-tight text-balance sm:text-[2.5rem] md:text-[3rem] lg:text-[3.5rem]"
        >
          Telecommunication{" "}
          <span className="text-[#E2187D]">infrastructure</span> that
          integrates everywhere
        </motion.h1>

        {/* subcopy */}
        <motion.p
          variants={fade}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.4, delay: 0.16 }}
          className="mx-auto mt-5 max-w-[480px] text-base text-(--color-muted) sm:text-lg"
        >
          Dialers are overpriced. CRMs collect dust. Leads go cold. Consuelo connects your dialer, CRM, AI coaching, and lead automation — so nothing falls through the cracks.
        </motion.p>

        {/* ctas — square-ish buttons */}
        <motion.div
          variants={fade}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.4, delay: 0.24 }}
          className="mt-8 flex justify-center gap-3"
        >
          <a
            href="/signup"
            className="bg-(--color-fg) px-6 py-3 text-sm font-medium text-(--color-bg) transition-opacity hover:opacity-80"
          >
            Get Started Free
          </a>
          <a
            href="#how-it-works"
            className="border border-(--color-border) px-6 py-3 text-sm font-medium text-(--color-muted) transition-colors hover:text-(--color-fg)"
          >
            See How It Works
          </a>
        </motion.div>

        {/* social proof strip — between CTAs and preview */}
        <motion.div
          variants={fade}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.4, delay: 0.32 }}
          className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-(--color-muted)"
        >
          {proofPoints.map((point, i) => (
            <span key={point} className="flex items-center gap-2">
              {i > 0 && <span className="text-(--color-border)">·</span>}
              {point}
            </span>
          ))}
        </motion.div>
      </div>

      {/* tabbed product preview */}
      <motion.div
        variants={fade}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mx-auto mt-16 max-w-7xl px-6"
      >
        <div className="flex border-b border-(--color-border)">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActive(i)}
              className={`relative flex-1 py-3.5 text-sm font-medium transition-colors ${
                i === active ? "text-(--color-fg)" : "text-(--color-muted) hover:text-(--color-fg)"
              }`}
            >
              {tab.label}
              {i === active && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-(--color-fg)"
                />
              )}
            </button>
          ))}
        </div>

        <div className="relative mt-1 overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface-1) shadow-sm">
          <AnimatePresence mode="wait">
            <motion.img
              key={active}
              src={tabs[active].image}
              alt={tabs[active].label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="aspect-[16/9] w-full object-cover object-top"
            />
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  );
}
