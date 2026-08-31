import { createHash } from 'node:crypto';

export type LeadConnectorWorkerDeploymentEvidence = {
  workerName: string;
  versionId: string;
  targets: string[];
};

export const parseWranglerDeploymentOutput = (
  text: string,
): LeadConnectorWorkerDeploymentEvidence => {
  const records = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const deploy = [...records]
    .reverse()
    .find((record) => record.type === 'deploy');
  const workerName =
    typeof deploy?.worker_name === 'string' ? deploy.worker_name.trim() : '';
  const versionId =
    typeof deploy?.version_id === 'string' ? deploy.version_id.trim() : '';
  const targets = Array.isArray(deploy?.targets)
    ? deploy.targets.filter(
        (value): value is string => typeof value === 'string',
      )
    : [];
  if (!workerName || !versionId) {
    throw new Error('Wrangler deploy output did not include a Worker version');
  }
  return { workerName, versionId, targets };
};

type ReleaseFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const sha256 = (value: Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

export type LeadConnectorProductionEdgeResult = {
  ok: boolean;
  routes: Array<{ path: string; status: number; ok: boolean }>;
  javascriptSha256: string;
  cssSha256: string;
};

export const verifyLeadConnectorProductionEdge = async (
  input: {
    baseUrl: string;
    javascriptSha256: string;
    cssSha256: string;
  },
  fetcher: ReleaseFetch = fetch,
): Promise<LeadConnectorProductionEdgeResult> => {
  try {
    const base = new URL(input.baseUrl);
    if (base.protocol !== 'https:') {
      throw new Error('LeadConnector production edge must use HTTPS');
    }
    const routes: LeadConnectorProductionEdgeResult['routes'] = [];
    for (const path of ['/', '/admin', '/overlay']) {
      const response = await fetcher(new URL(path, base));
      const cacheControl = response.headers.get('cache-control') ?? '';
      const csp = response.headers.get('content-security-policy') ?? '';
      const permissions = response.headers.get('permissions-policy') ?? '';
      const ok =
        response.status === 200 &&
        cacheControl.includes('no-store') &&
        csp.includes('frame-ancestors') &&
        permissions.includes('microphone');
      routes.push({ path, status: response.status, ok });
    }

    const health = await fetcher(new URL('/health', base));
    routes.push({
      path: '/health',
      status: health.status,
      ok: health.status === 200,
    });

    const javascriptResponse = await fetcher(
      new URL('/consuelo-lead-connector-click-to-call.js', base),
    );
    const cssResponse = await fetcher(
      new URL('/consuelo-lead-connector-click-to-call.css', base),
    );
    const javascriptSha256 = sha256(
      new Uint8Array(await javascriptResponse.arrayBuffer()),
    );
    const cssSha256 = sha256(new Uint8Array(await cssResponse.arrayBuffer()));
    const assetsOk =
      javascriptResponse.status === 200 &&
      cssResponse.status === 200 &&
      javascriptSha256 === input.javascriptSha256 &&
      cssSha256 === input.cssSha256;

    return {
      ok: routes.every((route) => route.ok) && assetsOk,
      routes,
      javascriptSha256,
      cssSha256,
    };
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('LeadConnector production edge verification failed', {
      cause,
    });
  }
};
