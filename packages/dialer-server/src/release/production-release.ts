export type DialerProductionSmokeCheck = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  expectedStatus: number;
  actualStatus: number;
  ok: boolean;
};

export type DialerProductionSmokeResult = {
  ok: boolean;
  checks: DialerProductionSmokeCheck[];
};

type ReleaseFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type RailwayDeploymentSummary = { id: string; status: string };

export const parseRailwayDeploymentList = (
  text: string,
): RailwayDeploymentSummary[] => {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) {
    throw new Error('Railway deployment list must be an array');
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Railway deployment list entry is invalid');
    }
    const id =
      'id' in entry && typeof entry.id === 'string' ? entry.id.trim() : '';
    const status =
      'status' in entry && typeof entry.status === 'string'
        ? entry.status.trim().toUpperCase()
        : '';
    if (!id || !status) {
      throw new Error('Railway deployment list entry is missing id or status');
    }
    return { id, status };
  });
};

export const selectNewRailwayDeployment = (
  deployments: RailwayDeploymentSummary[],
  previousDeploymentId: string,
): RailwayDeploymentSummary | null =>
  deployments.find(({ id }) => id !== previousDeploymentId) ?? null;

const smokeChecks = [
  { name: 'health', method: 'GET', path: '/health', expectedStatus: 200 },
  {
    name: 'commercial-admin-auth',
    method: 'GET',
    path: '/v1/commercial/admin',
    expectedStatus: 401,
  },
  {
    name: 'commercial-caller-auth',
    method: 'GET',
    path: '/v1/commercial/caller',
    expectedStatus: 401,
  },
  {
    name: 'twilio-signature',
    method: 'POST',
    path: '/webhooks/twilio/status',
    expectedStatus: 401,
  },
  {
    name: 'stripe-signature',
    method: 'POST',
    path: '/v1/webhooks/stripe',
    expectedStatus: 401,
  },
  {
    name: 'leadconnector-signature',
    method: 'POST',
    path: '/v1/webhooks/leadconnector',
    expectedStatus: 401,
  },
] as const;

export const runDialerProductionSmoke = async (
  input: { baseUrl: string },
  fetcher: ReleaseFetch = fetch,
): Promise<DialerProductionSmokeResult> => {
  try {
    const baseUrl = new URL(input.baseUrl);
    if (baseUrl.protocol !== 'https:') {
      throw new Error('Dialer production origin must use HTTPS');
    }
    const checks: DialerProductionSmokeCheck[] = [];
    for (const check of smokeChecks) {
      const response = await fetcher(new URL(check.path, baseUrl), {
        method: check.method,
        ...(check.method === 'POST'
          ? { headers: { 'content-type': 'application/json' }, body: '{}' }
          : {}),
      });
      checks.push({
        ...check,
        actualStatus: response.status,
        ok: response.status === check.expectedStatus,
      });
    }
    return { ok: checks.every((check) => check.ok), checks };
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Dialer production smoke failed', { cause });
  }
};

export type DialerReleaseManifest = {
  gitSha: string;
  railway: { deploymentId: string; status: string };
  cloudflare: { versionId: string; buildMarker: string };
  assets: { javascriptSha256: string; cssSha256: string };
  launcherBootstrap: { sha256: string; installationMode: 'one-time' };
  smoke: DialerProductionSmokeResult;
};

export const buildDialerReleaseManifest = (
  input: DialerReleaseManifest,
): DialerReleaseManifest => {
  if (input.railway.status !== 'SUCCESS') {
    throw new Error(
      'Dialer release manifest requires a successful Railway deployment',
    );
  }
  if (!/^[a-f0-9]{64}$/.test(input.launcherBootstrap.sha256)) {
    throw new Error(
      'Dialer release manifest requires a valid launcher bootstrap SHA-256',
    );
  }
  if (input.launcherBootstrap.installationMode !== 'one-time') {
    throw new Error(
      'Dialer release manifest requires one-time launcher bootstrap evidence',
    );
  }
  if (!input.smoke.ok) {
    throw new Error(
      'Dialer release manifest requires passing production smoke',
    );
  }
  return structuredClone(input);
};

export const rollbackRailwayDeployment = async (
  input: { projectToken: string; deploymentId: string },
  fetcher: ReleaseFetch = fetch,
): Promise<{ deploymentId: string }> => {
  const projectToken = input.projectToken.trim();
  const deploymentId = input.deploymentId.trim();
  if (!projectToken || !deploymentId) {
    throw new Error('Railway project token and deployment ID are required');
  }
  const query =
    'mutation deploymentRollback($id: String!) { deploymentRollback(id: $id) { id } }';
  const response = await fetcher('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Project-Access-Token': projectToken,
    },
    body: JSON.stringify({ query, variables: { id: deploymentId } }),
  });
  const body = (await response.json().catch(() => null)) as {
    data?: { deploymentRollback?: { id?: string } };
    errors?: unknown;
  } | null;
  const rolledBackId = body?.data?.deploymentRollback?.id?.trim();
  if (!response.ok || !rolledBackId) {
    throw new Error(`Railway deployment rollback failed (${response.status})`);
  }
  return { deploymentId: rolledBackId };
};
