import { Hono } from 'hono';

import { authorizeSignedRequest } from '../middleware/auth';
import { internalError, textResponse } from '../middleware/errors';
import { routeNotFoundResponse } from '../middleware/fallback';
import { readLocalOsSteering } from '../services/steering-service';

const STEERING_PATH = '/get_steering';

async function handleSteeringRequest(request: Request): Promise<Response> {
  try {
    const body = request.method === 'GET' ? '' : await request.clone().text();
    const denied = await authorizeSignedRequest({
      request,
      path: STEERING_PATH,
      body,
      requiredScope: 'route:/get_steering:read',
    });
    if (denied) return denied;
    return textResponse(await readLocalOsSteering());
  } catch (error: unknown) {
    return internalError(error);
  }
}

export function createSteeringRoutes(): Hono {
  const app = new Hono();
  app.all(STEERING_PATH, (context) => {
    if (context.req.method !== 'GET' && context.req.method !== 'POST') {
      return routeNotFoundResponse();
    }
    return handleSteeringRequest(context.req.raw);
  });
  return app;
}
