/** @jsxImportSource chat */
import { createLogger } from '@consuelo/logger';

const logger = createLogger('chat-bot');

export { logger };

export async function createBot() {
  const { Chat, Card, CardText, Fields, Field } = await import('chat');
  const { createDiscordAdapter } = await import('@chat-adapter/discord');
  const { createRedisState } = await import('@chat-adapter/state-redis');

  const bot = new Chat({
    userName: 'consuelo',
    adapters: { discord: createDiscordAdapter() },
    state: createRedisState({ url: process.env.REDIS_URL }),
  });

  bot.onSlashCommand('/consuelo', async (event) => {
    try {
      if (event.text.trim() === 'ping') {
        const uptime = formatUptime(Date.now() - startTime);
        await event.channel.post(
          <Card title={"\u{1F3D3} Pong!"}>
            <Fields>
              <Field label="Version" value={VERSION} />
              <Field label="Uptime" value={uptime} />
              <Field label="Status" value="Online" />
            </Fields>
          </Card>
        );
      }
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
