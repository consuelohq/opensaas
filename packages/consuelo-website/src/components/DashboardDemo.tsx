import type { ReactElement } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  Users,
  Building2,
  Kanban,
  Phone,
  BarChart3,
  Settings,
  Circle,
  ArrowUpDown,
  Mic,
  Pause,
  PhoneOff,
  Hash,
  ArrowRightLeft,
  Sparkles,
  MapPin,
} from "lucide-react";

// --- types ---

type ViewId = "power-dialer" | "ai-crm" | "coaching" | "analytics";

type NavItem = {
  id: ViewId | string;
  label: string;
  icon: typeof Users;
  isView?: boolean;
};

// --- constants ---

const VIEWS: ViewId[] = ["power-dialer", "ai-crm", "coaching", "analytics"];

const VIEW_DURATION = 9000;
const IDLE_RESUME_MS = 5000;

const TAB_LABELS: Record<ViewId, string> = {
  "power-dialer": "Power Dialer",
  "ai-crm": "AI CRM",
  coaching: "Coaching",
  analytics: "Analytics",
};

const TAB_ICONS: Record<ViewId, typeof Phone> = {
  "power-dialer": Phone,
  "ai-crm": Users,
  coaching: Sparkles,
  analytics: BarChart3,
};

const NAV_ITEMS: NavItem[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "ai-crm", label: "Contacts", icon: Users, isView: true },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "pipeline", label: "Pipeline", icon: Kanban },
  { id: "power-dialer", label: "Dialer", icon: Phone, isView: true },
  { id: "coaching", label: "Coaching", icon: Sparkles, isView: true },
  { id: "analytics", label: "Analytics", icon: BarChart3, isView: true },
];

// --- mock data ---

const CONTACTS = [
  { name: "Maria Santos", company: "Santos Family Ins.", phone: "(512) 555-0147", status: "hot", lastActivity: "2m ago" },
  { name: "James Chen", company: "Pacific Auto Group", phone: "(415) 555-0832", status: "warm", lastActivity: "1h ago" },
  { name: "Sarah Mitchell", company: "Mitchell & Assoc.", phone: "(720) 555-0291", status: "hot", lastActivity: "5m ago" },
  { name: "David Park", company: "Westside Insurance", phone: "(213) 555-0463", status: "new", lastActivity: "3h ago" },
  { name: "Lisa Thompson", company: "Thompson Agency", phone: "(512) 555-0718", status: "warm", lastActivity: "30m ago" },
  { name: "Robert Kim", company: "Kim Financial", phone: "(650) 555-0194", status: "cold", lastActivity: "2d ago" },
  { name: "Amanda Rivera", company: "Rivera Group", phone: "(310) 555-0527", status: "hot", lastActivity: "15m ago" },
  { name: "Michael Brown", company: "Brown & Partners", phone: "(512) 555-0386", status: "new", lastActivity: "1d ago" },
  { name: "Jennifer Lee", company: "Lee Insurance Co.", phone: "(408) 555-0642", status: "warm", lastActivity: "4h ago" },
  { name: "Carlos Mendez", company: "Mendez Agency", phone: "(737) 555-0815", status: "hot", lastActivity: "8m ago" },
];

const ANALYTICS_METRICS = [
  { label: "Calls Today", value: 147, suffix: "", color: "#3b82f6" },
  { label: "Connect Rate", value: 34, suffix: "%", color: "#22c55e" },
  { label: "Avg Duration", value: 4.2, suffix: "m", color: "#a78bfa" },
  { label: "Deals Closed", value: 8, suffix: "", color: "#f59e0b" },
];

const CHART_DATA = [
  { label: "Mon", value: 82 },
  { label: "Tue", value: 95 },
  { label: "Wed", value: 147 },
  { label: "Thu", value: 120 },
  { label: "Fri", value: 88 },
];

const STATUS_COLORS: Record<string, string> = {
  hot: "#22c55e",
  warm: "#f59e0b",
  new: "#3b82f6",
  cold: "#666666",
};

const DIALER_CONTACT = {
  name: "Maria Santos",
  phone: "(512) 555-0147",
  company: "Santos Family Insurance",
  context: "Auto Insurance — Renewal",
  initials: "MS",
};

const QUEUE_CONTACTS = [
  { name: "James Chen", phone: "(415) 555-0832", status: "next" },
  { name: "Sarah Mitchell", phone: "(720) 555-0291", status: "queued" },
  { name: "David Park", phone: "(213) 555-0463", status: "queued" },
];

// --- sub-components ---

function Sidebar({
  activeView,
  onNavigate,
  progress,
}: {
  activeView: ViewId;
  onNavigate: (id: ViewId) => void;
  progress: number;
}) {
  return (
    <div className="flex w-[200px] shrink-0 flex-col border-r border-[#222] bg-[#0a0a0a] max-md:hidden">
      <div className="flex h-12 items-center gap-2 border-b border-[#222] px-3">
        <div className="flex h-6 w-6 items-center justify-center bg-[#e8e8e8] text-[10px] font-bold text-[#0a0a0a]">
          C
        </div>
        <span className="text-[13px] font-semibold text-[#e8e8e8]">
          Consuelo
        </span>
      </div>

      <nav className="flex-1 px-2 py-3" aria-label="Dashboard navigation">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeView;
            const isClickable = item.isView;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    if (isClickable) onNavigate(item.id as ViewId);
                  }}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] transition-colors ${
                    isActive
                      ? "bg-[rgba(255,255,255,0.06)] font-medium text-[#e8e8e8]"
                      : "text-[#999] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#ccc]"
                  } ${!isClickable ? "cursor-default opacity-60" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  tabIndex={isClickable ? 0 : -1}
                >
                  <item.icon size={16} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-3 pb-3">
        <div className="h-0.5 overflow-hidden bg-[#222]">
          <motion.div
            className="h-full bg-[#3b82f6]"
            style={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      <div className="border-t border-[#222] px-2 py-2">
        <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-[#666]">
          <Settings size={16} strokeWidth={1.8} />
          <span>Settings</span>
        </div>
      </div>
    </div>
  );
}

function TabBar({
  activeView,
  onNavigate,
}: {
  activeView: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  return (
    <div className="flex border-b border-[#222]" role="tablist" aria-label="Dashboard views">
      {VIEWS.map((v) => {
        const isActive = v === activeView;
        const Icon = TAB_ICONS[v];
        return (
          <button
            key={v}
            role="tab"
            aria-selected={isActive}
            onClick={() => onNavigate(v)}
            className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors ${
              isActive
                ? "border-b-2 border-dotted border-[#3b82f6] text-[#e8e8e8]"
                : "text-[#666] hover:text-[#999]"
            }`}
          >
            <Icon size={14} strokeWidth={1.8} />
            {TAB_LABELS[v]}
          </button>
        );
      })}
    </div>
  );
}

function MobileTabs({
  activeView,
  onNavigate,
}: {
  activeView: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  return (
    <div className="flex overflow-x-auto border-b border-[#222] md:hidden" role="tablist">
      {VIEWS.map((v) => {
        const isActive = v === activeView;
        const Icon = TAB_ICONS[v];
        return (
          <button
            key={v}
            role="tab"
            aria-selected={isActive}
            onClick={() => onNavigate(v)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "border-b-2 border-dotted border-[#3b82f6] text-[#e8e8e8]"
                : "text-[#666]"
            }`}
          >
            <Icon size={13} />
            <span>{TAB_LABELS[v]}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- views ---

function ContactsView() {
  const columns = ["Name", "Company", "Phone", "Status", "Last Activity"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]" role="grid">
        <thead>
          <tr className="border-b border-[#222] bg-[#0d0d0d]">
            <th className="w-8 px-3 py-2">
              <div className="h-3.5 w-3.5 border border-[#444]" />
            </th>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium text-[#999]">
                <span className="flex items-center gap-1">
                  {col}
                  <ArrowUpDown size={10} className="text-[#555]" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CONTACTS.map((c, i) => (
            <motion.tr
              key={c.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="border-b border-[#1a1a1a] transition-colors hover:bg-[rgba(255,255,255,0.02)]"
            >
              <td className="px-3 py-2">
                <div className="h-3.5 w-3.5 border border-[#333]" />
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#1a1a1a] text-[9px] font-medium text-[#999]">
                    {c.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span className="font-medium text-[#e8e8e8]">{c.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-[#999]">{c.company}</td>
              <td className="px-3 py-2 font-mono text-[12px] text-[#999]">{c.phone}</td>
              <td className="px-3 py-2">
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: STATUS_COLORS[c.status] }}
                >
                  <Circle size={6} fill="currentColor" />
                  {c.status}
                </span>
              </td>
              <td className="px-3 py-2 text-[#666]">{c.lastActivity}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DialerPanel() {
  return (
    <div className="flex h-full gap-4 p-4 max-sm:flex-col">
      {/* left: contact + call controls */}
      <div className="flex flex-1 flex-col">
        {/* active contact */}
        <div className="flex items-center gap-3 border-b border-[#222] pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#2a2a2a] text-xs font-semibold text-white">
            {DIALER_CONTACT.initials}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{DIALER_CONTACT.name}</p>
            <p className="text-xs text-[#999]">{DIALER_CONTACT.company}</p>
            <p className="text-xs text-[#666]">{DIALER_CONTACT.context}</p>
          </div>
        </div>

        {/* phone display */}
        <div className="py-3 text-center font-mono text-lg tabular-nums text-white">
          {DIALER_CONTACT.phone}
        </div>

        {/* local presence badge */}
        <div className="mx-auto mb-3 flex items-center gap-1.5 bg-[#1a2e1a] px-3 py-1.5">
          <MapPin size={12} className="text-[#22c55e]" />
          <span className="text-[11px] text-[#22c55e]">
            calling from (512) 555-1234 — local to Austin, TX
          </span>
        </div>

        {/* call controls */}
        <div className="flex items-center justify-center gap-3 py-3">
          {[
            { icon: Mic, label: "Mute" },
            { icon: Pause, label: "Hold" },
            { icon: Hash, label: "DTMF" },
            { icon: ArrowRightLeft, label: "Transfer" },
          ].map((ctrl) => (
            <div
              key={ctrl.label}
              className="flex flex-col items-center gap-1"
            >
              <div className="flex h-10 w-10 items-center justify-center bg-[#2a2a2a] text-[#999]">
                <ctrl.icon size={16} />
              </div>
              <span className="text-[9px] text-[#666]">{ctrl.label}</span>
            </div>
          ))}
        </div>

        {/* end call */}
        <div className="flex justify-center pt-2">
          <div className="flex h-10 w-10 items-center justify-center bg-[#dc2626]">
            <PhoneOff size={16} className="text-white" />
          </div>
        </div>

        {/* multi-line indicator */}
        <div className="mt-4 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-1.5">
              <motion.div
                className={`h-1.5 flex-1 ${i === 0 ? "bg-[#22c55e]" : "bg-[#333]"}`}
                animate={i === 0 ? { opacity: [1, 0.5, 1] } : {}}
                transition={i === 0 ? { duration: 1, repeat: Infinity } : {}}
              />
              <span className="text-[9px] text-[#666]">
                {i === 0 ? "active" : "queued"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* right: call queue */}
      <div className="w-[200px] border-l border-[#222] pl-4 max-sm:w-full max-sm:border-l-0 max-sm:border-t max-sm:pt-4 max-sm:pl-0">
        <p className="mb-3 text-[11px] font-medium text-[#999]">Call Queue</p>
        <div className="flex flex-col gap-2">
          {QUEUE_CONTACTS.map((q, i) => (
            <motion.div
              key={q.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2 border border-[#222] bg-[#0d0d0d] p-2"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#1a1a1a] text-[8px] font-medium text-[#999]">
                {q.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-[#e8e8e8]">{q.name}</p>
                <p className="text-[10px] text-[#666]">{q.phone}</p>
              </div>
              <span className={`ml-auto text-[9px] ${q.status === "next" ? "text-[#22c55e]" : "text-[#555]"}`}>
                {q.status}
              </span>
            </motion.div>
          ))}
        </div>

        {/* AI whisper */}
        <div className="mt-4 border border-[#2a1a4a] bg-[#1a1028] p-3">
          <div className="mb-1 flex items-center gap-1">
            <Sparkles size={10} className="text-[#a78bfa]" />
            <span className="text-[10px] font-medium text-[#a78bfa]">AI Coaching</span>
          </div>
          <p className="text-[10px] leading-relaxed text-[#8b7bb8]">
            Maria mentioned she&apos;s comparing rates. Try: &quot;I can pull up a side-by-side comparison right now.&quot;
          </p>
        </div>
      </div>
    </div>
  );
}

function AnimatedNumber({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    const animate = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Number((eased * value).toFixed(value % 1 === 0 ? 0 : 1)));
      if (p < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

function AnalyticsView() {
  const maxVal = Math.max(...CHART_DATA.map((d) => d.value));
  return (
    <div className="p-4">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ANALYTICS_METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="border border-[#222] bg-[#0d0d0d] p-3"
          >
            <p className="text-[11px] text-[#666]">{m.label}</p>
            <p
              className="mt-1 text-[22px] font-bold tabular-nums"
              style={{ color: m.color }}
            >
              <AnimatedNumber value={m.value} suffix={m.suffix} />
            </p>
          </motion.div>
        ))}
      </div>

      <div className="border border-[#222] bg-[#0d0d0d] p-4">
        <p className="mb-4 text-[12px] font-medium text-[#999]">Calls This Week</p>
        <div className="flex items-end gap-3" style={{ height: 120 }}>
          {CHART_DATA.map((d, i) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
              <motion.div
                className="w-full bg-[#3b82f6]"
                initial={{ height: 0 }}
                animate={{ height: `${(d.value / maxVal) * 100}%` }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
                style={{ minHeight: 4 }}
              />
              <span className="text-[10px] text-[#666]">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- view map ---

const VIEW_COMPONENTS: Record<ViewId, () => ReactElement> = {
  "power-dialer": DialerPanel,
  "ai-crm": ContactsView,
  coaching: DialerPanel,
  analytics: AnalyticsView,
};

// --- main component ---

export function DashboardDemo() {
  const [activeView, setActiveView] = useState<ViewId>("power-dialer");
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(Date.now());
  const reducedMotion = useReducedMotion();

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    if (resumeRef.current) clearTimeout(resumeRef.current);
  }, []);

  const advanceView = useCallback(() => {
    setActiveView((current) => {
      const idx = VIEWS.indexOf(current);
      return VIEWS[(idx + 1) % VIEWS.length];
    });
    setProgress(0);
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;

    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(advanceView, VIEW_DURATION);
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setProgress(Math.min(elapsed / VIEW_DURATION, 1));
    }, 50);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [activeView, paused, reducedMotion, advanceView]);

  const handleMouseEnter = useCallback(() => {
    setPaused(true);
    if (resumeRef.current) clearTimeout(resumeRef.current);
  }, []);

  const handleMouseLeave = useCallback(() => {
    resumeRef.current = setTimeout(() => {
      setPaused(false);
      startTimeRef.current = Date.now();
    }, IDLE_RESUME_MS);
  }, []);

  const handleNavigate = useCallback(
    (id: ViewId) => {
      clearTimers();
      setActiveView(id);
      setProgress(0);
      setPaused(true);
      resumeRef.current = setTimeout(() => {
        setPaused(false);
        startTimeRef.current = Date.now();
      }, IDLE_RESUME_MS);
    },
    [clearTimers],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const idx = VIEWS.indexOf(activeView);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        handleNavigate(VIEWS[(idx + 1) % VIEWS.length]);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        handleNavigate(VIEWS[(idx - 1 + VIEWS.length) % VIEWS.length]);
      }
    },
    [activeView, handleNavigate],
  );

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  const ViewComponent = VIEW_COMPONENTS[activeView];

  return (
    <div
      className="overflow-hidden border border-[#2a2a2a] bg-[#111] shadow-2xl shadow-black/40"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Interactive CRM dashboard demo — use arrow keys to navigate views"
      aria-roledescription="interactive demo"
    >
      <div className="flex">
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          progress={progress}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* mobile tabs */}
          <MobileTabs activeView={activeView} onNavigate={handleNavigate} />

          {/* desktop tab bar */}
          <div className="max-md:hidden">
            <TabBar activeView={activeView} onNavigate={handleNavigate} />
          </div>

          {/* content */}
          <div className="min-h-[460px] overflow-hidden max-sm:min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={reducedMotion ? {} : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? {} : { opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <ViewComponent />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* bottom hint */}
          <div className="border-t border-[#1a1a1a] px-4 py-1.5 text-center">
            <span className="text-[10px] text-[#444]">
              {paused ? "click a tab to explore · resumes automatically" : "hover to pause · click to navigate"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
