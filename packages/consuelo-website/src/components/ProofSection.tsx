import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useRef, useEffect } from "react";
import { TrendingUp, Clock, Users } from "lucide-react";

const stats = [
  { icon: TrendingUp, value: 340, suffix: "%", label: "avg increase in contact rate" },
  { icon: Clock, value: 47, suffix: "%", label: "faster ramp time for new reps" },
  { icon: Users, value: 12000, suffix: "+", label: "calls powered daily" },
] as const;

const testimonials = [
  {
    quote: "we switched from five tools to one. reps actually use the CRM now because it's where the dialer lives.",
    name: "marcus t.",
    role: "sales director, shield insurance",
  },
  {
    quote: "the AI coaching cut our ramp time almost in half. new hires sound like veterans after two weeks.",
    name: "priya k.",
    role: "VP sales, apex financial",
  },
  {
    quote: "local presence alone paid for itself. our answer rate went from 8% to over 30%.",
    name: "james r.",
    role: "team lead, summit benefits",
  },
] as const;

function Counter({ value, suffix, inView }: { value: number; suffix: string; inView: boolean }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, value, { duration: 1.6, ease: "easeOut" });
    return controls.stop;
  }, [inView, count, value]);

  return (
    <span ref={ref}>
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

export function ProofSection() {
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
          BY THE NUMBERS
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="max-w-[560px] text-3xl font-bold tracking-tight sm:text-4xl"
        >
          teams that switch see results fast.
        </motion.h2>

        {/* stat counters */}
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.15 * (i + 1) }}
              className="flex flex-col gap-2"
            >
              <s.icon className="h-5 w-5 text-(--color-muted)" strokeWidth={1.5} />
              <p className="text-3xl font-bold tracking-tight sm:text-4xl">
                <Counter value={s.value} suffix={s.suffix} inView={inView} />
              </p>
              <p className="text-sm text-(--color-muted)">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* testimonials */}
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.blockquote
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.15 * (i + 1) + 0.3 }}
              className="flex flex-col justify-between rounded-xl border border-(--color-border) p-5"
            >
              <p className="text-sm leading-relaxed text-(--color-muted)">"{t.quote}"</p>
              <div className="mt-4">
                <p className="text-[13px] font-medium">{t.name}</p>
                <p className="text-[12px] text-(--color-muted)">{t.role}</p>
              </div>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
