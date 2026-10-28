import { Hono } from 'hono';

import {
  TRACE_SITE_CSS,
  TRACE_SITE_JAVASCRIPT,
  renderTraceSite,
} from '../../lib/trace-site';
import type { TraceSitesGatewayLiveEndpoints } from '../../lib/trace-sites-gateway-live-endpoints';
import {
  authorizeSignedRequest,
  loadAuthConfigForRequest,
} from '../middleware/auth';
import { internalError, jsonResponse } from '../middleware/errors';
import { routeNotFoundResponse } from '../middleware/fallback';
import { traceGatewayEndpoints } from '../services/trace-gateway';

const TRACE_READ_PATHS = [
  '/gateway/traces/recent',
  '/gateway/traces/summary',
  '/gateway/traces/aggregates',
  '/gateway/traces/events',
] as const;

const TRACE_DOCUMENT_PATH = '/traces';
const TRACE_CSS_PATH = '/traces/assets/trace.css';
const TRACE_JAVASCRIPT_PATH = '/traces/assets/trace.js';
const TRACE_READ_SCOPE = 'route:/gateway/traces:read';

type TraceRequestScope = {
  workspaceId: string;
  workspaceHost: string;
  nodeId: string;
};

export type TraceRouteOptions = {
  endpoints?: TraceSitesGatewayLiveEndpoints;
};

function traceRequestScope(request: Request): TraceRequestScope | Response {
  const config = loadAuthConfigForRequest();
  const workspaceId = request.headers.get('x-consuelo-workspace-id')?.trim();
  const signedNodeId = request.headers.get('x-consuelo-device-id')?.trim();
  const selectedNodeId =
    request.headers.get('x-consuelo-node-id')?.trim() || signedNodeId;

  if (!workspaceId || workspaceId !== config.workspaceId) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'WORKSPACE_SCOPE_MISMATCH',
          message: 'The authenticated workspace does not match this local OS runtime.',
        },
      },
      403,
    );
  }
  if (!signedNodeId || !selectedNodeId) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'WORKSPACE_NODE_REQUIRED',
          message: 'A selected workspace node is required for trace reads.',
        },
      },
      409,
    );
  }
  if (selectedNodeId !== signedNodeId) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'WORKSPACE_NODE_MISMATCH',
          message: 'The selected workspace node does not match this local OS runtime.',
        },
      },
      409,
    );
  }

  return {
    workspaceId: config.workspaceId,
    workspaceHost: config.workspaceHost,
    nodeId: selectedNodeId,
  };
}

async function authorizeTraceRequest(
  request: Request,
  path: string,
): Promise<TraceRequestScope | Response> {
  try {
    const denied = await authorizeSignedRequest({
      request,
      path,
      body: '',
      requiredScope: TRACE_READ_SCOPE,
    });
    if (denied) return denied;
    return traceRequestScope(request);
  } catch (error: unknown) {
    return internalError(error);
  }
}

function privateTraceHeaders(contentType: string): HeadersInit {
  return {
    'cache-control': 'private, no-store',
    'content-type': contentType,
    vary: 'x-consuelo-workspace-id, x-consuelo-node-id, x-consuelo-device-id',
    'x-content-type-options': 'nosniff',
  };
}

function withPrivateTraceHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set(
    'vary',
    'x-consuelo-workspace-id, x-consuelo-node-id, x-consuelo-device-id',
  );
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function invariantAssetHeaders(contentType: string): HeadersInit {
  return {
    'cache-control': 'public, max-age=31536000, immutable',
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
  };
}

async function handleTraceRequest(
  request: Request,
  endpoints: TraceSitesGatewayLiveEndpoints,
): Promise<Response> {
  try {
    const pathname = new URL(request.url).pathname;
    const scope = await authorizeTraceRequest(request, pathname);
    if (scope instanceof Response) return withPrivateTraceHeaders(scope);

    const headers = new Headers(request.headers);
    headers.set('x-consuelo-workspace-id', scope.workspaceId);
    headers.set('x-consuelo-workspace-host', scope.workspaceHost);
    headers.set('x-consuelo-node-id', scope.nodeId);
    const response = await endpoints.handle(
      new Request(request, { headers }),
    );
    return withPrivateTraceHeaders(response);
  } catch (error: unknown) {
    return internalError(error);
  }
}

export function createTraceRoutes(options: TraceRouteOptions = {}): Hono {
  const app = new Hono();
  const endpoints = options.endpoints ?? traceGatewayEndpoints();

  app.all(TRACE_DOCUMENT_PATH, async (context) => {
    if (context.req.method !== 'GET') return routeNotFoundResponse();
    try {
      const scope = await authorizeTraceRequest(
        context.req.raw,
        TRACE_DOCUMENT_PATH,
      );
      if (scope instanceof Response) return withPrivateTraceHeaders(scope);
      return new Response(
        renderTraceSite({
          workspaceId: scope.workspaceId,
          workspaceHost: scope.workspaceHost,
          nodeId: scope.nodeId,
          assetMode: 'hono',
        }),
        {
          status: 200,
          headers: privateTraceHeaders('text/html; charset=utf-8'),
        },
      );
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.all(TRACE_CSS_PATH, async (context) => {
    if (context.req.method !== 'GET') return routeNotFoundResponse();
    try {
      const scope = await authorizeTraceRequest(context.req.raw, TRACE_CSS_PATH);
      if (scope instanceof Response) return withPrivateTraceHeaders(scope);
      return new Response(TRACE_SITE_CSS, {
        status: 200,
        headers: invariantAssetHeaders('text/css; charset=utf-8'),
      });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.all(TRACE_JAVASCRIPT_PATH, async (context) => {
    if (context.req.method !== 'GET') return routeNotFoundResponse();
    try {
      const scope = await authorizeTraceRequest(
        context.req.raw,
        TRACE_JAVASCRIPT_PATH,
      );
      if (scope instanceof Response) return withPrivateTraceHeaders(scope);
      return new Response(TRACE_SITE_JAVASCRIPT, {
        status: 200,
        headers: invariantAssetHeaders('text/javascript; charset=utf-8'),
      });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  for (const path of TRACE_READ_PATHS) {
    app.all(path, (context) => {
      if (context.req.method !== 'GET') return routeNotFoundResponse();
      return handleTraceRequest(context.req.raw, endpoints);
    });
  }
  return app;
}
