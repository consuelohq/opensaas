/** @jsxImportSource chat */
import { createLogger } from '@consuelo/logger';
import { getAuth, removeAuth } from './auth.js';
import { createApiClient } from './api-client.js';
import { QueueDialer, formatProgressText, formatSummaryText } from './queue-dialer.js';
import type { CallEvent } from './queue-dialer.js';
import { buildPostCallCard, buildDispositionConfirmCard } from './post-call-card.js';
import { ChannelNotifier } from './channel-notifications.js';
import { TransferManager } from './transfer-manager.js';
import type { Disposition } from './post-call-card.js';
import type { DiscordAuth } from './auth.js';

const logger = createLogger('chat-bot');

export { logger };
export { getAuth, setAuth, removeAuth, getDiscordUserId } from './auth.js';
export { ChannelNotifier } from './channel-notifications.js';
export { TransferManager } from './transfer-manager.js';
export type { DiscordAuth } from './auth.js';

export async function createBot() {
  const { Chat, Card, CardText, Fields, Field, Actions, Button } = await import('chat');
  const { createDiscordAdapter } = await import('@chat-adapter/discord');
  const { createRedisState } = await import('@chat-adapter/state-redis');

  const apiUrl = process.env.CONSUELO_API_URL ?? 'http://localhost:8000';
  const queueDialer = new QueueDialer({
    apiUrl,
    redisUrl: process.env.REDIS_URL,
  });

  const channelNotifier = new ChannelNotifier({
    redisUrl: process.env.REDIS_URL,
  });

  const transferManager = new TransferManager({
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

  // wire transfer manager to call events from queue-dialer's redis listener
  queueDialer.onCallEvent((event: CallEvent) => {
    if (!event.userId) return;
    if (event.type === 'call.started') {
      transferManager.trackCallStarted(
        event.userId,
        event.callId,
        event.conferenceName ?? '',
        (event as Record<string, unknown>).contactName as string | undefined,
        (event as Record<string, unknown>).leadPhone as string | undefined,
      );
    } else if (event.type === 'call.ended' || event.type === 'call.failed') {
      transferManager.trackCallEnded(event.userId);
    }
  });

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
            await event.reply(content);
          });

          queueDialer.setCallEndedCallback(auth.userId, postCallCardForUser);

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

      // config — workspace settings
      if (subcommand === 'config') {
        const configAction = parts[1];

        if (configAction === 'channel') {
          const channelArg = parts[2];
          if (!channelArg) {
            // show current channel
            const current = await channelNotifier.getChannel(auth.workspaceId);
            const display = current ? `<#${current}>` : 'Not set';
            await event.reply(
              <Card title={"\u2699\uFE0F Notification Channel"}>
                <CardText>Current: {display}{"\n"}Usage: /consuelo config channel #channel-name</CardText>
              </Card>,
              { ephemeral: true },
            );
            return;
          }

          // parse channel mention: <#1234567890> or raw ID
          const channelMatch = channelArg.match(/^<#(\d+)>$/) ?? channelArg.match(/^(\d+)$/);
          if (!channelMatch) {
            await event.reply(errorCard('Invalid channel. Use #channel-name or a channel ID.'), { ephemeral: true });
            return;
          }

          // admin check via API
          type RoleResponse = { role?: string };
          const { data: roleData, error: roleErr } = await apiCall<RoleResponse>(auth, 'get', '/v1/users/me/role');
          if (roleErr) {
            await event.reply(errorCard(roleErr === 'unauthorized'
              ? 'Session expired. Run /consuelo login to re-link.'
              : `Failed to check permissions: ${roleErr}`), { ephemeral: true });
            return;
          }
          if (roleData?.role !== 'admin' && roleData?.role !== 'owner') {
            await event.reply(errorCard('Only workspace admins can set the notification channel.'), { ephemeral: true });
            return;
          }

          try {
            await channelNotifier.setChannel(auth.workspaceId, channelMatch[1]);
          } catch (err: unknown) {
            logger.error('failed to set notification channel', {
              error: err instanceof Error ? err.message : 'unknown',
            });
            await event.reply(errorCard('Failed to save channel setting.'), { ephemeral: true });
            return;
          }

          await event.reply(
            <Card title={"\u2705 Channel Set"}>
              <CardText>Notifications will be posted to {`<#${channelMatch[1]}>`}.</CardText>
            </Card>,
          );
          return;
        }

        await event.reply(
          <Card title={"Config"}>
            <CardText>Usage: /consuelo config channel #channel-name</CardText>
          </Card>,
          { ephemeral: true },
        );
        return;
      }

      // transfer — warm transfer to another team member
      if (subcommand === 'transfer') {
        const mentionArg = parts[1];
        if (!mentionArg) {
          await event.reply(
            <Card title={"Transfer"}>
              <CardText>Usage: /consuelo transfer @manager</CardText>
            </Card>,
            { ephemeral: true },
          );
          return;
        }

        // parse discord mention: <@123456789> or <@!123456789>
        const mentionMatch = mentionArg.match(/^<@!?(\d+)>$/);
        if (!mentionMatch) {
          await event.reply(errorCard('Mention a user: /consuelo transfer @manager'), { ephemeral: true });
          return;
        }
        const managerDiscordId = mentionMatch[1];

        // check rep has an active call
        const activeCall = await transferManager.getActiveCall(auth);
        if (!activeCall || !activeCall.callSid) {
          await event.reply(errorCard('No active call. Start a call first.'), { ephemeral: true });
          return;
        }

        // check no existing transfer in progress
        const existing = transferManager.getActiveTransferForRep(event.userId);
        if (existing) {
          await event.reply(errorCard('A transfer is already in progress. Complete or cancel it first.'), { ephemeral: true });
          return;
        }

        // resolve manager phone
        const { phone: managerPhone, error: phoneErr } = await transferManager.resolveManagerPhone(managerDiscordId);
        if (!managerPhone) {
          await event.reply(
            <Card title={"\u26A0\uFE0F Transfer Failed"}>
              <CardText>{phoneErr ?? 'Could not resolve manager phone'}</CardText>
            </Card>,
            { ephemeral: true },
          );
          return;
        }

        // calculate call duration
        const callStart = new Date(activeCall.startedAt).getTime();
        const durationSec = Math.floor((Date.now() - callStart) / 1000);

        // create pending transfer
        const transferId = transferManager.createPendingTransfer({
          callSid: activeCall.callSid,
          conferenceName: activeCall.conferenceName,
          repDiscordId: event.userId,
          repAuth: auth,
          managerDiscordId,
          managerPhone,
          contactName: activeCall.contactName ?? 'Unknown',
          contactPhone: activeCall.contactPhone ?? '',
          contactCompany: '',
          callDuration: durationSec,
          type: 'warm',
        });

        const durationStr = formatDuration(durationSec);
        const contactLine = activeCall.contactName
          ? `Lead: ${activeCall.contactName} | ${activeCall.contactPhone ?? ''}`
          : `Phone: ${activeCall.contactPhone ?? 'Unknown'}`;

        // DM the manager with context card
        try {
          await event.sendDM(managerDiscordId,
            <Card title={`\uD83D\uDCDE Transfer request from <@${event.userId}>`}>
              <CardText>
                {contactLine}{"\n"}
                Duration so far: {durationStr}
              </CardText>
              <Actions>
                <Button action={`transfer-join:${transferId}`}>Join Call</Button>
                <Button action={`transfer-decline:${transferId}`}>Decline</Button>
              </Actions>
            </Card>,
          );
        } catch (dmErr: unknown) {
          logger.error('failed to DM manager', {
            error: dmErr instanceof Error ? dmErr.message : 'unknown',
            managerDiscordId,
          });
          await event.reply(errorCard('Failed to notify manager. They may have DMs disabled.'), { ephemeral: true });
          return;
        }

        // confirm to rep
        await event.reply(
          <Card title={"\uD83D\uDCDE Transfer Initiated"}>
            <CardText>
              {`Notified <@${managerDiscordId}>. Waiting for them to join...`}
            </CardText>
            <Actions>
              <Button action={`transfer-cancel:${transferId}`}>Cancel Transfer</Button>
            </Actions>
          </Card>,
        );
        return;
      }

      // whisper — add manager in listen-only mode
      if (subcommand === 'whisper') {
        const mentionArg = parts[1];
        if (!mentionArg) {
          await event.reply(
            <Card title={"Whisper"}>
              <CardText>Usage: /consuelo whisper @manager</CardText>
            </Card>,
            { ephemeral: true },
          );
          return;
        }

        const mentionMatch = mentionArg.match(/^<@!?(\d+)>$/);
        if (!mentionMatch) {
          await event.reply(errorCard('Mention a user: /consuelo whisper @manager'), { ephemeral: true });
          return;
        }
        const managerDiscordId = mentionMatch[1];

        const activeCall = await transferManager.getActiveCall(auth);
        if (!activeCall || !activeCall.callSid) {
          await event.reply(errorCard('No active call. Start a call first.'), { ephemeral: true });
          return;
        }

        const { phone: managerPhone, error: phoneErr } = await transferManager.resolveManagerPhone(managerDiscordId);
        if (!managerPhone) {
          await event.reply(
            <Card title={"\u26A0\uFE0F Whisper Failed"}>
              <CardText>{phoneErr ?? 'Could not resolve manager phone'}</CardText>
            </Card>,
            { ephemeral: true },
          );
          return;
        }

        const callStart = new Date(activeCall.startedAt).getTime();
        const durationSec = Math.floor((Date.now() - callStart) / 1000);

        const transferId = transferManager.createPendingTransfer({
          callSid: activeCall.callSid,
          conferenceName: activeCall.conferenceName,
          repDiscordId: event.userId,
          repAuth: auth,
          managerDiscordId,
          managerPhone,
          contactName: activeCall.contactName ?? 'Unknown',
          contactPhone: activeCall.contactPhone ?? '',
          contactCompany: '',
          callDuration: durationSec,
          type: 'whisper',
        });

        // DM manager
        try {
          await event.sendDM(managerDiscordId,
            <Card title={`\uD83D\uDD07 Whisper request from <@${event.userId}>`}>
              <CardText>
                {`<@${event.userId}> wants you to listen in on their call.`}{"\n"}
                Lead: {activeCall.contactName ?? 'Unknown'}{"\n"}
                Duration: {formatDuration(durationSec)}
              </CardText>
              <Actions>
                <Button action={`whisper-join:${transferId}`}>Listen In</Button>
                <Button action={`transfer-decline:${transferId}`}>Decline</Button>
              </Actions>
            </Card>,
          );
        } catch (dmErr: unknown) {
          logger.error('failed to DM manager for whisper', {
            error: dmErr instanceof Error ? dmErr.message : 'unknown',
          });
          await event.reply(errorCard('Failed to notify manager. They may have DMs disabled.'), { ephemeral: true });
          return;
        }

        await event.reply(
          <Card title={"\uD83D\uDD07 Whisper Initiated"}>
            <CardText>
              {`Notified <@${managerDiscordId}>. They'll join in listen-only mode.`}
            </CardText>
          </Card>,
        );
        return;
      }

      // unknown subcommand
      await event.reply(
        <Card title={"Consuelo"}>
          <CardText>
            Available commands: login, logout, ping, me, status, contacts search, history, queue, config, transfer, whisper
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

  // track pending notes requests: callId -> discordUserId
  const pendingNotes = new Map<string, string>();

  // wire post-call card into queue-dialer call events
  const postCallCardForUser = async (callId: string, discordUserId: string, auth: DiscordAuth) => {
    try {
      const client = userClient(auth);
      const card = await buildPostCallCard(callId, client, {
        Card, CardText, Fields, Field, Actions, Button,
      });
      const replyFn = queueDialer.getReplyCallback(discordUserId);
      if (replyFn) {
        await replyFn(card);
      }
    } catch (err: unknown) {
      logger.error('failed to post call card', {
        error: err instanceof Error ? err.message : 'unknown',
        callId,
      });
    }
  };

  // handle disposition button clicks and notes flow
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot.onAction(async (event: any) => { // HACK: chat SDK types unavailable (peer dep)
    try {
      const action = event.action ?? '';

      // disposition:{callId}:{outcome}
      if (action.startsWith('disposition:')) {
        const parts = action.split(':');
        const callId = parts[1];
        const outcome = parts[2] as Disposition;
        if (!callId || !outcome) return;

        const auth = await getAuth(event.userId);
        if (!auth) return;

        try {
          const client = userClient(auth);
          await client.post(`/v1/calls/${callId}/disposition`, { outcome });
        } catch (err: unknown) {
          logger.error('disposition api call failed', {
            error: err instanceof Error ? err.message : 'unknown',
            callId,
            outcome,
          });
        }

        // confirm disposition
        const confirmCard = buildDispositionConfirmCard(outcome, { Card, CardText });
        await event.reply(confirmCard);

        // advance queue if active
        await queueDialer.advanceAfterDisposition(event.userId);
        return;
      }

      // notes:{callId}
      if (action.startsWith('notes:')) {
        const callId = action.split(':')[1];
        if (!callId) return;

        pendingNotes.set(event.userId, callId);
        await event.reply(
          <Card title={"\uD83D\uDCDD Add Notes"}>
            <CardText>Type your notes for this call and send them as a reply.</CardText>
          </Card>,
        );
        return;
      }

      // transfer-join:{transferId} — manager accepts transfer
      if (action.startsWith('transfer-join:')) {
        const transferId = action.split(':')[1];
        if (!transferId) return;

        const transfer = transferManager.getTransfer(transferId);
        if (!transfer) {
          await event.reply(errorCard('Transfer expired or not found.'));
          return;
        }
        if (transfer.status !== 'pending') {
          await event.reply(errorCard(`Transfer already ${transfer.status}.`));
          return;
        }

        const result = await transferManager.initiateTransfer(transferId);
        if (!result.success) {
          await event.reply(errorCard(result.error ?? 'Failed to join call.'));
          return;
        }

        await event.reply(
          <Card title={"\uD83D\uDCDE Joining Call"}>
            <CardText>
              Your phone is ringing. Answer to join the conference.{"\n"}
              Customer is on hold while you consult with the rep.
            </CardText>
          </Card>,
        );

        // notify rep that manager is joining
        const repReply = queueDialer.getReplyCallback(transfer.repAuth.userId);
        if (repReply) {
          try {
            await repReply(
              <Card title={"\uD83D\uDC64 Manager Joining"}>
                <CardText>
                  {`<@${transfer.managerDiscordId}> is joining the call. Customer is on hold.`}
                </CardText>
                <Actions>
                  <Button action={`transfer-complete:${transferId}`}>Complete Transfer</Button>
                  <Button action={`transfer-cancel:${transferId}`}>Cancel Transfer</Button>
                </Actions>
              </Card>,
            );
          } catch {
            // non-fatal
          }
        }
        return;
      }

      // whisper-join:{transferId} — manager accepts whisper
      if (action.startsWith('whisper-join:')) {
        const transferId = action.split(':')[1];
        if (!transferId) return;

        const transfer = transferManager.getTransfer(transferId);
        if (!transfer) {
          await event.reply(errorCard('Whisper session expired or not found.'));
          return;
        }
        if (transfer.status !== 'pending') {
          await event.reply(errorCard(`Whisper session already ${transfer.status}.`));
          return;
        }

        const result = await transferManager.initiateWhisper(transferId);
        if (!result.success) {
          await event.reply(errorCard(result.error ?? 'Failed to start whisper.'));
          return;
        }

        await event.reply(
          <Card title={"\uD83D\uDD07 Whisper Active"}>
            <CardText>
              Your phone is ringing. Answer to listen in (muted).{"\n"}
              The customer and rep cannot hear you.
            </CardText>
          </Card>,
        );

        // notify rep
        const repReply = queueDialer.getReplyCallback(transfer.repAuth.userId);
        if (repReply) {
          try {
            await repReply(
              <Card title={"\uD83D\uDD07 Whisper Active"}>
                <CardText>{`<@${transfer.managerDiscordId}> is now listening in (muted).`}</CardText>
              </Card>,
            );
          } catch {
            // non-fatal
          }
        }
        return;
      }

      // transfer-complete:{transferId} — rep completes warm transfer
      if (action.startsWith('transfer-complete:')) {
        const transferId = action.split(':')[1];
        if (!transferId) return;

        const transfer = transferManager.getTransfer(transferId);
        if (!transfer) {
          await event.reply(errorCard('Transfer not found.'));
          return;
        }

        const result = await transferManager.completeTransfer(transferId);
        if (!result.success) {
          await event.reply(errorCard(result.error ?? 'Failed to complete transfer.'));
          return;
        }

        await event.reply(
          <Card title={"\u2705 Transfer Complete"}>
            <CardText>
              {`You've left the call. <@${transfer.managerDiscordId}> is now speaking with the customer.`}
            </CardText>
          </Card>,
        );
        return;
      }

      // transfer-cancel:{transferId} — rep or manager cancels transfer
      if (action.startsWith('transfer-cancel:')) {
        const transferId = action.split(':')[1];
        if (!transferId) return;

        const transfer = transferManager.getTransfer(transferId);
        if (!transfer) {
          await event.reply(errorCard('Transfer not found.'));
          return;
        }

        if (transfer.status === 'pending') {
          // manager hasn't joined yet — just mark as cancelled
          const t = transferManager.getTransfer(transferId);
          if (t) t.status = 'cancelled';
          await event.reply(
            <Card title={"\u274C Transfer Cancelled"}>
              <CardText>Transfer cancelled before manager joined.</CardText>
            </Card>,
          );
          return;
        }

        const result = await transferManager.cancelTransfer(transferId);
        if (!result.success) {
          await event.reply(errorCard(result.error ?? 'Failed to cancel transfer.'));
          return;
        }

        await event.reply(
          <Card title={"\u274C Transfer Cancelled"}>
            <CardText>
              {`<@${transfer.managerDiscordId}> removed from call. Customer unheld.`}
            </CardText>
          </Card>,
        );
        return;
      }

      // transfer-decline:{transferId} — manager declines
      if (action.startsWith('transfer-decline:')) {
        const transferId = action.split(':')[1];
        if (!transferId) return;

        const transfer = transferManager.getTransfer(transferId);
        if (!transfer) {
          await event.reply(errorCard('Transfer not found.'));
          return;
        }

        const t = transferManager.getTransfer(transferId);
        if (t) t.status = 'declined';

        await event.reply(
          <Card title={"Transfer Declined"}>
            <CardText>You declined the transfer request.</CardText>
          </Card>,
        );

        // notify rep
        const repReply = queueDialer.getReplyCallback(transfer.repAuth.userId);
        if (repReply) {
          try {
            await repReply(
              <Card title={"\u274C Transfer Declined"}>
                <CardText>{`<@${transfer.managerDiscordId}> declined the transfer.`}</CardText>
              </Card>,
            );
          } catch {
            // non-fatal
          }
        }
        return;
      }
    } catch (err: unknown) {
      logger.error('action handler failed', {
        error: err instanceof Error ? err.message : 'unknown',
        action: event.action,
      });
    }
  });

  // capture notes from thread replies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot.onMessage(async (event: any) => { // HACK: chat SDK types unavailable (peer dep)
    try {
      const callId = pendingNotes.get(event.userId);
      if (!callId) return;

      const auth = await getAuth(event.userId);
      if (!auth) return;

      const notes = event.text?.trim();
      if (!notes) return;

      pendingNotes.delete(event.userId);

      try {
        const client = userClient(auth);
        await client.post(`/v1/calls/${callId}/disposition`, { notes });
      } catch (err: unknown) {
        logger.error('notes save failed', {
          error: err instanceof Error ? err.message : 'unknown',
          callId,
        });
        await event.reply(
          <Card title={"\u26A0\uFE0F Error"}>
            <CardText>Failed to save notes. Try again.</CardText>
          </Card>,
        );
        return;
      }

      await event.reply(
        <Card title={"\u2705 Notes Saved"}>
          <CardText>Notes added to call record.</CardText>
        </Card>,
      );
    } catch (err: unknown) {
      logger.error('message handler failed', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  return { bot, Card, CardText, Fields, Field, Actions, Button, queueDialer, channelNotifier, transferManager, postCallCardForUser };
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
