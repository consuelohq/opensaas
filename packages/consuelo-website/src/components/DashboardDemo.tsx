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
  Bell,
  Plus,
  Filter,
  MoreHorizontal,
  ArrowUpDown,
  Circle,
} from "lucide-react";
import { DialerDemo } from "./DialerDemo";

// --- types ---

type ViewId = "contacts" | "pipeline" | "dialer" | "analytics";

type NavItem = {
  id: ViewId | string;
  label: string;
  icon: typeof Users;
  isView?: boolean;
};

// --- constants ---

const VIEWS: ViewId[] = ["contacts", "pipeline", "dialer", "analytics"];

const VIEW_DURATION: Record<ViewId, number> = {
  contacts: 9000,
  pipeline: 9000,
  dialer: 14000,
  analytics: 9000,
};

const IDLE_RESUME_MS = 5000;

const NAV_ITEMS: NavItem[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "contacts", label: "Contacts", icon: Users, isView: true },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "pipeline", label: "Pipeline", icon: Kanban, isView: true },
  { id: "dialer", label: "Dialer", icon: Phone, isView: true },
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

const PIPELINE_STAGES = [
  {
    name: "New Lead",
    color: "#3b82f6",
    deals: [
      { name: "Park Auto Bundle", company: "Westside Insurance", amount: "$4,200" },
      { name: "Brown Home Policy", company: "Brown & Partners", amount: "$2,800" },
      { name: "Kim Life Plan", company: "Kim Financial", amount: "$6,100" },
    ],
  },
  {
    name: "Qualified",
    color: "#f59e0b",
    deals: [
      { name: "Santos Renewal", company: "Santos Family Ins.", amount: "$3,400" },
      { name: "Thompson Fleet", company: "Thompson Agency", amount: "$12,500" },
      { name: "Lee Commercial", company: "Lee Insurance Co.", amount: "$8,900" },
    ],
  },
  {
    name: "Proposal",
    color: "#a78bfa",
    deals: [
      { name: "Chen Auto Package", company: "Pacific Auto Group", amount: "$7,600" },
      { name: "Rivera Bundle", company: "Rivera Group", amount: "$5,200" },
    ],
  },
  {
    name: "Closed Won",
    color: "#22c55e",
    deals: [
      { name: "Mitchell Home+Auto", company: "Mitchell & Assoc.", amount: "$9,800" },
      { name: "Mendez Commercial", company: "Mendez Agency", amount: "$15,400" },
    ],
  },
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
      {/* logo */}
      <div className="flex h-12 items-center gap-2 border-b border-[#222] px-3">
        <div className="flex h-6 w-6 items-center justify-center bg-[#e8e8e8] text-[10px] font-bold text-[#0a0a0a]">
          C
        </div>
        <span className="text-[13px] font-semibold text-[#e8e8e8]">
          Consuelo
        </span>
      </div>

      {/* nav items */}
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

      {/* progress bar */}
      <div className="px-3 pb-3">
        <div className="h-0.5 overflow-hidden bg-[#222]">
          <motion.div
            className="h-full bg-[#3b82f6]"
            style={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* bottom nav */}
      <div className="border-t border-[#222] px-2 py-2">
        <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-[#666]">
          <Settings size={16} strokeWidth={1.8} />
          <span>Settings</span>
        </div>
      </div>
    </div>
  );
}

function TopBar({ viewLabel }: { viewLabel: string }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-[#222] px-4">
      <div className="flex items-center gap-3">
        <h3 className="text-[14px] font-semibold text-[#e8e8e8]">
          {viewLabel}
        </h3>
        <span className="text-[12px] text-[#666]">
          {viewLabel === "Contacts" && `${CONTACTS.length} records`}
          {viewLabel === "Pipeline" && "4 stages"}
          {viewLabel === "Analytics" && "This week"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-7 items-center gap-1.5 border border-[#333] px-2 text-[12px] text-[#666]">
          <Filter size={12} />
          <span className="max-sm:hidden">Filter</span>
        </div>
        <div className="flex h-7 items-center gap-1.5 bg-[#3b82f6] px-2 text-[12px] font-medium text-white">
          <Plus size={12} />
          <span className="max-sm:hidden">New</span>
        </div>
        <div className="flex h-7 w-7 items-center justify-center text-[#666]">
          <Bell size={14} />
        </div>
      </div>
    </div>
  );
}

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
              <th
                key={col}
                className="px-3 py-2 font-medium text-[#999]"
              >
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
              <td className="px-3 py-2 font-mono text-[12px] text-[#999]">
                {c.phone}
              </td>
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

function PipelineView() {
  return (
    <div className="flex gap-3 overflow-x-auto p-4">
      {PIPELINE_STAGES.map((stage, si) => (
        <motion.div
          key={stage.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: si * 0.08 }}
          className="flex w-[200px] shrink-0 flex-col"
        >
          {/* column header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-[12px] font-medium text-[#e8e8e8]">
                {stage.name}
              </span>
              <span className="text-[11px] text-[#666]">
                {stage.deals.length}
              </span>
            </div>
            <MoreHorizontal size={14} className="text-[#555]" />
          </div>

          {/* cards */}
          <div className="flex flex-col gap-2">
            {stage.deals.map((deal, di) => (
              <motion.div
                key={deal.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: si * 0.08 + di * 0.04 }}
                className="border border-[#222] bg-[#0d0d0d] p-3 transition-colors hover:border-[#333]"
              >
                <p className="text-[12px] font-medium text-[#e8e8e8]">
                  {deal.name}
                </p>
                <p className="mt-1 text-[11px] text-[#666]">{deal.company}</p>
                <p
                  className="mt-2 text-[13px] font-semibold"
                  style={{ color: stage.color }}
                >
                  {deal.amount}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function DialerView() {
  return (
    <div className="flex items-start justify-center py-4">
      <DialerDemo />
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
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Number((eased * value).toFixed(value % 1 === 0 ? 0 : 1)));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
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
      {/* metrics row */}
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

      {/* bar chart */}
      <div className="border border-[#222] bg-[#0d0d0d] p-4">
        <p className="mb-4 text-[12px] font-medium text-[#999]">
          Calls This Week
        </p>
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

function MobileTabs({
  activeView,
  onNavigate,
}: {
  activeView: ViewId;
  onNavigate: (id: ViewId) => void;
}) {
  return (
    <div className="flex border-b border-[#222] md:hidden" role="tablist">
      {VIEWS.map((v) => {
        const item = NAV_ITEMS.find((n) => n.id === v);
        if (!item) return null;
        const isActive = v === activeView;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={isActive}
            onClick={() => onNavigate(v)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors ${
              isActive
                ? "border-b border-[#3b82f6] text-[#e8e8e8]"
                : "text-[#666]"
            }`}
          >
            <item.icon size={13} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- view map ---

const VIEW_COMPONENTS: Record<ViewId, () => JSX.Element> = {
  contacts: ContactsView,
  pipeline: PipelineView,
  dialer: DialerView,
  analytics: AnalyticsView,
};

const VIEW_LABELS: Record<ViewId, string> = {
  contacts: "Contacts",
  pipeline: "Pipeline",
  dialer: "Dialer",
  analytics: "Analytics",
};

// --- main component ---

export function DashboardDemo() {
  const [activeView, setActiveView] = useState<ViewId>("contacts");
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

  // auto-cycle
  useEffect(() => {
    if (paused || reducedMotion) return;

    const duration = VIEW_DURATION[activeView];
    startTimeRef.current = Date.now();

    timerRef.current = setTimeout(advanceView, duration);

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setProgress(Math.min(elapsed / duration, 1));
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
      // resume after idle
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
        {/* sidebar — desktop only */}
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          progress={progress}
        />

        {/* main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* mobile tabs */}
          <MobileTabs activeView={activeView} onNavigate={handleNavigate} />

          {/* top bar — desktop only */}
          <div className="max-md:hidden">
            <TopBar viewLabel={VIEW_LABELS[activeView]} />
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
              {paused ? "click a view to explore · resumes automatically" : "hover to pause · click to navigate"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
