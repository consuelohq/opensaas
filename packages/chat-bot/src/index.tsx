/** @jsxImportSource chat */
import { createLogger } from '@consuelo/logger';
import { getAuth, removeAuth } from './auth.js';
import { createApiClient } from './api-client.js';
import { QueueDialer, formatProgressText, formatSummaryText } from './queue-dialer.js';
import type { DiscordAuth } from './auth.js';

const logger = createLogger('chat-bot');

export { logger };
export { getAuth, setAuth, removeAuth } from './auth.js';
export type { DiscordAuth } from './auth.js';

export async function createBot() {
  const { Chat, Card, CardText, Fields, Field } = await import('chat');
  const { createDiscordAdapter } = await import('@chat-adapter/discord');
  const { createRedisState } = await import('@chat-adapter/state-redis');

  const apiUrl = process.env.CONSUELO_API_URL ?? 'http://localhost:8000';
  const queueDialer = new QueueDialer({
    apiUrl,
    redisUrl: process.env.REDIS_URL,
  });

  const bot = new Chat({
    userName: 'consuelo',
    adapters: { discord: createDiscordAdapter() },
    state: createRedisState({ url: process.env.REDIS_URL }),
  });

  // helper: create per-user api client from auth credentials
  const userClient = (auth: DiscordAuth) =>
    createApiClient({ baseUrl: apiUrl, apiKey: auth.apiKey });

  // helper: error card for api failures
  const errorCard = (message: string) => (
    <Card title={"\u26A0\uFE0F Error"}>
      <CardText>{message}</CardText>
    </Card>
  );

  // helper: safe api call with error handling
  async function apiCall<TResult>(
    auth: DiscordAuth,
    method: 'get' | 'post',
    path: string,
  ): Promise<{ data: TResult | null; error: string | null }> {
    try {
      const client = userClient(auth);
      const data = await client[method]<TResult>(path);
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      if (message.includes('401')) return { data: null, error: 'unauthorized' };
      logger.error('api call failed', { path, error: message });
      return { data: null, error: message };
    }
  }

  bot.onSlashCommand('/consuelo', async (event) => {
    try {
      const parts = event.text.trim().split(/\s+/);
      const subcommand = parts[0] ?? '';

      // login — no auth required
      if (subcommand === 'login') {
        const authUrl = `${apiUrl}/v1/auth/discord?discord_user_id=${event.userId}`;
        await event.reply(
          <Card title={"\uD83D\uDD17 Link Your Account"}>
            <CardText>
              Click below to connect your Discord account to your Consuelo workspace.{"\n\n"}
              <a href={authUrl}>Link Account</a>
            </CardText>
          </Card>,
          { ephemeral: true },
        );
        return;
      }

      // logout — no auth required
      if (subcommand === 'logout') {
        const removed = await removeAuth(event.userId);
        const message = removed
          ? '\u2705 Logged out. Your workspace link has been removed.'
          : 'You were not linked to any workspace.';
        await event.reply(
          <Card title={"\uD83D\uDC4B Logout"}>
            <CardText>{message}</CardText>
          </Card>,
          { ephemeral: true },
        );
        return;
      }

      // all other commands require auth
      const auth = await getAuth(event.userId);
      if (!auth) {
        await event.reply(
          <Card title={"\uD83D\uDD12 Not Linked"}>
            <CardText>
              Run <code>/consuelo login</code> first to link your Discord account.
            </CardText>
          </Card>,
          { ephemeral: true },
        );
        return;
      }

      // ping
      if (subcommand === 'ping') {
        const uptime = formatUptime(Date.now() - startTime);
        await event.reply(
          <Card title={"\uD83C\uDFD3 Pong!"}>
            <Fields>
              <Field label="Version" value={VERSION} />
              <Field label="Uptime" value={uptime} />
              <Field label="Workspace" value={auth.workspaceId} />
              <Field label="Status" value="Online" />
            </Fields>
          </Card>,
        );
        return;
      }

      // me — user stats
      if (subcommand === 'me') {
        type MeResponse = {
          name: string;
          callsToday: number;
          callsThisWeek: number;
          connectRate: number;
          avgDuration: number;
        };
        const { data, error } = await apiCall<MeResponse>(auth, 'get', '/v1/users/me');
        if (error) {
          await event.reply(errorCard(error === 'unauthorized'
            ? 'Session expired. Run /consuelo login to re-link.'
            : `Service unavailable: ${error}`), { ephemeral: true });
          return;
        }
        const me = data!;
        await event.reply(
          <Card title={`\uD83D\uDC64 ${me.name}`}>
            <Fields>
              <Field label="Calls Today" value={String(me.callsToday)} />
              <Field label="Calls This Week" value={String(me.callsThisWeek)} />
              <Field label="Connect Rate" value={`${Math.round(me.connectRate * 100)}%`} />
              <Field label="Avg Duration" value={formatDuration(me.avgDuration)} />
            </Fields>
          </Card>,
        );
        return;
      }

      // status — service health
      if (subcommand === 'status') {
        type StatusResponse = {
          api: string;
          queue?: { active: boolean; name?: string; size?: number };
          currentCall?: { contactName?: string; duration?: number };
          services: Array<{ name: string; status: string }>;
        };
        const { data, error } = await apiCall<StatusResponse>(auth, 'get', '/v1/status');
        if (error) {
          await event.reply(errorCard(error === 'unauthorized'
            ? 'Session expired. Run /consuelo login to re-link.'
            : `Service unavailable: ${error}`), { ephemeral: true });
          return;
        }
        const s = data!;
        const serviceLines = s.services
          .map((svc) => `${svc.status === 'healthy' ? '\u2705' : '\u274C'} ${svc.name}`)
          .join('\n');
        const queueText = s.queue?.active
          ? `${s.queue.name ?? 'Active'} (${s.queue.size ?? 0} remaining)`
          : 'None';
        const callText = s.currentCall
          ? `${s.currentCall.contactName ?? 'Unknown'} (${formatDuration(s.currentCall.duration ?? 0)})`
          : 'None';
        await event.reply(
          <Card title={"\uD83D\uDCCA System Status"}>
            <Fields>
              <Field label="API" value={s.api} />
              <Field label="Active Queue" value={queueText} />
              <Field label="Current Call" value={callText} />
            </Fields>
            <CardText>{serviceLines}</CardText>
          </Card>,
        );
        return;
      }

      // contacts search <query>
      if (subcommand === 'contacts') {
        const action = parts[1];
        if (action !== 'search' || !parts[2]) {
          await event.reply(
            <Card title={"Contacts"}>
              <CardText>Usage: /consuelo contacts search {'<query>'}</CardText>
            </Card>,
            { ephemeral: true },
          );
          return;
        }
        const query = parts.slice(2).join(' ');
        type ContactsResponse = {
          contacts: Array<{
            id: string;
            name: string;
            phone: string;
            company?: string;
            lastCallDate?: string;
          }>;
        };
        const encodedQuery = encodeURIComponent(query);
        const { data, error } = await apiCall<ContactsResponse>(
          auth, 'get', `/v1/contacts?search=${encodedQuery}&limit=5`,
        );
        if (error) {
          await event.reply(errorCard(error === 'unauthorized'
            ? 'Session expired. Run /consuelo login to re-link.'
            : `Service unavailable: ${error}`), { ephemeral: true });
          return;
        }
        const { contacts } = data!;
        if (!contacts.length) {
          await event.reply(
            <Card title={"\uD83D\uDD0D No Results"}>
              <CardText>No contacts found for "{query}"</CardText>
            </Card>,
          );
          return;
        }
        const lines = contacts.map((c) => {
          const company = c.company ? ` \u2022 ${c.company}` : '';
          const lastCall = c.lastCallDate ? ` \u2022 Last call: ${c.lastCallDate.slice(0, 10)}` : '';
          return `\uD83D\uDC64 **${c.name}** — ${c.phone}${company}${lastCall}`;
        }).join('\n');
        await event.reply(
          <Card title={`\uD83D\uDD0D Contacts: "${query}"`}>
            <CardText>{lines}</CardText>
          </Card>,
        );
        return;
      }

      // history — recent calls
      if (subcommand === 'history') {
        type HistoryResponse = {
          calls: Array<{
            contactName?: string;
            to: string;
            duration: number;
            outcome: string;
            startedAt: string;
          }>;
        };
        const { data, error } = await apiCall<HistoryResponse>(auth, 'get', '/v1/history?limit=10');
        if (error) {
          await event.reply(errorCard(error === 'unauthorized'
            ? 'Session expired. Run /consuelo login to re-link.'
            : `Service unavailable: ${error}`), { ephemeral: true });
          return;
        }
        const { calls } = data!;
        if (!calls.length) {
          await event.reply(
            <Card title={"\uD83D\uDCDE Call History"}>
              <CardText>No recent calls.</CardText>
            </Card>,
          );
          return;
        }
        const lines = calls.map((c) => {
          const name = c.contactName ?? c.to;
          const date = c.startedAt.slice(0, 16).replace('T', ' ');
          const icon = c.outcome === 'answered' ? '\u2705' : '\u274C';
          return `${icon} **${name}** — ${formatDuration(c.duration)} — ${c.outcome} — ${date}`;
        }).join('\n');
        await event.reply(
          <Card title={"\uD83D\uDCDE Recent Calls"}>
            <CardText>{lines}</CardText>
          </Card>,
        );
        return;
      }

      // queue commands
      if (subcommand === 'queue') {
        const queueAction = parts[1] ?? '';
        const queueArg = parts[2];

        if (!queueAction) {
          await event.reply(
            <Card title={"Queue"}>
              <CardText>
                Usage: /consuelo queue {'<start|pause|resume|stop|status|call>'}{"\n"}
                start [category] — start dialing a queue{"\n"}
                pause — pause active queue{"\n"}
                resume — resume paused queue{"\n"}
                stop — stop queue and show summary{"\n"}
                status — show queue progress{"\n"}
                call — dial current lead (preview mode)
              </CardText>
            </Card>,
            { ephemeral: true },
          );
          return;
        }

        // queue start [category]
        if (queueAction === 'start') {
          type PrefsResponse = { phone?: string; repPhone?: string };
          const { data: prefs, error: prefsErr } = await apiCall<PrefsResponse>(
            auth, 'get', '/v1/settings/preferences',
          );
          const repPhone = prefs?.repPhone ?? prefs?.phone;
          if (!repPhone) {
            await event.reply(
              <Card title={"\u260E\uFE0F Phone Required"}>
                <CardText>
                  Set your phone number first via preferences before starting a queue.
                </CardText>
              </Card>,
              { ephemeral: true },
            );
            return;
          }

          // find a queue to start — by category filter or most recent idle
          type QueueListItem = {
            id: string;
            name: string;
            status: string;
            category?: string;
            total_contacts: number;
          };
          const { data: queues, error: listErr } = await apiCall<QueueListItem[]>(
            auth, 'get', '/v1/queues',
          );
          if (listErr || !queues) {
            await event.reply(errorCard(listErr ?? 'Failed to list queues'), { ephemeral: true });
            return;
          }

          const category = queueArg;
          const eligible = queues.filter((q) => {
            if (q.status !== 'idle' && q.status !== 'paused') return false;
            if (category && q.category !== category) return false;
            return true;
          });

          if (eligible.length === 0) {
            await event.reply(
              <Card title={"\uD83D\uDCCB No Queue Found"}>
                <CardText>
                  No idle queues found{category ? ` for category "${category}"` : ''}. Create one first.
                </CardText>
              </Card>,
            );
            return;
          }

          const target = eligible[0];
          const mode = (parts[3] === 'preview' ? 'preview' : 'power') as 'power' | 'preview';

          // store reply callback for auto-dial loop messages
          queueDialer.setReplyCallback(auth.userId, async (content) => {
            await event.reply(
              <Card title={"\uD83D\uDCDE Queue Update"}>
                <CardText>{String(content)}</CardText>
              </Card>,
            );
          });

          const result = await queueDialer.startQueue(
            auth, event.userId, target.id, mode, repPhone,
          );

          if (result.error) {
            await event.reply(errorCard(result.error), { ephemeral: true });
            return;
          }

          await event.reply(
            <Card title={"\uD83D\uDFE2 Queue Started"}>
              <Fields>
                <Field label="Queue" value={target.name} />
                <Field label="Leads" value={String(target.total_contacts)} />
                <Field label="Mode" value={mode} />
              </Fields>
              <CardText>
                {result.currentItem
                  ? 'Calling your phone to connect with first lead...'
                  : 'No pending leads in this queue.'}
              </CardText>
            </Card>,
          );
          return;
        }

        // queue pause
        if (queueAction === 'pause') {
          const queueId = queueDialer.getActiveQueueId(event.userId);
          if (!queueId) {
            await event.reply(errorCard('No active queue. Start one with /consuelo queue start'), { ephemeral: true });
            return;
          }
          const result = await queueDialer.pauseQueue(auth, queueId);
          if (!result) {
            await event.reply(errorCard('Failed to pause queue'), { ephemeral: true });
            return;
          }
          const completed = (result.completed_contacts ?? 0);
          const total = (result.total_contacts ?? 0);
          await event.reply(
            <Card title={"\u23F8\uFE0F Queue Paused"}>
              <CardText>{`${completed}/${total} completed.`}</CardText>
            </Card>,
          );
          return;
        }

        // queue resume
        if (queueAction === 'resume') {
          const queueId = queueDialer.getActiveQueueId(event.userId);
          if (!queueId) {
            await event.reply(errorCard('No active queue to resume.'), { ephemeral: true });
            return;
          }
          const result = await queueDialer.resumeQueue(auth, event.userId, queueId);
          if (!result) {
            await event.reply(errorCard('Failed to resume queue'), { ephemeral: true });
            return;
          }
          await event.reply(
            <Card title={"\u25B6\uFE0F Queue Resumed"}>
              <CardText>
                {result.currentItem
                  ? 'Calling next lead...'
                  : 'No more pending leads.'}
              </CardText>
            </Card>,
          );
          return;
        }

        // queue stop
        if (queueAction === 'stop') {
          const queueId = queueDialer.getActiveQueueId(event.userId);
          if (!queueId) {
            await event.reply(errorCard('No active queue to stop.'), { ephemeral: true });
            return;
          }
          const analytics = await queueDialer.getAnalytics(auth, queueId);
          const queue = await queueDialer.stopQueue(auth, event.userId, queueId);
          if (!queue) {
            await event.reply(errorCard('Failed to stop queue'), { ephemeral: true });
            return;
          }

          if (analytics) {
            const summary = formatSummaryText(queue.name ?? 'Queue', analytics);
            await event.reply(
              <Card title={"\uD83D\uDCCB Queue Summary"}>
                <CardText>{summary}</CardText>
              </Card>,
            );
          } else {
            await event.reply(
              <Card title={"\u23F9\uFE0F Queue Stopped"}>
                <CardText>{`${queue.name} stopped.`}</CardText>
              </Card>,
            );
          }
          return;
        }

        // queue status
        if (queueAction === 'status') {
          const queueId = queueDialer.getActiveQueueId(event.userId) ?? queueArg;
          if (!queueId) {
            // show list of queues
            const queues = await queueDialer.listQueues(auth);
            if (queues.length === 0) {
              await event.reply(
                <Card title={"\uD83D\uDCCB Queues"}>
                  <CardText>No queues found.</CardText>
                </Card>,
              );
              return;
            }
            const lines = queues.map((q) => {
              const completed = (q as Record<string, unknown>).completed_contacts ?? 0;
              const total = (q as Record<string, unknown>).total_contacts ?? 0;
              return `${q.status === 'active' ? '\uD83D\uDFE2' : '\u26AA'} **${q.name}** — ${q.status} (${completed}/${total})`;
            }).join('\n');
            await event.reply(
              <Card title={"\uD83D\uDCCB Queues"}>
                <CardText>{lines}</CardText>
              </Card>,
            );
            return;
          }

          const [queue, analytics] = await Promise.all([
            queueDialer.getQueueWithItems(auth, queueId),
            queueDialer.getAnalytics(auth, queueId),
          ]);

          if (!queue) {
            await event.reply(errorCard('Queue not found'), { ephemeral: true });
            return;
          }

          const state = queueDialer.getActiveMode(event.userId);
          const mode = state ?? 'power';
          const progressText = formatProgressText(queue, analytics, mode);
          const currentItem = queue.items?.find((i) => i.status === 'calling');

          await event.reply(
            <Card title={"\uD83D\uDCCA Queue Status"}>
              <CardText>
                {progressText}
                {currentItem ? `\n\nCurrent: Contact ${currentItem.contact_id}` : ''}
              </CardText>
            </Card>,
          );
          return;
        }

        // queue call — manual dial for preview mode
        if (queueAction === 'call') {
          const dialed = await queueDialer.dialCurrentItem(auth, event.userId);
          if (!dialed) {
            await event.reply(errorCard('No current lead to dial, or no active queue.'), { ephemeral: true });
            return;
          }
          await event.reply(
            <Card title={"\uD83D\uDCDE Dialing"}>
              <CardText>Calling your phone to connect with current lead...</CardText>
            </Card>,
          );
          return;
        }

        await event.reply(
          <Card title={"Queue"}>
            <CardText>Unknown queue action: {queueAction}</CardText>
          </Card>,
          { ephemeral: true },
        );
        return;
      }

      // unknown subcommand
      await event.reply(
        <Card title={"Consuelo"}>
          <CardText>
            Available commands: login, logout, ping, me, status, contacts search, history, queue
          </CardText>
        </Card>,
        { ephemeral: true },
      );
    } catch (err: unknown) {
      logger.error('slash command failed', {
        error: err instanceof Error ? err.message : 'unknown',
        command: event.command,
      });
    }
  });

  return { bot, Card, CardText, Fields, Field, queueDialer };
}

const VERSION = '0.0.1';
const startTime = Date.now();

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
