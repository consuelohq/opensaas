import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { PhoneOff, DatabaseZap, Shuffle } from "lucide-react";

const problems = [
  {
    icon: PhoneOff,
    title: "your dialer wasn't built for volume",
    body: "insurance sales is a numbers game. generic dialers drop calls, flag as spam, and can't keep up with the pace your team needs.",
  },
  {
    icon: DatabaseZap,
    title: "your CRM collects dust",
    body: "it was built for managers to track, not reps to sell. so your team ignores it, data goes stale, and you're flying blind on pipeline.",
  },
  {
    icon: Shuffle,
    title: "your leads are scattered and decaying",
    body: "leads come in from ads, campaigns, referrals — and land in 5 different places. by the time your team gets to them, they've gone cold.",
  },
] as const;

export function ProblemSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      ref={ref}
      className="bg-(--color-fg) text-(--color-bg) py-20 sm:py-24"
    >
      <div className="mx-auto max-w-[1000px] px-6">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="mb-3 text-xs font-medium tracking-[0.1em] opacity-50"
        >
          THE PROBLEM
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="max-w-[560px] text-3xl font-bold tracking-tight sm:text-4xl"
        >
          the tools you're using weren't made for this.
        </motion.h2>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.15 * (i + 1) }}
              className="flex flex-col gap-3"
            >
              <p.icon className="h-5 w-5 opacity-40" strokeWidth={1.5} />
              <p className="text-[15px] font-medium">{p.title}</p>
              <p className="text-sm leading-relaxed opacity-60">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
