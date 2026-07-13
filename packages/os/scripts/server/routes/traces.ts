import { Hono } from 'hono';

import { authorizeSignedRequest } from '../middleware/auth';
import { internalError } from '../middleware/errors';
import { routeNotFoundResponse } from '../middleware/fallback';
import { traceGatewayEndpoints } from '../services/trace-gateway';

const TRACE_READ_PATHS = [
  '/gateway/traces/recent',
  '/gateway/traces/summary',
  '/gateway/traces/aggregates',
  '/gateway/traces/events',
] as const;

async function handleTraceRequest(request: Request): Promise<Response> {
  try {
    const pathname = new URL(request.url).pathname;
    const denied = await authorizeSignedRequest({
      request,
      path: pathname,
      body: '',
      requiredScope: 'route:/gateway/traces:read',
    });
    if (denied) return denied;
    return traceGatewayEndpoints().handle(request);
  } catch (error: unknown) {
    return internalError(error);
  }
}

export function createTraceRoutes(): Hono {
  const app = new Hono();
  for (const path of TRACE_READ_PATHS) {
    app.all(path, (context) => {
      if (context.req.method !== 'GET') return routeNotFoundResponse();
      return handleTraceRequest(context.req.raw);
    });
  }
  return app;
}
