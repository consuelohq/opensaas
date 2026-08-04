import { LEAD_CONNECTOR_PARENT_ORIGINS } from './protocol.js';

type AssetsBinding = { fetch: (request: Request) => Promise<Response> };

export type LeadConnectorEdgeEnvironment = {
  ASSETS: AssetsBinding;
  DIALER_SERVER_ORIGIN: string;
};

export type LeadConnectorEdgeFetch = (request: Request) => Promise<Response>;

const BROWSER_VOICE_CONNECT_SOURCES = [
  'https://*.twilio.com',
  'wss://*.twilio.com',
] as const;

const PROXY_PREFIXES = [
  '/v1/',
  '/webhooks/',
  '/integrations/',
  '/health',
] as const;

const APPLICATION_SHELL_PATHS = new Set([
  '/',
  '/admin',
  '/admin/',
  '/overlay',
  '/overlay/',
]);

const shouldProxy = (pathname: string): boolean =>
  PROXY_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix,
  );

type AssetRequest = {
  request: Request;
  applicationShell: boolean;
};

const assetRequest = (request: Request): AssetRequest => {
  const source = new URL(request.url);
  if (
    ['GET', 'HEAD'].includes(request.method) &&
    APPLICATION_SHELL_PATHS.has(source.pathname)
  ) {
    source.pathname = '/';
    source.search = '';
    source.searchParams.set('__shell', crypto.randomUUID());
    return {
      request: new Request(source, request),
      applicationShell: true,
    };
  }
  return { request, applicationShell: false };
};

const originUrl = (request: Request, origin: string): URL => {
  const source = new URL(request.url);
  const target = new URL(origin);
  target.pathname = source.pathname;
  target.search = source.search;
  return target;
};

const iframeSafeResponse = (
  response: Response,
  applicationShell: boolean,
): Response => {
  const headers = new Headers(response.headers);
  if (applicationShell) headers.set('cache-control', 'no-store');
  headers.delete('x-frame-options');
  headers.set(
    'content-security-policy',
    `default-src 'self'; connect-src 'self' ${BROWSER_VOICE_CONNECT_SOURCES.join(' ')}; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors ${LEAD_CONNECTOR_PARENT_ORIGINS.join(' ')}`,
  );
  headers.set('permissions-policy', 'microphone=(self)');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const createLeadConnectorEdgeWorker = (
  fetchOrigin: LeadConnectorEdgeFetch = fetch,
) => ({
  fetch: (
    request: Request,
    environment: LeadConnectorEdgeEnvironment,
  ): Promise<Response> => {
    const source = new URL(request.url);
    if (shouldProxy(source.pathname)) {
      const origin = environment.DIALER_SERVER_ORIGIN.trim();
      if (!origin.startsWith('https://')) {
        return Promise.resolve(
          new Response('Dialer origin is not configured', { status: 503 }),
        );
      }
      const target = originUrl(request, origin);
      const proxied = new Request(target, request);
      return fetchOrigin(proxied);
    }
    const asset = assetRequest(request);
    return environment.ASSETS.fetch(asset.request).then((response) =>
      iframeSafeResponse(response, asset.applicationShell),
    );
  },
});

export default createLeadConnectorEdgeWorker();
