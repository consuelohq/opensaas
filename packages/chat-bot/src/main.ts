import { createServer, type IncomingMessage } from 'node:http';
import { createBot, logger } from './index.js';
import { createApiClient } from './api-client.js';

const HEALTH_PORT = Number(process.env.HEALTH_PORT) || 8080;
const WEBHOOK_PORT = Number(process.env.PORT) || 3100;
const GATEWAY_DURATION_MS = 12 * 60 * 60 * 1000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

const startTime = Date.now();
let gatewayConnected = false;
let shutdownRequested = false;

// api client (dogfooding the opensaas API)
const apiClient = (process.env.CONSUELO_API_URL && process.env.CONSUELO_API_KEY)
  ? createApiClient({
      baseUrl: process.env.CONSUELO_API_URL,
      apiKey: process.env.CONSUELO_API_KEY,
    })
  : null;

if (!apiClient) {
  logger.warn('CONSUELO_API_URL or CONSUELO_API_KEY not set, api client disabled');
}

function backoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function toWebRequest(req: IncomingMessage, body: Buffer, port: number): Request {
  const url = `http://localhost:${port}${req.url ?? '/'}`;
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
    const { bot, queueDialer } = await createBot();
    await bot.initialize();
    logger.info('bot initialized');

    // start auto-dial loop (redis pub/sub for call events)
    queueDialer.startCallEventListener().catch((err: unknown) => {
      logger.error('auto-dial listener failed to start', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    });

    // webhook server for discord interactions
    const webhookServer = createServer(async (req, res) => {
      try {
        if (req.method === 'POST' && req.url === '/api/webhooks/discord') {
          const body = await readBody(req);
          const webReq = toWebRequest(req, body, WEBHOOK_PORT);
          const webRes = await bot.webhooks.discord(webReq, {
            waitUntil: (task: Promise<unknown>) => { task.catch(() => {}); },
          });
          res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
          const resBody = await webRes.text();
          res.end(resBody);
          return;
        }
        res.writeHead(404);
        res.end('not found');
      } catch (err: unknown) {
        logger.error('webhook handler failed', {
          error: err instanceof Error ? err.message : 'unknown',
          url: req.url,
        });
        res.writeHead(500);
        res.end('internal server error');
      }
    });

    webhookServer.listen(WEBHOOK_PORT, () => {
      logger.info('webhook server listening', { port: WEBHOOK_PORT });
    });

    // /healthz endpoint on separate port for railway health checks
    const healthServer = createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          gateway: gatewayConnected ? 'connected' : 'disconnected',
          uptime: Math.floor((Date.now() - startTime) / 1000),
        }));
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });

    healthServer.listen(HEALTH_PORT, () => {
      logger.info('health server listening', { port: HEALTH_PORT });
    });

    // gateway lifecycle with exponential backoff + heartbeat monitoring
    const discord = bot.getAdapter('discord');
    if (discord) {
      const webhookUrl = `http://localhost:${WEBHOOK_PORT}/api/webhooks/discord`;
      let attempt = 0;

      const runGateway = async () => {
        while (!shutdownRequested) {
          try {
            logger.info('starting gateway', { attempt });
            gatewayConnected = true;

            let gatewayTask: Promise<unknown> | null = null;
            discord.startGatewayListener(
              { waitUntil: (task: Promise<unknown>) => { gatewayTask = task; } },
              GATEWAY_DURATION_MS,
              undefined,
              webhookUrl,
            );

            // heartbeat monitor: force reconnect if no activity in 60s
            const heartbeatCheck = new Promise<void>((_, reject) => {
              const timer = setInterval(() => {
                if (shutdownRequested) {
                  clearInterval(timer);
                  reject(new Error('shutdown'));
                }
              }, HEARTBEAT_TIMEOUT_MS);
              // clear interval when gateway task resolves
              if (gatewayTask) {
                gatewayTask.then(() => clearInterval(timer)).catch(() => clearInterval(timer));
              }
            });

            if (gatewayTask) {
              await Promise.race([gatewayTask, heartbeatCheck]);
            }

            // gateway ended normally, reset backoff
            attempt = 0;
            gatewayConnected = false;
            logger.info('gateway session ended, reconnecting');
          } catch (err: unknown) {
            gatewayConnected = false;
            if (shutdownRequested) break;
            const delay = backoffDelay(attempt);
            logger.error('gateway error, reconnecting', {
              error: err instanceof Error ? err.message : 'unknown',
              attempt,
              delay,
            });
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
          }
        }
      };

      runGateway().catch(() => {});
    }

    // graceful shutdown
    const shutdown = async () => {
      if (shutdownRequested) return;
      shutdownRequested = true;
      logger.info('shutting down gracefully');

      // close gateway
      gatewayConnected = false;

      // stop queue dialer redis subscriber
      await queueDialer.stop();

      // close servers
      await new Promise<void>((resolve) => webhookServer.close(() => resolve()));
      await new Promise<void>((resolve) => healthServer.close(() => resolve()));

      logger.info('shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => { shutdown().catch(() => process.exit(1)); });
    process.on('SIGINT', () => { shutdown().catch(() => process.exit(1)); });
  } catch (err: unknown) {
    logger.error('failed to start bot', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    process.exit(1);
  }
}

main();
