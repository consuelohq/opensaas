import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Hash,
  ArrowRightLeft,
  Sparkles,
  MapPin,
  Delete,
} from "lucide-react";

// --- data ---

type DemoState = "idle" | "dialing" | "connected";

const DURATIONS: Record<DemoState, number> = {
  idle: 3000,
  dialing: 3000,
  connected: 6000,
};

const NEXT: Record<DemoState, DemoState> = {
  idle: "dialing",
  dialing: "connected",
  connected: "idle",
};

const DIAL_KEYS = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
] as const;

const WHISPER_TEXT =
  "Maria mentioned she's comparing rates. Try: \"I can pull up a side-by-side comparison right now — most clients save 15-20% when they see the full picture.\"";

const CONTACT = {
  name: "Maria Santos",
  phone: "(512) 555-0147",
  context: "Auto Insurance — Renewal",
  company: "Santos Family Insurance",
  initials: "MS",
};

const LOCAL_PRESENCE = {
  number: "(512) 555-1234",
  location: "Austin, TX",
};

// --- sub-components ---

function ContactCard() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-xs font-semibold text-white">
        {CONTACT.initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{CONTACT.name}</p>
        <p className="text-xs text-[#999]">{CONTACT.company}</p>
        <p className="text-xs text-[#666]">{CONTACT.context}</p>
      </div>
    </div>
  );
}

function PhoneDisplay() {
  return (
    <div className="px-4 py-2 text-center font-mono text-xl tabular-nums text-white">
      {CONTACT.phone}
    </div>
  );
}

function DialPadGrid() {
  return (
    <div className="grid grid-cols-3 gap-[clamp(4px,1vh,12px)] px-4">
      {DIAL_KEYS.map((k) => (
        <div
          key={k.digit}
          className="flex aspect-square w-[clamp(36px,8vh,64px)] flex-col items-center justify-center rounded-full bg-[#2a2a2a] select-none"
        >
          <span className="text-[clamp(12px,2vh,22px)] font-medium leading-none text-white">
            {k.digit}
          </span>
          {k.letters && (
            <span className="mt-0.5 text-[clamp(6px,0.8vh,10px)] tracking-[1.5px] text-[#666]">
              {k.letters}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function CallButton({ pulsing }: { pulsing: boolean }) {
  return (
    <div className="flex justify-center px-4 pt-2 pb-3">
      <div className="relative">
        {pulsing && (
          <motion.div
            className="absolute inset-0 rounded-full bg-[#22c55e]"
            animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#22c55e]">
          <Phone size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function MultiLineIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-1 items-center gap-1.5">
          <motion.div
            className={`h-1.5 flex-1 rounded-full ${i === 0 ? "bg-[#22c55e]" : "bg-[#333]"}`}
            animate={i === 0 ? { opacity: [1, 0.5, 1] } : {}}
            transition={i === 0 ? { duration: 1, repeat: Infinity } : {}}
          />
          <span className="text-[9px] text-[#666]">
            {i === 0 ? "active" : "queued"}
          </span>
        </div>
      ))}
    </div>
  );
}

function LocalPresenceBadge() {
  return (
    <div className="mx-4 flex items-center gap-1.5 rounded-md bg-[#1a2e1a] px-3 py-1.5">
      <MapPin size={12} className="text-[#22c55e]" />
      <span className="text-[11px] text-[#22c55e]">
        calling from {LOCAL_PRESENCE.number} — local to {LOCAL_PRESENCE.location}
      </span>
    </div>
  );
}

function Timer({ seconds }: { seconds: number }) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return (
    <span className="font-mono text-sm tabular-nums text-[#999]">
      {m}:{s}
    </span>
  );
}

function DialingAvatar() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative">
        <motion.div
          className="absolute inset-[-8px] rounded-full border-2 border-[#22c55e]"
          animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-[-4px] rounded-full border border-[#22c55e]"
          animate={{ scale: [1, 1.2], opacity: [0.4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#2a2a2a] text-lg font-semibold text-white">
          {CONTACT.initials}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white">{CONTACT.name}</p>
        <p className="text-xs text-[#999]">dialing...</p>
      </div>
    </div>
  );
}

function InCallControlBar() {
  const controls = [
    { icon: Mic, label: "Mute", active: false, danger: false },
    { icon: Pause, label: "Hold", active: false, danger: false },
    { icon: PhoneOff, label: "End", active: false, danger: true },
    { icon: Hash, label: "Keypad", active: false, danger: false },
    { icon: ArrowRightLeft, label: "Transfer", active: false, danger: false },
  ];

  return (
    <div className="flex items-start justify-center gap-4 rounded-lg bg-[#1a1a1a] px-4 py-3">
      {controls.map((c) => (
        <div key={c.label} className="flex flex-col items-center gap-1">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform ${
              c.danger
                ? "bg-[#ef4444] text-white"
                : c.active
                  ? "bg-[#3b82f6] text-white"
                  : "bg-[#2a2a2a] text-white"
            }`}
          >
            <c.icon size={18} />
          </div>
          <span className="text-[10px] text-[#666]">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function WhisperPanel({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-3 rounded-lg border border-[#2a2a2a] bg-[#111] p-3"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles size={12} className="text-[#a78bfa]" />
        <span className="text-xs font-medium text-[#a78bfa]">AI Coach</span>
      </div>
      <p className="text-[13px] leading-relaxed text-[#ccc]">
        {text}
        <motion.span
          className="inline-block h-3.5 w-[2px] translate-y-[1px] bg-[#a78bfa]"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      </p>
    </motion.div>
  );
}

// --- main component ---

export function DialerDemo() {
  const [state, setState] = useState<DemoState>("idle");
  const [timer, setTimer] = useState(0);
  const [whisperText, setWhisperText] = useState("");
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whisperRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setState((s) => {
      const next = NEXT[s];
      if (next === "idle") {
        setTimer(0);
        setWhisperText("");
      }
      return next;
    });
  }, []);

  // auto-advance timer
  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(advance, DURATIONS[state]);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, paused, advance]);

  // call timer (dialing + connected)
  useEffect(() => {
    if (state === "dialing" || state === "connected") {
      if (state === "dialing") setTimer(0);
      callTimerRef.current = setInterval(() => {
        if (!paused) setTimer((t) => t + 1);
      }, 1000);
      return () => {
        if (callTimerRef.current) clearInterval(callTimerRef.current);
      };
    }
    return undefined;
  }, [state, paused]);

  // whisper typing effect
  useEffect(() => {
    if (state !== "connected") {
      setWhisperText("");
      return;
    }
    let idx = 0;
    // small delay before whisper starts
    const startDelay = setTimeout(() => {
      whisperRef.current = setInterval(() => {
        if (idx < WHISPER_TEXT.length) {
          setWhisperText(WHISPER_TEXT.slice(0, idx + 1));
          idx++;
        } else if (whisperRef.current) {
          clearInterval(whisperRef.current);
        }
      }, 40);
    }, 600);
    return () => {
      clearTimeout(startDelay);
      if (whisperRef.current) clearInterval(whisperRef.current);
    };
  }, [state]);

  return (
    <div
      className="relative mx-auto w-full max-w-[380px] cursor-pointer select-none"
      onClick={advance}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") advance();
      }}
      aria-label="Interactive dialer demo — click to advance"
    >
      {/* device frame */}
      <div className="overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#111] shadow-2xl shadow-black/40">
        {/* status bar */}
        <div className="flex items-center justify-between bg-[#111] px-4 py-2">
          <span className="text-[11px] font-medium text-[#999]">consuelo</span>
          {(state === "dialing" || state === "connected") && (
            <Timer seconds={timer} />
          )}
          {state === "idle" && (
            <span className="text-[11px] text-[#666]">ready</span>
          )}
        </div>

        {/* content area */}
        <div className="min-h-[420px]">
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <ContactCard />
                <PhoneDisplay />
                <DialPadGrid />
                <CallButton pulsing />
              </motion.div>
            )}

            {state === "dialing" && (
              <motion.div
                key="dialing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-3"
              >
                <DialingAvatar />
                <LocalPresenceBadge />
                <MultiLineIndicator />
              </motion.div>
            )}

            {state === "connected" && (
              <motion.div
                key="connected"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col items-center gap-1 pt-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2a2a2a] text-sm font-semibold text-white">
                    {CONTACT.initials}
                  </div>
                  <p className="text-sm font-medium text-white">
                    {CONTACT.name}
                  </p>
                  <p className="text-xs text-[#22c55e]">connected</p>
                </div>
                <InCallControlBar />
                <WhisperPanel text={whisperText} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* bottom hint */}
        <div className="px-4 py-2 text-center">
          <span className="text-[10px] text-[#444]">
            {paused ? "click to advance" : "hover to pause"}
          </span>
        </div>
      </div>
    </div>
  );
}
