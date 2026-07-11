import { Hono } from 'hono';

import type { LocalOsServerConfig } from '../env';
import { jsonResponse } from '../middleware/errors';

export function createHealthRoutes(config: LocalOsServerConfig): Hono {
  const app = new Hono();

  app.all('/health', () => jsonResponse({
    status: 'ok',
    name: config.name,
    runtime: 'bun',
    toolNames: ['get_steering', 'call'],
    tools: 2,
    protocols: ['mcp'],
    endpoints: ['/mcp'],
    port: config.port,
  }));

  return app;
}
