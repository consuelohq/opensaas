"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

// ---- types ----
type Item = { title: string; desc: string; href: string; icon: string };
type Section = { label: string; items: Item[] };
type Cta = { label: string; links: { title: string; href: string }[] };

// ---- icons ----
const icons: Record<string, string> = {
  "power-dialer": "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z",
  "local-presence": "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
  "call-transfer": "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  "spam-shield": "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  "ai-crm": "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155",
  "on-call-coaching": "M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z",
  "ai-queue": "M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z",
  "script-mode": "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  "lead-disbursement": "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
  "post-sale-sequences": "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  "re-engagement-queues": "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182",
  "pipeline-nourishment": "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  "gohighlevel": "M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z",
  "google-extension": "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418",
  "ads-to-crm": "M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z",
  "chat-sdk": "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z",
  "help": "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
  "academy": "M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15v-3.75m0 0h-.008v.008H6.75v-.008zm0 0L12 8.25l5.25 3",
  "docs": "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5",
  "changelog": "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  "announcements": "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46",
  "blog": "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10",
  "about": "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
};

function ItemIcon({ name }: { name: string }) {
  const d = icons[name] || icons["help"];
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--color-border) bg-(--color-surface-1) text-(--color-muted)">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
    </span>
  );
}

// ---- data ----
const platform: { sections: Section[]; cta: Cta } = {
  sections: [
    {
      label: "SALES TOOLS",
      items: [
        { title: "Power Dialer", desc: "Multi-line dials, increased contact rate", href: "/product#dialer", icon: "power-dialer" },
        { title: "Local Presence", desc: "Call from local numbers everywhere", href: "/product#presence", icon: "local-presence" },
        { title: "Call Transfer", desc: "Warm and cold transfers without dropping", href: "/product#transfer", icon: "call-transfer" },
        { title: "Spam Shield", desc: "Protect your numbers and reputation", href: "/product#spam-shield", icon: "spam-shield" },
      ],
    },
    {
      label: "AI",
      items: [
        { title: "AI CRM", desc: "Talk to your CRM — tell it what to do", href: "/product#crm", icon: "ai-crm" },
        { title: "On-Call Coaching", desc: "Real-time whispers that increase time on call", href: "/product#coaching", icon: "on-call-coaching" },
        { title: "AI Queue", desc: "Automatically create and manage your call queue", href: "/product#queue", icon: "ai-queue" },
        { title: "Script Mode", desc: "Upload scripts for whisper training", href: "/product#scripts", icon: "script-mode" },
      ],
    },
    {
      label: "AUTOMATION",
      items: [
        { title: "Lead Disbursement", desc: "Distribute leads across your team instantly", href: "/product#leads", icon: "lead-disbursement" },
        { title: "Post-Sale Sequences", desc: "Auto follow-up at one week, one month, three months", href: "/product#sequences", icon: "post-sale-sequences" },
        { title: "Re-engagement Queues", desc: "Auto-queue old leads that didn't answer", href: "/product#reengagement", icon: "re-engagement-queues" },
        { title: "Pipeline Nourishment", desc: "Reduce chargebacks with automated nurture", href: "/product#pipeline", icon: "pipeline-nourishment" },
      ],
    },
    {
      label: "INTEGRATIONS",
      items: [
        { title: "GoHighLevel", desc: "Embedded GHL in your workflow", href: "/product#ghl", icon: "gohighlevel" },
        { title: "Google Extension", desc: "Consuelo everywhere you work in Chrome", href: "/product#chrome", icon: "google-extension" },
        { title: "Ads to CRM", desc: "Connect your ads platform straight to your CRM", href: "/product#ads", icon: "ads-to-crm" },
        { title: "Chat SDK", desc: "Extends to Discord, Slack, and Teams", href: "/product#chat", icon: "chat-sdk" },
      ],
    },
  ],
  cta: {
    label: "GET STARTED",
    links: [
      { title: "Book a demo", href: "/demo" },
      { title: "Start free trial", href: "/signup" },
      { title: "See mercury", href: "/mercury" },
    ],
  },
};

const resources: { sections: Section[] } = {
  sections: [
    {
      label: "HOW TO",
      items: [
        { title: "User Guide", desc: "Learn how to use Consuelo", href: "https://docs.consuelohq.com", icon: "academy" },
      ],
    },
    {
      label: "SUPPORT",
      items: [
        { title: "Help Center", desc: "Learn about Consuelo's features", href: "/help", icon: "help" },
      ],
    },
    {
      label: "DEVELOPERS",
      items: [
        { title: "Developer Docs", desc: "Build with the Consuelo API and SDK", href: "https://docs.consuelohq.com", icon: "docs" },
      ],
    },
    {
      label: "COMPANY",
      items: [
        { title: "Changelog", desc: "What's new in Consuelo", href: "/changelog", icon: "changelog" },
        { title: "Announcements", desc: "Latest news and updates", href: "/announcements", icon: "announcements" },
        { title: "Blog", desc: "Insights and stories", href: "/blog", icon: "blog" },
        { title: "About", desc: "Our mission and team", href: "/about", icon: "about" },
      ],
    },
  ],
};

// ---- main component ----
export default function Navbar() {
  const [active, setActive] = useState<"platform" | "resources" | null>(null);
  const [mobile, setMobile] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLElement>(null);

  const open = (key: "platform" | "resources") => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    setActive(key);
  };
  const close = () => {
    timeout.current = setTimeout(() => setActive(null), 120);
  };
  const stay = () => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <nav ref={ref} className="sticky top-0 z-50 border-b border-(--color-border) bg-(--color-bg)">
      <div className="flex h-[64px] items-center px-6">
        {/* left group: logo + mascot + nav links */}
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/images/logo/logo.svg" alt="Consuelo mascot" className="h-9 w-9 transition-[filter] duration-200 dark:invert" />
            <span className="text-[22px] font-bold tracking-tight text-(--color-fg)">Consuelo</span>
          </a>

          <div className="relative hidden items-center gap-0.5 md:flex" onMouseLeave={close}>
            <Trigger label="Platform" isOpen={active === "platform"} onEnter={() => open("platform")} onLeave={() => {}} onClick={() => setActive(active === "platform" ? null : "platform")} />
            <Trigger label="Resources" isOpen={active === "resources"} onEnter={() => open("resources")} onLeave={() => {}} onClick={() => setActive(active === "resources" ? null : "resources")} />
            <NavLink href="/customers">Customers</NavLink>
            <NavLink href="/mercury">Mercury</NavLink>

            {/* mega menu — drops right below triggers, same hover zone */}
            {active && (
              <div className="absolute left-0 top-full z-50 rounded-b-xl border border-(--color-border) bg-(--color-bg) pt-2 shadow-lg">
                {active === "platform" && <PlatformPanel />}
                {active === "resources" && <ResourcesPanel />}
              </div>
            )}
          </div>
        </div>

        {/* right group: auth buttons */}
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <a href="/signin" className="rounded-lg border border-(--color-border) px-4 py-[7px] text-[14px] font-medium text-(--color-fg) transition-colors hover:bg-(--color-surface-1)">Sign in</a>
          <a href="/signup" className="rounded-lg bg-(--color-fg) px-4 py-[7px] text-[14px] font-medium text-(--color-bg) transition-colors hover:opacity-80">Start for free</a>
        </div>

        <button onClick={() => setMobile(!mobile)} className="ml-auto p-2 md:hidden" aria-label="Toggle menu">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {mobile
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* mobile drawer */}
      {mobile && (
        <div className="border-t border-(--color-border) px-6 py-4 md:hidden">
          <MobileSection title="Platform" sections={platform.sections} />
          <MobileSection title="Resources" sections={resources.sections} />
          <a href="/customers" className="block py-2.5 text-[15px] font-medium">Customers</a>
          <a href="/mercury" className="block py-2.5 text-[15px] font-medium">Mercury</a>
          <div className="mt-3 flex flex-col gap-2">
            <a href="/signin" className="rounded-lg border border-(--color-border) py-2.5 text-center text-[14px] font-medium">Sign in</a>
            <a href="/signup" className="rounded-lg bg-(--color-fg) py-2.5 text-center text-[14px] font-medium text-(--color-bg)">Start for free</a>
          </div>
        </div>
      )}
    </nav>
  );
}

// ---- sub-components ----

function Trigger({ label, isOpen, onEnter, onLeave, onClick }: { label: string; isOpen: boolean; onEnter: () => void; onLeave: () => void; onClick: () => void }) {
  return (
    <button
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2 text-[15px] transition-colors ${isOpen ? "text-(--color-fg)" : "text-(--color-muted) hover:text-(--color-fg)"}`}
    >
      {label}
      <svg className={`h-[14px] w-[14px] transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className="px-3 py-2 text-[15px] text-(--color-muted) transition-colors hover:text-(--color-fg)">{children}</a>;
}

function PlatformPanel() {
  return (
    <div className="flex w-[900px] px-6 py-6">
      <div className="grid flex-1 grid-cols-2 gap-x-12 gap-y-6">
        {platform.sections.map((s) => (
          <div key={s.label}>
            <p className="mb-3 text-[11px] font-medium tracking-[0.08em] text-(--color-muted)">{s.label}</p>
            <div className="space-y-1">
              {s.items.map((item) => (
                <a key={item.href} href={item.href} className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-(--color-surface-1)">
                  <ItemIcon name={item.icon} />
                  <div className="pt-0.5">
                    <p className="text-[14px] font-medium leading-tight text-(--color-fg)">{item.title}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-(--color-muted)">{item.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="ml-8 w-[160px] shrink-0 border-l border-(--color-border) pl-8">
        <p className="mb-3 text-[11px] font-medium tracking-[0.08em] text-(--color-muted)">{platform.cta.label}</p>
        <div className="space-y-3">
          {platform.cta.links.map((l) => (
            <a key={l.href} href={l.href} className="block text-[14px] text-(--color-muted) transition-colors hover:text-(--color-fg)">{l.title}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourcesPanel() {
  const left = resources.sections.filter((s) => s.label !== "COMPANY");
  const right = resources.sections.find((s) => s.label === "COMPANY");
  return (
    <div className="flex w-[500px] px-6 py-6">
      <div className="flex-1 space-y-4">
        {left.map((s) => (
          <div key={s.label}>
            <p className="mb-2 text-[11px] font-medium tracking-[0.08em] text-(--color-muted)">{s.label}</p>
            <div className="space-y-1">
              {s.items.map((item) => (
                <a key={item.href} href={item.href} className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-(--color-surface-1)">
                  <ItemIcon name={item.icon} />
                  <div className="pt-0.5">
                    <p className="text-[14px] font-medium leading-tight text-(--color-fg)">{item.title}</p>
                    {item.desc && <p className="mt-0.5 text-[13px] leading-snug text-(--color-muted)">{item.desc}</p>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      {right && (
        <div className="ml-8 w-[160px] shrink-0 border-l border-(--color-border) pl-8">
          <p className="mb-3 text-[11px] font-medium tracking-[0.08em] text-(--color-muted)">{right.label}</p>
          <div className="space-y-3">
            {right.items.map((item) => (
              <a key={item.href} href={item.href} className="block text-[14px] text-(--color-muted) transition-colors hover:text-(--color-fg)">{item.title}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileSection({ title, sections }: { title: string; sections: Section[] }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center justify-between py-2.5 text-[15px] font-medium">
        {title}
        <svg className="h-4 w-4 text-(--color-muted) transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="pb-2 pl-2">
        {sections.map((s) => (
          <div key={s.label} className="mb-2">
            <p className="px-2 py-1 text-[11px] font-medium tracking-[0.08em] text-(--color-muted)">{s.label}</p>
            {s.items.map((item) => (
              <a key={item.href} href={item.href} className="block rounded-lg px-2 py-1.5 text-[14px] text-(--color-fg) hover:bg-(--color-surface-1)">{item.title}</a>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}
