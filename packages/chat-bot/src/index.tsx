/** @jsxImportSource chat */
import { createServer, type IncomingMessage } from 'node:http';
import { createLogger } from '@consuelo/logger';

const logger = createLogger('chat-bot');
const startTime = Date.now();
const VERSION = '0.0.1';
const PORT = Number(process.env.PORT) || 3100;

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

async function createBot() {
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
          <Card title="\u{1F3D3} Pong!">
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

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function toWebRequest(req: IncomingMessage, body: Buffer): Request {
  const url = `http://localhost:${PORT}${req.url ?? '/'}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return new Request(url, {
    method: req.method ?? 'GET',
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
  });
}

async function main() {
  try {
    const { bot } = await createBot();
    await bot.initialize();
    logger.info('bot initialized');

    const server = createServer(async (req, res) => {
      try {
        if (req.method === 'POST' && req.url === '/api/webhooks/discord') {
          const body = await readBody(req);
          const webReq = toWebRequest(req, body);
          const webRes = await bot.webhooks.discord(webReq, {
            waitUntil: (task: Promise<unknown>) => { task.catch(() => {}); },
          });
          res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
          const resBody = await webRes.text();
          res.end(resBody);
          return;
        }

        if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', uptime: formatUptime(Date.now() - startTime) }));
          return;
        }

        res.writeHead(404);
        res.end('not found');
      } catch (err: unknown) {
        logger.error('request handler failed', {
          error: err instanceof Error ? err.message : 'unknown',
          url: req.url,
        });
        res.writeHead(500);
        res.end('internal server error');
      }
    });

    server.listen(PORT, () => {
      logger.info(`listening on port ${PORT}`);
    });

    // start gateway — persistent websocket for message events
    const discord = bot.getAdapter('discord');
    if (discord) {
      const webhookUrl = `http://localhost:${PORT}/api/webhooks/discord`;
      const durationMs = 12 * 60 * 60 * 1000; // 12 hours

      const runGateway = async () => {
        while (true) {
          try {
            logger.info('starting gateway listener');
            let gatewayTask: Promise<unknown> | null = null;
            discord.startGatewayListener(
              { waitUntil: (task: Promise<unknown>) => { gatewayTask = task; } },
              durationMs,
              undefined,
              webhookUrl,
            );
            if (gatewayTask) await gatewayTask;
            logger.info('gateway listener ended, restarting');
          } catch (err: unknown) {
            logger.error('gateway error', {
              error: err instanceof Error ? err.message : 'unknown',
            });
          }
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      };

      runGateway().catch(() => {});
    }
  } catch (err: unknown) {
    logger.error('failed to start bot', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    process.exit(1);
  }
}

main();
