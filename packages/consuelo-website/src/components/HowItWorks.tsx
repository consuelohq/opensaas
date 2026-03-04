import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  UserPlus,
  PhoneOutgoing,
  BrainCircuit,
  DatabaseZap,
  RotateCcw,
} from "lucide-react";

type NodeKind = "trigger" | "action";

type WorkflowStep = {
  icon: typeof UserPlus;
  label: string;
  description: string;
  kind: NodeKind;
};

const steps: WorkflowStep[] = [
  {
    icon: UserPlus,
    label: "New Lead",
    description: "Lead arrives from ads, referral, or import",
    kind: "trigger",
  },
  {
    icon: PhoneOutgoing,
    label: "Auto-Dial",
    description: "Power dialer with local presence connects instantly",
    kind: "action",
  },
  {
    icon: BrainCircuit,
    label: "AI Coaching",
    description: "Real-time whisper guidance during the call",
    kind: "action",
  },
  {
    icon: DatabaseZap,
    label: "Log to CRM",
    description: "Call outcome, notes, and score saved automatically",
    kind: "action",
  },
  {
    icon: RotateCcw,
    label: "Follow Up",
    description: "Re-engagement queue picks up where you left off",
    kind: "action",
  },
];

const BADGE_STYLES: Record<NodeKind, string> = {
  trigger:
    "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  action:
    "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

function WorkflowNode({
  step,
  index,
  inView,
}: {
  step: WorkflowStep;
  index: number;
  inView: boolean;
}) {
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: 0.12 * index }}
      className="relative flex items-start gap-3 rounded-xl border border-(--color-border) bg-(--color-surface-0) p-4 sm:flex-col sm:items-center sm:text-center sm:p-5"
      role="listitem"
      aria-label={`Step ${index + 1}: ${step.label} — ${step.description}`}
    >
      {/* icon */}
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--color-border)">
        <Icon className="h-5 w-5 text-(--color-muted)" strokeWidth={1.5} />
      </span>

      <div className="min-w-0">
        {/* badge + label */}
        <div className="flex items-center gap-2 sm:justify-center">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${BADGE_STYLES[step.kind]}`}
          >
            {step.kind}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-semibold">{step.label}</p>
        <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">
          {step.description}
        </p>
      </div>
    </motion.div>
  );
}

// animated dot that travels along the connector
function Connector({ index, inView }: { index: number; inView: boolean }) {
  return (
    <div
      className="relative hidden items-center sm:flex"
      aria-hidden="true"
    >
      {/* static line */}
      <div className="h-px w-8 bg-(--color-border) lg:w-12" />

      {/* animated dot */}
      {inView && (
        <motion.div
          className="absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-500"
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: [0, 32, 32], opacity: [0, 1, 0] }}
          transition={{
            duration: 1,
            delay: 0.8 + index * 0.6,
            repeat: Infinity,
            repeatDelay: steps.length * 0.6,
            ease: "easeInOut",
          }}
          style={{ boxShadow: "0 0 8px 2px rgba(59,130,246,0.5)" }}
        />
      )}
    </div>
  );
}

// vertical connector for mobile
function MobileConnector({
  index,
  inView,
}: {
  index: number;
  inView: boolean;
}) {
  return (
    <div
      className="relative flex justify-center sm:hidden"
      aria-hidden="true"
    >
      <div className="h-6 w-px bg-(--color-border)" />
      {inView && (
        <motion.div
          className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-blue-500"
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [0, 24, 24], opacity: [0, 1, 0] }}
          transition={{
            duration: 1,
            delay: 0.8 + index * 0.6,
            repeat: Infinity,
            repeatDelay: steps.length * 0.6,
            ease: "easeInOut",
          }}
          style={{ boxShadow: "0 0 8px 2px rgba(59,130,246,0.5)" }}
        />
      )}
    </div>
  );
}

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-20 sm:py-24">
      <div className="mx-auto max-w-[1100px] px-6">
        {/* header */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="mb-3 text-xs font-medium tracking-[0.1em] text-(--color-muted)"
        >
          HOW IT WORKS
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="max-w-[480px] text-3xl font-bold tracking-tight sm:text-4xl"
        >
          from lead to close, on autopilot.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="mt-3 max-w-[440px] text-sm text-(--color-muted)"
        >
          Every step connected. Every action automated. Your team just sells.
        </motion.p>

        {/* workflow — horizontal on desktop, vertical on mobile */}
        <div
          className="mt-12 flex flex-col items-stretch gap-0 sm:flex-row sm:items-center sm:gap-0"
          role="list"
          aria-label="Workflow steps"
        >
          {steps.map((step, i) => (
            <div
              key={step.label}
              className="contents"
            >
              <WorkflowNode step={step} index={i} inView={inView} />
              {i < steps.length - 1 && (
                <>
                  <Connector index={i} inView={inView} />
                  <MobileConnector index={i} inView={inView} />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
