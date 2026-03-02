import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Calculator, Check, ArrowRight } from "lucide-react";

// stack cost calculator — what teams currently pay for separate tools
const stackItems = [
  { label: "CRM", cost: 79, example: "Salesforce / HubSpot" },
  { label: "Dialer", cost: 95, example: "PhoneBurner / Kixie" },
  { label: "AI coaching", cost: 60, example: "Gong / Chorus" },
  { label: "Analytics", cost: 40, example: "Mixpanel / Amplitude" },
] as const;

const CONSUELO_PRICE = 20;

const tiers = [
  {
    name: "starter",
    price: "free",
    desc: "for solo reps getting started",
    features: ["1 seat", "power dialer", "CRM", "50 AI coaching minutes/mo"],
    cta: "start for free",
    href: "/signup",
    highlight: false,
  },
  {
    name: "growth",
    price: "$20",
    period: "/seat/mo",
    desc: "for teams that need to move fast",
    features: ["unlimited seats", "local presence", "AI coaching", "call transfer", "analytics", "priority support"],
    cta: "start free trial",
    href: "/signup?plan=growth",
    highlight: true,
  },
  {
    name: "enterprise",
    price: "custom",
    desc: "for orgs with compliance needs",
    features: ["everything in growth", "SSO / SAML", "custom integrations", "dedicated CSM", "SLA", "on-prem option"],
    cta: "talk to sales",
    href: "/demo",
    highlight: false,
  },
] as const;

function StackCalculator() {
  const [enabled, setEnabled] = useState<Record<number, boolean>>(
    Object.fromEntries(stackItems.map((_, i) => [i, true]))
  );

  const currentTotal = stackItems.reduce((sum, item, i) => (enabled[i] ? sum + item.cost : sum), 0);
  const savings = Math.max(0, currentTotal - CONSUELO_PRICE);

  return (
    <div className="rounded-xl border border-(--color-border) p-6">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-(--color-muted)" strokeWidth={1.5} />
        <p className="text-sm font-medium">what you're paying now</p>
      </div>

      <div className="space-y-3">
        {stackItems.map((item, i) => (
          <label key={item.label} className="flex cursor-pointer items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={enabled[i]}
                onChange={() => setEnabled((prev) => ({ ...prev, [i]: !prev[i] }))}
                className="h-4 w-4 rounded border-(--color-border) accent-(--color-fg)"
              />
              <div>
                <span className="text-sm">{item.label}</span>
                <span className="ml-2 text-xs text-(--color-muted)">{item.example}</span>
              </div>
            </div>
            <span className={`text-sm font-medium ${enabled[i] ? "" : "text-(--color-muted) line-through"}`}>
              ${item.cost}/mo
            </span>
          </label>
        ))}
      </div>

      <div className="mt-6 border-t border-(--color-border) pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-(--color-muted)">current stack</span>
          <span className="font-medium">${currentTotal}/seat/mo</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-(--color-muted)">consuelo</span>
          <span className="font-medium">${CONSUELO_PRICE}/seat/mo</span>
        </div>
        {savings > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-(--color-surface-1) px-3 py-2 text-sm">
            <span className="font-medium">you save</span>
            <span className="text-lg font-bold">${savings}/seat/mo</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PricingPreview() {
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
          PRICING
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="max-w-[560px] text-3xl font-bold tracking-tight sm:text-4xl"
        >
          replace your entire stack for $20/seat.
        </motion.h2>

        {/* calculator */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-10"
        >
          <StackCalculator />
        </motion.div>

        {/* tier cards */}
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.15 * (i + 1) + 0.3 }}
              className={`flex flex-col rounded-xl border p-6 ${
                tier.highlight
                  ? "border-(--color-fg) ring-1 ring-(--color-fg)"
                  : "border-(--color-border)"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-(--color-muted)">{tier.name}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold">{tier.price}</span>
                {"period" in tier && <span className="text-sm text-(--color-muted)">{tier.period}</span>}
              </div>
              <p className="mt-1 text-sm text-(--color-muted)">{tier.desc}</p>

              <ul className="mt-5 flex-1 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-muted)" strokeWidth={2} />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={tier.href}
                className={`mt-6 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  tier.highlight
                    ? "bg-(--color-fg) text-(--color-bg) hover:opacity-80"
                    : "border border-(--color-border) text-(--color-muted) hover:text-(--color-fg)"
                }`}
              >
                {tier.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
