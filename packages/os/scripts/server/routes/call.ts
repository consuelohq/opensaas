import { Hono } from 'hono';

import { resolveToolScope } from '../../lib/security-gateway';
import {
  authPreflight,
  authorizeSignedRequest,
} from '../middleware/auth';
import {
  admitDecodedCallBody,
  admitRawCallBody,
} from '../middleware/dangerous-material';
import {
  internalError,
  invalidRequest,
  jsonResponse,
} from '../middleware/errors';
import {
  executeLocalOsCall,
  parseCallInput,
} from '../services/call-service';

const CALL_PATH = '/call';

export function createCallRoutes(): Hono {
  const app = new Hono();

  app.post(CALL_PATH, async (context) => {
    const request = context.req.raw;
    const body = await request.clone().text();

    const rawMaterialDenied = admitRawCallBody(body);
    if (rawMaterialDenied) return rawMaterialDenied;

    const preflightDenied = authPreflight(request);
    if (preflightDenied) return preflightDenied;

    let input: ReturnType<typeof parseCallInput>;
    try {
      input = parseCallInput(body);
    } catch (error: unknown) {
      return invalidRequest(error);
    }

    const decodedMaterialDenied = admitDecodedCallBody(input);
    if (decodedMaterialDenied) return decodedMaterialDenied;

    const toolScope = resolveToolScope(input.name);
    if (!toolScope.ok) {
      return jsonResponse(
        { ok: false, error: toolScope.error },
        toolScope.status,
      );
    }

    const denied = await authorizeSignedRequest({
      request,
      path: CALL_PATH,
      body,
      requiredScope: toolScope.requiredScope,
    });
    if (denied) return denied;

    try {
      const result = await executeLocalOsCall(input);
      return jsonResponse(result, result.ok ? 200 : 400);
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  return app;
}
