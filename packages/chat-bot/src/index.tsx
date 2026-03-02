/** @jsxImportSource chat */
import { createLogger } from '@consuelo/logger';
import { getAuth, removeAuth } from './auth.js';
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

  const bot = new Chat({
    userName: 'consuelo',
    adapters: { discord: createDiscordAdapter() },
    state: createRedisState({ url: process.env.REDIS_URL }),
  });

  bot.onSlashCommand('/consuelo', async (event) => {
    try {
      const subcommand = event.text.trim().split(/\s+/)[0] ?? '';

      // login — no auth required
      if (subcommand === 'login') {
        const authUrl = `${apiUrl}/v1/auth/discord?discord_user_id=${event.userId}`;
        await event.reply(
          <Card title={"\u{1F517} Link Your Account"}>
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
          ? '\u{2705} Logged out. Your workspace link has been removed.'
          : 'You were not linked to any workspace.';
        await event.reply(
          <Card title={"\u{1F44B} Logout"}>
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
          <Card title={"\u{1F512} Not Linked"}>
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
          <Card title={"\u{1F3D3} Pong!"}>
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

      // unknown subcommand
      await event.reply(
        <Card title={"Consuelo"}>
          <CardText>
            Available commands: login, logout, ping
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

  return { bot, Card, CardText, Fields, Field };
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
