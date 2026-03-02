import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

const REDIS_KEY_PREFIX = 'consuelo:discord:user:';

// lazy redis client with error recovery
let redisClient: import('ioredis').default | null = null;

async function getRedis(): Promise<import('ioredis').default> {
  try {
    if (!redisClient) {
      const { default: Redis } = await import('ioredis');
      redisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    }
    return redisClient;
  } catch (err: unknown) {
    redisClient = null;
    throw err;
  }
}

// minimal HTML form for MVP — full OAuth2 flow comes in phase 7
function authFormHtml(discordUserId: string): string {
  return `<!DOCTYPE html>
<html><head><title>Link Discord to Consuelo</title>
<style>body{font-family:system-ui;max-width:400px;margin:80px auto;padding:0 16px}
input{width:100%;padding:8px;margin:4px 0 12px;box-sizing:border-box}
button{padding:10px 20px;background:#5865F2;color:#fff;border:none;border-radius:4px;cursor:pointer}</style>
</head><body>
<h2>Link Discord Account</h2>
<form method="POST" action="/v1/auth/discord">
<input type="hidden" name="discord_user_id" value="${discordUserId}"/>
<label>Workspace ID<input type="text" name="workspace_id" required/></label>
<label>User ID<input type="text" name="user_id" required/></label>
<label>API Key<input type="password" name="api_key" required/></label>
<button type="submit">Link Account</button>
</form></body></html>`;
}

export function discordAuthRoutes(): RouteDefinition[] {
  return [
    {
      method: 'GET',
      path: '/v1/auth/discord',
      auth: false,
      handler: errorHandler(async (req, res) => {
        const discordUserId = req.query?.discord_user_id;
        if (!discordUserId) {
          res.status(400).json({
            error: { code: 'bad_request', message: 'missing discord_user_id' },
          });
          return;
        }
        res.type('text/html').send(authFormHtml(discordUserId));
      }),
    },
    {
      method: 'POST',
      path: '/v1/auth/discord',
      auth: false,
      handler: errorHandler(async (req, res) => {
        const body = req.body as Record<string, unknown> | undefined;
        const discordUserId = typeof body?.discord_user_id === 'string' ? body.discord_user_id : '';
        const workspaceId = typeof body?.workspace_id === 'string' ? body.workspace_id : '';
        const userId = typeof body?.user_id === 'string' ? body.user_id : '';
        const apiKey = typeof body?.api_key === 'string' ? body.api_key : '';

        if (!discordUserId || !workspaceId || !userId || !apiKey) {
          res.status(400).json({
            error: { code: 'bad_request', message: 'missing required fields' },
          });
          return;
        }

        const redis = await getRedis();
        const value = JSON.stringify({
          workspaceId,
          userId,
          apiKey,
          linkedAt: new Date().toISOString(),
        });
        await redis.set(`${REDIS_KEY_PREFIX}${discordUserId}`, value);

        res.type('text/html').send(
          '<!DOCTYPE html><html><body style="font-family:system-ui;text-align:center;margin-top:80px">' +
          '<h2>\u2705 Account Linked</h2><p>You can close this window and return to Discord.</p></body></html>',
        );
      }),
    },
  ];
}
