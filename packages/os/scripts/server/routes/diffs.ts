import { Hono } from 'hono';

import { authenticateSignedRequest } from '../middleware/auth';
import { internalError, jsonResponse } from '../middleware/errors';
import {
  DiffsGatewayError,
  loadDiffsCode,
  loadDiffsHistory,
  loadDiffsPullRequest,
  loadDiffsPullRequestIndex,
  mergeDiffsPullRequest,
  mutateDiffsReviewThread,
  readDiffsRepository,
  readDiffsWorkspaceSnapshot,
  renderDiffsCode,
  renderDiffsHistory,
  renderDiffsIndex,
  renderDiffsReview,
} from '../services/diffs-gateway';
import type { AuthenticatedMcpPrincipal } from '../security/authenticated-principal';

const READ_SCOPE = 'route:/gateway/diffs:read';
const WRITE_SCOPE = 'route:/gateway/diffs:write';

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
    },
  });
}

function gatewayError(error: unknown): Response {
  if (error instanceof DiffsGatewayError) {
    return jsonResponse({
      ok: false,
      error: { code: error.code, message: error.message },
    }, error.status);
  }
  return internalError(error);
}

function htmlGatewayError(error: unknown): Response {
  if (error instanceof DiffsGatewayError) {
    const safeMessage = error.message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return htmlResponse(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consuelo Diffs</title></head><body><main><h1>Consuelo Diffs</h1><p>${safeMessage}</p><p><a href="/diffs">Back to Diffs</a></p></main></body></html>`,
      error.status,
    );
  }
  return internalError(error);
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function authenticate(
  request: Request,
  requiredScope: string,
  body = '',
): Promise<AuthenticatedMcpPrincipal | Response> {
  try {
    const path = new URL(request.url).pathname;
    const authentication = await authenticateSignedRequest({
      request,
      path,
      body,
      requiredScope,
    });
    return authentication.ok ? authentication.principal : authentication.response;
  } catch (error: unknown) {
    return internalError(error);
  }
}

function codeQuery(request: Request): { ref: string; path: string } {
  const url = new URL(request.url);
  return {
    ref: url.searchParams.get('ref')?.trim() || 'main',
    path: url.searchParams.get('path')?.replace(/^\/+|\/+$/g, '') ?? '',
  };
}

export function createDiffsRoutes(): Hono {
  const app = new Hono();

  app.get('/gateway/diffs/configuration', async (context) => {
    const request = context.req.raw;
    const principal = await authenticate(request, READ_SCOPE);
    if (principal instanceof Response) return principal;
    try {
      return jsonResponse({ ok: true, snapshot: readDiffsWorkspaceSnapshot({ principal }) });
    } catch (error: unknown) {
      return gatewayError(error);
    }
  });

  app.get('/gateway/diffs/repositories/:owner/:repo', async (context) => {
    const request = context.req.raw;
    const principal = await authenticate(request, READ_SCOPE);
    if (principal instanceof Response) return principal;
    try {
      const repository = readDiffsRepository({
        principal,
        owner: context.req.param('owner'),
        repo: context.req.param('repo'),
      });
      return jsonResponse({ ok: true, repository });
    } catch (error: unknown) {
      return gatewayError(error);
    }
  });

  app.get('/gateway/diffs/repositories/:owner/:repo/pulls', async (context) => {
    const request = context.req.raw;
    const principal = await authenticate(request, READ_SCOPE);
    if (principal instanceof Response) return principal;
    try {
      return jsonResponse(await loadDiffsPullRequestIndex({
        principal,
        owner: context.req.param('owner'),
        repo: context.req.param('repo'),
      }));
    } catch (error: unknown) {
      return gatewayError(error);
    }
  });

  app.get('/gateway/diffs/repositories/:owner/:repo/pull/:number', async (context) => {
    const request = context.req.raw;
    const principal = await authenticate(request, READ_SCOPE);
    if (principal instanceof Response) return principal;
    const number = positiveInteger(context.req.param('number'));
    if (!number) {
      return jsonResponse({ ok: false, error: { code: 'INVALID_PULL_REQUEST', message: 'Pull request number must be a positive integer.' } }, 400);
    }
    try {
      return jsonResponse(await loadDiffsPullRequest({
        principal,
        owner: context.req.param('owner'),
        repo: context.req.param('repo'),
        number,
      }));
    } catch (error: unknown) {
      return gatewayError(error);
    }
  });

  app.get('/gateway/diffs/repositories/:owner/:repo/code', async (context) => {
    const request = context.req.raw;
    const principal = await authenticate(request, READ_SCOPE);
    if (principal instanceof Response) return principal;
    const query = codeQuery(request);
    try {
      return jsonResponse(await loadDiffsCode({
        principal,
        owner: context.req.param('owner'),
        repo: context.req.param('repo'),
        ...query,
      }));
    } catch (error: unknown) {
      return gatewayError(error);
    }
  });

  app.get('/gateway/diffs/repositories/:owner/:repo/history', async (context) => {
    const request = context.req.raw;
    const principal = await authenticate(request, READ_SCOPE);
    if (principal instanceof Response) return principal;
    const query = codeQuery(request);
    try {
      return jsonResponse(await loadDiffsHistory({
        principal,
        owner: context.req.param('owner'),
        repo: context.req.param('repo'),
        ...query,
      }));
    } catch (error: unknown) {
      return gatewayError(error);
    }
  });

  app.post('/gateway/diffs/write/repositories/:owner/:repo/pull/:number/merge', async (context) => {
    const request = context.req.raw;
    const body = await request.clone().text();
    const principal = await authenticate(request, WRITE_SCOPE, body);
    if (principal instanceof Response) return principal;
    const number = positiveInteger(context.req.param('number'));
    if (!number) {
      return jsonResponse({ ok: false, error: { code: 'INVALID_PULL_REQUEST', message: 'Pull request number must be a positive integer.' } }, 400);
    }
    try {
      return jsonResponse(await mergeDiffsPullRequest({
        principal,
        owner: context.req.param('owner'),
        repo: context.req.param('repo'),
        number,
      }));
    } catch (error: unknown) {
      return gatewayError(error);
    }
  });

  app.post('/gateway/diffs/write/repositories/:owner/:repo/pull/:number/review-threads/:threadId/:action', async (context) => {
    const request = context.req.raw;
    const body = await request.clone().text();
    const principal = await authenticate(request, WRITE_SCOPE, body);
    if (principal instanceof Response) return principal;
    const number = positiveInteger(context.req.param('number'));
    const action = context.req.param('action');
    if (!number || (action !== 'resolve' && action !== 'unresolve')) {
      return jsonResponse({ ok: false, error: { code: 'INVALID_REVIEW_THREAD_MUTATION', message: 'Invalid review-thread mutation.' } }, 400);
    }
    try {
      return jsonResponse(await mutateDiffsReviewThread({
        principal,
        owner: context.req.param('owner'),
        repo: context.req.param('repo'),
        number,
        threadId: context.req.param('threadId'),
        action,
      }));
    } catch (error: unknown) {
      return gatewayError(error);
    }
  });

  app.get('/diffs', async (context) => {
    const request = context.req.raw;
    const principal = await authenticate(request, READ_SCOPE);
    if (principal instanceof Response) return principal;
    try {
      return htmlResponse(renderDiffsIndex({ principal }));
    } catch (error: unknown) {
      return htmlGatewayError(error);
    }
  });

  app.get('/diffs/:owner/:repo', async (context) => {
    const request = context.req.raw;
    const principal = await authenticate(request, READ_SCOPE);
    if (principal instanceof Response) return principal;
    try {
      return htmlResponse(renderDiffsIndex({
        principal,
        owner: context.req.param('owner'),
        repo: context.req.param('repo'),
      }));
    } catch (error: unknown) {
      return htmlGatewayError(error);
    }
  });

  app.get('/diffs/:owner/:repo/pull/:number', async (context) => {
    const request = context.req.raw;
    const principal = await authenticate(request, READ_SCOPE);
    if (principal instanceof Response) return principal;
    const number = positiveInteger(context.req.param('number'));
    if (!number) return htmlResponse('<h1>Invalid pull request</h1>', 400);
    try {
      return htmlResponse(renderDiffsReview({
        principal,
        owner: context.req.param('owner'),
        repo: context.req.param('repo'),
        number,
      }));
    } catch (error: unknown) {
      return htmlGatewayError(error);
    }
  });

  for (const route of [
    { path: '/diffs/:owner/:repo/tree/:ref', kind: 'code' as const },
    { path: '/diffs/:owner/:repo/tree/:ref/*', kind: 'code' as const },
    { path: '/diffs/:owner/:repo/history/:ref', kind: 'history' as const },
    { path: '/diffs/:owner/:repo/history/:ref/*', kind: 'history' as const },
  ]) {
    app.get(route.path, async (context) => {
      const request = context.req.raw;
      const principal = await authenticate(request, READ_SCOPE);
      if (principal instanceof Response) return principal;
      const path = context.req.param('*')?.replace(/^\/+|\/+$/g, '') ?? '';
      try {
        const input = {
          principal,
          owner: context.req.param('owner'),
          repo: context.req.param('repo'),
          ref: context.req.param('ref'),
          path,
        };
        return htmlResponse(route.kind === 'code' ? renderDiffsCode(input) : renderDiffsHistory(input));
      } catch (error: unknown) {
        return htmlGatewayError(error);
      }
    });
  }

  return app;
}
