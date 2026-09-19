import { LEAD_CONNECTOR_PARENT_ORIGINS } from './protocol.js';

type AssetsBinding = { fetch: (request: Request) => Promise<Response> };

export type LeadConnectorEdgeEnvironment = {
  ASSETS: AssetsBinding;
  DIALER_SERVER_ORIGIN: string;
  DIALER_EDGE_PROXY_SECRET: string;
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

const isCustomerShellPath = (pathname: string): boolean =>
  pathname.startsWith('/call/') && pathname.length > '/call/'.length;

const STABLE_MARKETPLACE_ASSET_PATHS = new Set([
  '/consuelo-lead-connector-click-to-call.js',
  '/consuelo-lead-connector-click-to-call.css',
]);

const shouldProxy = (pathname: string): boolean =>
  PROXY_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix,
  );

const isPublicCustomerApi = (pathname: string): boolean =>
  pathname.startsWith('/v1/inbound/customer/');

const EDGE_CLIENT_ADDRESS_HEADER = 'x-consuelo-edge-client-address';
const EDGE_CLIENT_TIMESTAMP_HEADER = 'x-consuelo-edge-client-timestamp';
const EDGE_CLIENT_SIGNATURE_HEADER = 'x-consuelo-edge-client-signature';

const edgeIdentitySignature = async (
  request: Request,
  clientAddress: string,
  issuedAt: string,
  secret: string,
): Promise<string> => {
  try {
    const url = new URL(request.url);
    const canonical = [
      'v1',
      issuedAt,
      request.method.toUpperCase(),
      url.pathname + url.search,
      clientAddress,
    ].join('\n');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const raw = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical)),
    );
    return btoa(String.fromCharCode(...raw))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/u, '');
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Edge client identity signing rejected with a non-Error cause', {
      cause,
    });
  }
};

const signedCustomerRequest = async (
  request: Request,
  target: URL,
  environment: LeadConnectorEdgeEnvironment,
  clock: () => number,
): Promise<Request | Response> => {
  const secret = environment.DIALER_EDGE_PROXY_SECRET?.trim() ?? '';
  const clientAddress = request.headers.get('cf-connecting-ip')?.trim() ?? '';
  if (
    secret.length < 24 ||
    !clientAddress ||
    clientAddress.length > 64 ||
    /[\s,]/.test(clientAddress)
  ) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'EDGE_PROXY_UNAVAILABLE',
          message: 'Customer callback service is temporarily unavailable',
          retryable: true,
        },
      }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const issuedAt = String(clock());
  const headers = new Headers(request.headers);
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');
  headers.delete(EDGE_CLIENT_ADDRESS_HEADER);
  headers.delete(EDGE_CLIENT_TIMESTAMP_HEADER);
  headers.delete(EDGE_CLIENT_SIGNATURE_HEADER);
  headers.set(EDGE_CLIENT_ADDRESS_HEADER, clientAddress);
  headers.set(EDGE_CLIENT_TIMESTAMP_HEADER, issuedAt);
  headers.set(
    EDGE_CLIENT_SIGNATURE_HEADER,
    await edgeIdentitySignature(request, clientAddress, issuedAt, secret),
  );
  const proxied = new Request(target, request);
  return new Request(proxied, { headers });
};

type AssetRequest = {
  request: Request;
  applicationShell: boolean;
  customerShell: boolean;
};

const assetRequest = (request: Request): AssetRequest => {
  const source = new URL(request.url);
  if (
    ['GET', 'HEAD'].includes(request.method) &&
    (APPLICATION_SHELL_PATHS.has(source.pathname) ||
      isCustomerShellPath(source.pathname))
  ) {
    const customerShell = isCustomerShellPath(source.pathname);
    source.pathname = '/';
    source.search = '';
    source.searchParams.set('__shell', crypto.randomUUID());
    return {
      request: new Request(source, request),
      applicationShell: true,
      customerShell,
    };
  }
  return { request, applicationShell: false, customerShell: false };
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
  pathname: string,
  customerShell: boolean,
): Response => {
  const headers = new Headers(response.headers);
  if (applicationShell) headers.set('cache-control', 'no-store');
  if (STABLE_MARKETPLACE_ASSET_PATHS.has(pathname)) {
    headers.set('cache-control', 'no-cache, max-age=0, must-revalidate');
  }
  if (customerShell) {
    headers.set('x-frame-options', 'DENY');
    headers.set(
      'content-security-policy',
      "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
    );
    headers.set('permissions-policy', 'microphone=()');
  } else {
    headers.delete('x-frame-options');
    headers.set(
      'content-security-policy',
      `default-src 'self'; connect-src 'self' ${BROWSER_VOICE_CONNECT_SOURCES.join(' ')}; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors ${LEAD_CONNECTOR_PARENT_ORIGINS.join(' ')}`,
    );
    headers.set('permissions-policy', 'microphone=(self)');
  }
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
  clock: () => number = Date.now,
) => ({
  fetch: async (
    request: Request,
    environment: LeadConnectorEdgeEnvironment,
  ): Promise<Response> => {
    try {
      const source = new URL(request.url);
      if (shouldProxy(source.pathname)) {
        const origin = environment.DIALER_SERVER_ORIGIN.trim();
        if (!origin.startsWith('https://')) {
          return new Response('Dialer origin is not configured', { status: 503 });
        }
        const target = originUrl(request, origin);
        const proxied = isPublicCustomerApi(source.pathname)
          ? await signedCustomerRequest(request, target, environment, clock)
          : new Request(target, request);
        if (proxied instanceof Response) return proxied;
        return await fetchOrigin(proxied);
      }
      const asset = assetRequest(request);
      const response = await environment.ASSETS.fetch(asset.request);
      return iframeSafeResponse(
        response,
        asset.applicationShell,
        source.pathname,
        asset.customerShell,
      );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error(
        'LeadConnector edge request rejected with a non-Error cause',
        {
          cause,
        },
      );
    }
  },
});

export default createLeadConnectorEdgeWorker();
