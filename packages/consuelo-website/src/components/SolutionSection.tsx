import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Phone, BrainCircuit, Zap } from "lucide-react";
import { DashboardDemo } from "./DashboardDemo";

const pillars = [
  {
    icon: Phone,
    name: "connect",
    tagline: "get more people on the phone",
    points: [
      "power dialer with local presence — calls show a local number, answer rates go up",
      "multi-line dialing — work through lists faster without burning out",
      "spam shield — your numbers stay clean, your calls get answered",
    ],
    outcome: "increase contact rate by 3-5x",
  },
  {
    icon: BrainCircuit,
    name: "convert",
    tagline: "close more when you connect",
    points: [
      "AI coaching whispers in real-time — objection handling, script prompts, live guidance",
      "every call scored, every pattern surfaced — post-call analytics that actually get done",
      "script mode for training new reps — ramp time drops, consistency goes up",
    ],
    outcome: "more talk time, better calls, more sales",
  },
  {
    icon: Zap,
    name: "automate",
    tagline: "keep the pipeline moving without lifting a finger",
    points: [
      "AI queue management — leads get prioritized and distributed automatically",
      "re-engagement sequences — old leads get worked again at 1 week, 1 month, 3 months",
      "post-sale follow-up — reduce chargebacks, increase retention",
    ],
    outcome: "your pipeline never stops, even when your team clocks out",
  },
] as const;

export function SolutionSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-20 sm:py-24">
      <div className="mx-auto max-w-[1000px] px-6">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="mb-3 text-xs font-medium tracking-[0.1em] text-(--color-muted)"
        >
          THE SOLUTION
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="flex flex-wrap items-baseline gap-x-4 gap-y-2"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            built for how insurance teams actually sell.
          </h2>
          <span className="inline-flex items-center rounded-full border border-(--color-border) px-3 py-1 text-xs font-medium text-(--color-muted)">
            $20/seat · CRM included
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12"
        >
          <DashboardDemo />
        </motion.div>

        <div className="mt-16 grid gap-10 sm:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.15 * (i + 1) }}
            >
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border)">
                  <p.icon className="h-4 w-4 text-(--color-muted)" strokeWidth={1.5} />
                </span>
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {p.name}
                </span>
              </div>

              <p className="text-[15px] font-medium">{p.tagline}</p>

              <ul className="mt-3 space-y-2">
                {p.points.map((pt) => (
                  <li
                    key={pt}
                    className="text-sm leading-relaxed text-(--color-muted)"
                  >
                    {pt}
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-(--color-muted)">
                → {p.outcome}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
