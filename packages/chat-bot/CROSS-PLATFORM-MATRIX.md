# Cross-Platform Test Matrix

Consuelo chat-bot feature support across Discord and Slack.

## Feature Matrix

| Feature (subtask) | Discord | Slack | Notes |
|---|---|---|---|
| **11.1: Login/logout** | ✅ Works | ✅ Works | Same `/consuelo login` and `/consuelo logout` flow on both platforms via Chat SDK adapter abstraction |
| **11.2: Slash commands** (`me`, `status`, `ping`) | ✅ Works | ✅ Works | Single `/consuelo` command with subcommands. Chat SDK routes to same handler |
| **11.3: Contacts search** | ✅ Works | ✅ Works | `/consuelo contacts search <query>` — card rendering adapts per platform |
| **11.4: Call history** | ✅ Works | ✅ Works | `/consuelo history` — same card layout |
| **11.5: Queue commands** (start, pause, resume, stop, status, call) | ✅ Works | ✅ Works | Full queue lifecycle via `/consuelo queue <action>` |
| **11.6: Post-call cards** | ✅ Buttons | ✅ Buttons + Modal | Discord: individual disposition buttons. Slack: same buttons plus "Full Disposition" modal with dropdown + notes |
| **11.7: Channel notifications** | ✅ Works | ✅ Works | Redis pub/sub → channel post. Requires `/consuelo config channel #channel` setup |
| **11.8: AI coaching streaming** | ⚠️ Post+Edit | ✅ Native streaming | Discord: posts message then edits as chunks arrive (500ms interval). Slack: native `chatStream` API for smooth real-time updates |
| **11.9: Transfers + whisper** | ✅ Works | ✅ Works | `/consuelo transfer @user` and `/consuelo whisper @user` — DM cards with Join/Decline buttons |

## Platform-Specific Differences

### Disposition Flow

- **Discord**: Click one of 6 outcome buttons directly on the post-call card. Notes added via separate "Add Notes" button + thread reply.
- **Slack**: Same buttons available, plus a "Full Disposition" button that opens a native Slack modal with a dropdown for outcome and a text area for notes — all in one form submission.

### Streaming Behavior

- **Discord**: AI coaching responses use post+edit fallback. An initial message is posted, then edited as chunks arrive. Configurable via `streamingUpdateIntervalMs` (default 500ms).
- **Slack**: Native streaming API (`chatStream`). Smooth real-time character-by-character updates. Also supports structured `StreamChunk` objects for task progress cards.

### Ephemeral Messages

- **Discord**: Not natively supported by the adapter. Ephemeral-like behavior via DMs.
- **Slack**: Native ephemeral messages. Error responses and help text are only visible to the requesting user.

### Modals

- **Discord**: Not supported. The "Full Disposition" button is a no-op (handler checks for `event.openModal` before calling).
- **Slack**: Full modal support with text inputs, dropdowns, radio buttons, and server-side validation.

### Rate Limits

- **Discord**: 50 requests/second per bot. Gateway heartbeat keeps connection alive.
- **Slack**: Tier-based rate limits (varies by API method). Chat SDK handles retry/backoff automatically. Notification batching recommended for high-volume workspaces.

## Environment Variables

| Variable | Required For | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | Discord | Discord bot token |
| `DISCORD_PUBLIC_KEY` | Discord | Discord application public key |
| `SLACK_BOT_TOKEN` | Slack | Slack bot OAuth token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Slack | Slack app signing secret for webhook verification |
| `REDIS_URL` | Both | Redis connection URL for state adapter |
| `CONSUELO_API_URL` | Both | Consuelo API base URL |

## Webhook Endpoints

| Endpoint | Platform |
|---|---|
| `POST /api/webhooks/discord` | Discord interactions |
| `POST /api/webhooks/slack` | Slack events, interactions, slash commands |

## Setup Checklist

### Discord
1. Create Discord application at discord.com/developers
2. Set `DISCORD_BOT_TOKEN` and `DISCORD_PUBLIC_KEY`
3. Configure Interactions Endpoint URL to `/api/webhooks/discord`
4. Add bot to server with required permissions

### Slack
1. Create Slack app from `slack-manifest.json` at api.slack.com/apps
2. Replace webhook URL placeholder with your deployed URL
3. Set `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET`
4. Install app to workspace
