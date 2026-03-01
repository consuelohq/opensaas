# Chat SDK Integration - Discord/Slack CLI Interface

**Status:** Brainstorm/Exploration
**Reference:** Vercel Chat SDK (https://chat-sdk.dev/)
**Created:** 2026-02-24
**Updated:** 2026-02-24 (Architecture pivot: Phone-based conference calls)

---

## The Vision: OpenSaas Everywhere

Meet sales reps where they already hang (Discord for startups, Slack for enterprise) instead of requiring them to switch to the OpenSaas web app. Use Vercel's Chat SDK to build a unified bot that works on both platforms.

**Core insight:** Every team is on Discord or Slack. Only ~70% will be on Claude/GPT. Chat SDK gives us full control + broader reach + we host everything.

### What Chat SDK Gives Us Out-of-the-Box

- **Unified API:** Write bot logic once, deploy to Discord + Slack simultaneously
- **JSX Cards:** Rich interactive UIs that render natively on each platform
- **Event Handling:** Type-safe handlers for mentions, slash commands, button clicks
- **State Management:** Redis/in-memory adapters for distributed state
- **Streaming:** Real-time AI responses (perfect for coaching)

---

## Phase 1: The "Chat CLI" (Easy Wins)

Map existing CLI commands to Discord/Slack slash commands:

```
/consuelo queue start [category]     → Start dialer session
/consuelo queue pause|resume|stop    → Session controls
/consuelo upload                      → CSV import via file attachment
/consuelo contacts search [query]     → Search workspace contacts
/consuelo contacts next               → Peek next in queue
/consuelo status                      → Your current session status
/consuelo caller-id                   → View/set outgoing number
/consuelo coaching [call-id]          → View AI analysis from past call
/consuelo me                         → Your stats (calls made, conversion)
```

**Rich Cards Examples:**

- Queue status with mini leaderboard
- Contact card when you hit "next" (shows last call outcome + notes)
- Post-call summary with transcript snippet + coaching highlights
- Real-time call status in #sales channel (🟢 @rep calling Acme Corp)

---

## Phase 2: Phone-Based Dialer (Core Feature)

**No browser required. Everything happens via phone calls orchestrated through chat.**

### How It Works

1. Rep runs `/consuelo queue start insurance`
2. Bot posts rich card: "Queue started. Calling next lead..."
3. **Behind the scenes:**
   - OpenSaas API queries leads DB → fetches next lead
   - Twilio Conference Orchestrator initiates call:
     - First calls rep's phone → rep picks up
     - Then bridges lead's phone → rep talks to lead
   - Call logged to OpenSaas (duration, outcome, notes)
4. Bot posts to Discord/Slack: "🟢 @rep calling Acme Corp (+1-555-0123)"
5. After call, bot posts summary card with:
   - Call duration
   - Disposition buttons (interested, not interested, follow-up)
   - AI coaching analysis
   - Notes field
6. Repeat until queue complete

### Twilio Conference Flow

```
┌─────────────────┐
│   Rep's Phone   │
└────────┬────────┘
         │
         │ Twilio dials rep first
         ▼
┌─────────────────────────────────┐
│   Twilio Conference Room       │
│   (OpenSaas manages this)      │
└────────┬──────────────────────┘
         │
         │ Then dials lead
         ▼
┌─────────────────┐
│  Lead's Phone   │
└─────────────────┘
```

### Why This Is Better Than Browser Calls

| Browser-Based | Phone-Based Conference |
|---------------|----------------------|
| Requires open tab | Works on any phone |
| Tied to computer | Rep can walk around |
| JavaScript SDK issues | Twilio handles everything |
| Poor mobile experience | Native phone experience |
| Can't easily handoff | Handoff to another rep just re-bridges |

### The Chat Interface

Everything is orchestrated through Discord/Slack:

**Before call:**
```
🟢 @rep calling Acme Corp (+1-555-0123)
Lead: Acme Corp | Last contact: 2 days ago
Notes: Spoke with John, interested in pricing
```

**After call:**
```
✅ Call completed: 4:32
[Set Disposition] [Interested] [Not Interested] [Follow-up]

📊 AI Coaching Analysis:
• You mentioned pricing too early (recommended: discovery first)
• Great active listening — 3 follow-up questions
• Missed opportunity: didn't ask about budget

[Add Notes] ___________________________________
[Save & Next]
```

### Disposition & Analytics

After each call, rep clicks disposition in chat:
- **Interested** → Lead moves to "follow-up" queue, bot posts to #wins
- **Not Interested** → Lead marked "closed-lost", archived
- **Follow-up** → Scheduled for 3 days, added to calendar

All data flows to OpenSaas for analytics, dashboards, reports.

---

## Phase 3: Advanced Features

### Thread Persistence

- Each command creates/replies in a thread
- `/consuelo call 123` creates thread
- Subsequent commands in thread act on that call
- Perfect for warm transfers — manager joins thread, sees context, clicks "take over"

### Team Visibility

- Bot posts to #sales channel: real-time call activity
- "🟢 @rep calling Acme Corp" — team sees who's calling whom
- "🎉 @rep just qualified a $50K opportunity!" — celebrate wins publicly
- Manager can see full team activity without opening dashboard

### Friction-Reducing Features

- **CSV Drag-and-Drop:** Drop a CSV file in Discord → bot auto-parses, asks "Import these 47 contacts to which queue?"
- **Screenshot Receipts:** When you mark a call "disposition: interested", bot generates a shareable win card you can post to #wins channel
- **Webhook Bridge:** Existing OpenSaas webhooks post to Discord channels (call completed, new contact added, etc.)
- **`/consuelo whisper @manager`:** Creates a private thread with your live coaching link so manager can listen in

### Warm Transfers

- Rep gets to a decision-maker, needs manager: `/consuelo transfer @manager`
- Bot notifies manager in private thread with full context
- Manager clicks "take over" → Twilio bridges them into the call
- Rep drops off, manager continues conversation
- Handoff logged to OpenSaas with notes

---

## Technical Architecture

```
┌──────────────────────────────────────────────┐
│           Discord / Slack                    │
│    (User runs /consuelo commands)          │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│      Chat SDK Bot Service                   │
│  ├─ Discord Adapter                          │
│  ├─ Slack Adapter                            │
│  ├─ Command Router                           │
│  ├─ JSX Card Renderer                        │
│  └─ AI Layer (optional)                     │
│     ├─ Use Groq/OpenAI for coaching?         │
│     └─ Or just command router                │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│       OpenSaas API Gateway                   │
│  ├─ Queue Engine                             │
│  ├─ Leads API                                │
│  ├─ Analytics API                            │
│  └─ Twilio Conference Orchestrator          │
└──────────────────┬───────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │   Postgres DB     │
         │   (leads, calls)  │
         └───────────────────┘
```

### Twilio Conference Orchestrator

**Key endpoints:**
- `POST /calls/initiate` → starts conference call (rep phone + lead phone)
- `POST /calls/disposition` → logs call outcome
- `GET /calls/transcript` → returns call transcript + coaching analysis

**Flow:**
1. Bot calls `/calls/initiate` with rep_phone and lead_phone
2. API creates Twilio conference room
3. Twilio dials rep first → rep picks up
4. Twilio bridges lead → both connected
5. API tracks duration, logs to DB
6. On hangup, triggers webhook → bot posts summary card

### What Chat SDK Provides

- **Unified API:** Write once, deploy to Discord + Slack
- **JSX Cards:** Rich interactive UIs with buttons, dropdowns, images
- **Event Handling:** Type-safe slash commands, button clicks, mentions
- **State Management:** Built-in Redis/in-memory adapters for tracking sessions

### Auth Flow

1. User runs `/consuelo login`
2. Bot DMs an OAuth link
3. User links Discord/Slack identity to OpenSaas workspace
4. Tokens stored securely (same as existing CLI auth)

### State Management

- Redis adapter for distributed state (Chat SDK built-in)
- Tracks: active sessions, pending transfers, queue status per channel
- Survives bot restarts, works across multiple bot instances

---

## Implementation Complexity Matrix

| Feature              | Difficulty      | Chat SDK Help      | Notes                             |
| -------------------- | --------------- | ------------------ | --------------------------------- |
| Slash commands       | ⭐ Easy         | ✅ Full support    | Native to chat SDK                |
| Rich cards           | ⭐ Easy         | ✅ JSX cards       | Renders natively on each platform |
| Queue UI             | ⭐⭐ Medium     | ✅ Button handling | Interactive updates, live stats   |
| Call notifications   | ⭐⭐ Medium     | ✅ Event system    | Webhook → chat post               |
| Thread persistence   | ⭐⭐ Medium     | ✅ Thread API      | Need to track thread IDs          |
| Twilio conference    | ⭐⭐ Medium     | ✅ Twilio API      | Battle-tested, reliable           |
| AI coaching cards    | ⭐⭐⭐ Hard     | ❌ Custom work     | Need to build coaching layer       |
| Warm transfers      | ⭐⭐⭐ Hard     | ❌ Custom work     | Complex state management          |

---

## Why This Matters

### For Reps

- **Never leave Discord/Slack** (where they already coordinate with team)
- **One interface** for calls + team chat + coaching
- **Phone calls only** — no browser tab needed, can work from anywhere
- **Less context switching** = more calls made = more money

### For Managers

- **See team activity** in real-time without dashboard
- **Jump into calls** via warm transfer
- **Celebrate wins** in public channels for morale
- **Coaching notifications** appear right in chat

### For OpenSaas

- **Platform expansion** without building separate mobile apps
- **We host everything** = full control = more revenue potential
- **Broader reach** than AI-only plugins (every team uses Discord/Slack)
- **"Chat-native" sales tools** is a differentiator in crowded market
- **Network effects** — teams invite other teams to their Discord

---

## Open Questions

1. **Priority:** Discord (startup sales teams) or Slack (enterprise)?
2. **Scale:** How do we handle rate limits for large teams (100+ concurrent users)?
3. **Commands:** Which commands are most valuable to port first?
4. **AI Layer:** Should we build AI into the bot (coaching, natural language) or keep it simple?
5. **Pricing:** Do we charge extra for Discord/Slack integration?
6. **Phone Setup:** How do reps configure their phone number in the system?

---

## References

- **Chat SDK:** https://chat-sdk.dev/
- **Vercel Announcement:** https://vercel.com/changelog/chat-sdk
- **Twilio Conference:** https://www.twilio.com/docs/voice/api/conference
- **Twilio Programmable Voice:** https://www.twilio.com/docs/voice/twiml/conference

---

## Next Steps

1. **Spike:** Set up basic Chat SDK bot with Discord adapter
2. **Prototype:** Port 3-5 most-used CLI commands (`/me`, `/status`, `/queue start`)
3. **Twilio Integration:** Build conference calling orchestrator
4. **Test:** Internal dogfooding with OpenSaas team
5. **Ship:** Discord integration first, Slack second

**Estimated Timeline:**

- Phase 1 (Chat CLI): 2-3 weeks
- Phase 2 (Phone Dialer): 4-6 weeks
- Phase 3 (Advanced): 2-4 weeks

---

_Created by: Suelo_
_Last updated: 2026-02-24 (Phone-based architecture)_
