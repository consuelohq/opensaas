import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import {
  provisionLocalOs,
  type ProvisionOptions,
  type WorkspaceBootstrap,
} from './install-state';
import {
  generateWorkspaceDeviceKeyPair,
  pollWorkspaceDeviceAccessToken,
  requestWorkspaceDeviceCode,
  type DeviceAccessTokenPollResult,
  type DeviceCodeRequestResult,
  type WorkspaceDeviceKeyPair,
} from './workspace-device-login-client';

export const MANAGED_CLOUD_NODE_DEVICE_CLIENT_ID = 'consuelo-os-installer';
export const MANAGED_CLOUD_NODE_DEVICE_SCOPE = [
  'workspace:read',
  'os:connector:register',
] as const;

export type ManagedCloudNodeOnboarding = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  authorityOrigin?: string;
};

type ApprovedDeviceGrant = Extract<
  DeviceAccessTokenPollResult,
  { status: 'approved' }
>;

export type ManagedCloudNodeEnrollmentStatus =
  | {
      schemaVersion: 1;
      phase: 'awaiting_authorization';
      userCode: string;
      verificationUri: string;
      expiresAt: string;
      workspaceSlug: string;
      nodeId: string;
    }
  | {
      schemaVersion: 1;
      phase: 'enrolled';
      workspaceId: string;
      workspaceSlug: string;
      nodeId: string;
      connectorId: string;
    }
  | {
      schemaVersion: 1;
      phase: 'failed';
      errorCode: string;
      message: string;
      workspaceSlug: string;
      nodeId: string;
    };

export type ManagedCloudNodeEnrollmentDependencies = {
  loadOrCreateDeviceKeyPair: (input: {
    home: string;
    nodeId: string;
  }) => WorkspaceDeviceKeyPair;
  requestDeviceCode: (input: {
    clientId: string;
    scope: string[];
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    workspaceHost: string;
    nodeId: string;
    nodeName: string;
    deviceKeyPair: WorkspaceDeviceKeyPair;
  }) => Promise<DeviceCodeRequestResult>;
  pollAccessToken: (input: {
    clientId: string;
    deviceCode: string;
    intervalSeconds: number;
    deviceKeyPair: WorkspaceDeviceKeyPair;
  }) => Promise<DeviceAccessTokenPollResult>;
  provision: (input: ProvisionOptions) => unknown;
  activateHeartbeat: (input: {
    home: string;
    connectorId: string;
  }) => Promise<void>;
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  writeStatus: (status: ManagedCloudNodeEnrollmentStatus) => void;
};

class ManagedCloudNodeEnrollmentError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ManagedCloudNodeEnrollmentError';
    this.code = code;
  }
}

type StoredManagedCloudNodeDeviceKeyPair = {
  schemaVersion: 1;
  nodeId: string;
  deviceKeyPair: WorkspaceDeviceKeyPair;
};

const assertManagedCloudNodeDeviceKeyPair = (
  value: unknown,
  expectedNodeId: string,
): WorkspaceDeviceKeyPair => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ManagedCloudNodeEnrollmentError(
      'DEVICE_KEY_INVALID',
      'managed cloud node device key must be an object',
    );
  }
  const record = value as Partial<StoredManagedCloudNodeDeviceKeyPair>;
  const pair = record.deviceKeyPair;
  if (
    record.schemaVersion !== 1 ||
    record.nodeId !== expectedNodeId ||
    !pair ||
    pair.algorithm !== 'Ed25519' ||
    typeof pair.publicKeyJwk !== 'string' ||
    typeof pair.signingKeyJwk !== 'string'
  ) {
    throw new ManagedCloudNodeEnrollmentError(
      'DEVICE_KEY_INVALID',
      'managed cloud node device key does not match the requested node',
    );
  }
  try {
    const publicKey = JSON.parse(pair.publicKeyJwk) as Record<string, unknown>;
    const signingKey = JSON.parse(pair.signingKeyJwk) as Record<
      string,
      unknown
    >;
    if (
      publicKey.kty !== 'OKP' ||
      publicKey.crv !== 'Ed25519' ||
      signingKey.kty !== 'OKP' ||
      signingKey.crv !== 'Ed25519' ||
      typeof signingKey.d !== 'string'
    ) {
      throw new Error('invalid Ed25519 JWK');
    }
  } catch (error: unknown) {
    throw new ManagedCloudNodeEnrollmentError(
      'DEVICE_KEY_INVALID',
      'managed cloud node device key contains invalid Ed25519 JWK material',
      { cause: error },
    );
  }
  return pair;
};

export const managedCloudNodeDeviceKeyPath = (
  home: string,
  nodeId: string,
): string =>
  join(
    home,
    'security',
    'managed-cloud-node',
    `node-${Buffer.from(nodeId, 'utf8').toString('base64url')}.json`,
  );

export const loadOrCreateManagedCloudNodeDeviceKeyPair = (input: {
  home: string;
  nodeId: string;
  generate?: () => WorkspaceDeviceKeyPair;
}): WorkspaceDeviceKeyPair => {
  const path = managedCloudNodeDeviceKeyPath(input.home, input.nodeId);
  if (existsSync(path)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error: unknown) {
      throw new ManagedCloudNodeEnrollmentError(
        'DEVICE_KEY_INVALID',
        'managed cloud node device key could not be read',
        { cause: error },
      );
    }
    const pair = assertManagedCloudNodeDeviceKeyPair(parsed, input.nodeId);
    chmodSync(path, 0o600);
    return pair;
  }

  const pair = (input.generate ?? generateWorkspaceDeviceKeyPair)();
  assertManagedCloudNodeDeviceKeyPair(
    {
      schemaVersion: 1,
      nodeId: input.nodeId,
      deviceKeyPair: pair,
    },
    input.nodeId,
  );
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(
    temporaryPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        nodeId: input.nodeId,
        deviceKeyPair: pair,
      } satisfies StoredManagedCloudNodeDeviceKeyPair,
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, path);
  chmodSync(path, 0o600);
  return pair;
};

export const workspaceBootstrapFromApprovedDeviceGrant = (
  input: ApprovedDeviceGrant,
  deviceKeyPair: WorkspaceDeviceKeyPair,
  authorityOrigin = 'https://os.consuelohq.com',
): WorkspaceBootstrap => ({
  workspaceId: input.workspaceId,
  workspaceSlug: input.workspaceSlug,
  workspaceHost: input.workspaceHost,
  ...(input.nodeId ? { nodeId: input.nodeId } : {}),
  ...(input.nodeName ? { nodeName: input.nodeName } : {}),
  ...(input.nodeRole ? { nodeRole: input.nodeRole } : {}),
  ...(input.nodeStatus ? { nodeStatus: input.nodeStatus } : {}),
  nodePublicKeyJwk: deviceKeyPair.publicKeyJwk,
  nodeSigningKeyJwk: deviceKeyPair.signingKeyJwk,
  nodeCapabilities: ['mcp', 'tools'],
  authorityOrigin,
  connectorId: input.connectorId,
  connectorTransport: input.cloudflareTunnelToken
    ? 'cloudflare-tunnel'
    : 'websocket-relay',
  connectorBootstrapToken: input.connectorBootstrapToken,
  ...(input.cloudflareTunnelToken
    ? { cloudflareTunnelToken: input.cloudflareTunnelToken }
    : {}),
});

export const writeManagedCloudNodeEnrollmentStatus = (
  path: string,
  status: Record<string, unknown>,
): void => {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(status, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, path);
  chmodSync(path, 0o600);
};

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export type ManagedCloudNodeSystemctlResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ManagedCloudNodeSystemctlRunner = (input: {
  command: string[];
  env: Record<string, string | undefined>;
}) => Promise<ManagedCloudNodeSystemctlResult>;

const defaultSystemctlRunner: ManagedCloudNodeSystemctlRunner = async (
  input,
) => {
  const processResult = Bun.spawnSync({
    cmd: input.command,
    env: input.env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: processResult.exitCode ?? 1,
    stdout: new TextDecoder().decode(processResult.stdout),
    stderr: new TextDecoder().decode(processResult.stderr),
  };
};

export const activateManagedCloudNodeHeartbeat = async (input: {
  home: string;
  connectorId: string;
  run?: ManagedCloudNodeSystemctlRunner;
}): Promise<void> => {
  const run = input.run ?? defaultSystemctlRunner;
  const env = {
    ...process.env,
    CONSUELO_HOME: input.home,
    XDG_CONFIG_HOME:
      process.env.XDG_CONFIG_HOME ??
      join(process.env.HOME ?? input.home, '.config'),
  };
  const commands = [
    ['systemctl', '--user', 'daemon-reload'],
    [
      'systemctl',
      '--user',
      'enable',
      '--now',
      `consuelo-cloudflared-${input.connectorId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}.service`,
    ],
    ['systemctl', '--user', 'enable', '--now', 'consuelo-node-heartbeat.timer'],
  ];
  for (const command of commands) {
    let result: ManagedCloudNodeSystemctlResult;
    try {
      result = await run({ command, env });
    } catch (error: unknown) {
      throw new ManagedCloudNodeEnrollmentError(
        'HEARTBEAT_ACTIVATION_FAILED',
        `${command.join(' ')} failed to execute`,
        { cause: error },
      );
    }
    if (result.exitCode !== 0) {
      throw new ManagedCloudNodeEnrollmentError(
        'HEARTBEAT_ACTIVATION_FAILED',
        `${command.join(' ')} failed: ${
          result.stderr.trim() ||
          result.stdout.trim() ||
          `exit ${result.exitCode}`
        }`,
      );
    }
  }
};

const approvedGrantMatchesOnboarding = (
  grant: ApprovedDeviceGrant,
  onboarding: ManagedCloudNodeOnboarding,
): boolean =>
  grant.workspaceId === onboarding.workspaceId &&
  grant.workspaceSlug === onboarding.workspaceSlug &&
  grant.workspaceHost === onboarding.workspaceHost &&
  grant.nodeId === onboarding.nodeId;

export const runManagedCloudNodeEnrollment = async (input: {
  home: string;
  onboarding: ManagedCloudNodeOnboarding;
  dependencies?: Partial<ManagedCloudNodeEnrollmentDependencies>;
}): Promise<{
  status: 'enrolled';
  workspaceId: string;
  nodeId: string;
  connectorId: string;
}> => {
  const dependencies: ManagedCloudNodeEnrollmentDependencies = {
    loadOrCreateDeviceKeyPair: loadOrCreateManagedCloudNodeDeviceKeyPair,
    requestDeviceCode: requestWorkspaceDeviceCode,
    pollAccessToken: pollWorkspaceDeviceAccessToken,
    provision: provisionLocalOs,
    activateHeartbeat: activateManagedCloudNodeHeartbeat,
    now: Date.now,
    sleep: defaultSleep,
    writeStatus: () => undefined,
    ...input.dependencies,
  };
  try {
    const deviceKeyPair = dependencies.loadOrCreateDeviceKeyPair({
      home: input.home,
      nodeId: input.onboarding.nodeId,
    });
    const requested = await dependencies.requestDeviceCode({
      clientId: MANAGED_CLOUD_NODE_DEVICE_CLIENT_ID,
      scope: [...MANAGED_CLOUD_NODE_DEVICE_SCOPE],
      workspaceId: input.onboarding.workspaceId,
      workspaceName: input.onboarding.workspaceSlug,
      workspaceSlug: input.onboarding.workspaceSlug,
      workspaceHost: input.onboarding.workspaceHost,
      nodeId: input.onboarding.nodeId,
      nodeName: input.onboarding.nodeName,
      deviceKeyPair,
      // Reprovisioning a cloud node mints a fresh device key while the control plane still holds
      // the previous one for this node id, so registration rejected the mismatch and the node
      // could never be re-enrolled. Operator-run provisioning of a node the operator already owns
      // is exactly an identity replacement, and the browser consent in this same flow is what
      // authorizes it. The control plane still refuses a mismatch without this declaration.
      nodeIdentityReplacement: true,
    });
    if (requested.status !== 'started') {
      throw new ManagedCloudNodeEnrollmentError(
        'DEVICE_CODE_UNAVAILABLE',
        requested.message,
      );
    }
    const { session } = requested;
    dependencies.writeStatus({
      schemaVersion: 1,
      phase: 'awaiting_authorization',
      userCode: session.userCode,
      verificationUri: session.verificationUriComplete,
      expiresAt: session.expiresAt,
      workspaceSlug: input.onboarding.workspaceSlug,
      nodeId: input.onboarding.nodeId,
    });

    const expiresAtMs = Date.parse(session.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      throw new ManagedCloudNodeEnrollmentError(
        'DEVICE_CODE_INVALID',
        'managed cloud node device code returned an invalid expiration',
      );
    }
    const assertSessionActive = (): void => {
      if (dependencies.now() >= expiresAtMs) {
        throw new ManagedCloudNodeEnrollmentError(
          'DEVICE_CODE_EXPIRED',
          'managed cloud node device authorization expired',
        );
      }
    };

    let intervalSeconds = session.intervalSeconds;
    while (true) {
      assertSessionActive();
      const polled = await dependencies.pollAccessToken({
        clientId: MANAGED_CLOUD_NODE_DEVICE_CLIENT_ID,
        deviceCode: session.deviceCode,
        intervalSeconds,
        deviceKeyPair,
      });
      if (polled.status === 'pending' || polled.status === 'slow_down') {
        intervalSeconds = polled.intervalSeconds;
        await dependencies.sleep(intervalSeconds * 1_000);
        continue;
      }
      if (polled.status === 'approved') {
        if (!approvedGrantMatchesOnboarding(polled, input.onboarding)) {
          throw new ManagedCloudNodeEnrollmentError(
            'DEVICE_GRANT_IDENTITY_MISMATCH',
            'approved device grant does not match managed cloud node onboarding identity',
          );
        }
        if (!polled.cloudflareTunnelToken) {
          throw new ManagedCloudNodeEnrollmentError(
            'CONNECTOR_TRANSPORT_UNAVAILABLE',
            'approved managed cloud node grant did not include an executable Cloudflare Tunnel transport',
          );
        }
        const workspaceBootstrap = workspaceBootstrapFromApprovedDeviceGrant(
          polled,
          deviceKeyPair,
          input.onboarding.authorityOrigin,
        );
        dependencies.provision({
          home: input.home,
          mode: 'cloud',
          platform: 'linux',
          workspaceBootstrap,
        });
        await dependencies.activateHeartbeat({
          home: input.home,
          connectorId: polled.connectorId,
        });
        const status = {
          schemaVersion: 1,
          phase: 'enrolled',
          workspaceId: polled.workspaceId,
          workspaceSlug: polled.workspaceSlug,
          nodeId: polled.nodeId ?? input.onboarding.nodeId,
          connectorId: polled.connectorId,
        } as const;
        dependencies.writeStatus(status);
        return {
          status: 'enrolled',
          workspaceId: status.workspaceId,
          nodeId: status.nodeId,
          connectorId: status.connectorId,
        };
      }
      const code =
        'errorCode' in polled
          ? polled.errorCode
          : polled.status === 'workspace_required'
            ? 'DEVICE_WORKSPACE_REQUIRED'
            : 'DEVICE_AUTHORIZATION_UNAVAILABLE';
      const message =
        'message' in polled && polled.message
          ? polled.message
          : `managed cloud node authorization failed: ${polled.status}`;
      throw new ManagedCloudNodeEnrollmentError(code, message);
    }
  } catch (error: unknown) {
    const code =
      error instanceof ManagedCloudNodeEnrollmentError
        ? error.code
        : 'MANAGED_CLOUD_NODE_ENROLLMENT_FAILED';
    const message = error instanceof Error ? error.message : String(error);
    dependencies.writeStatus({
      schemaVersion: 1,
      phase: 'failed',
      errorCode: code,
      message,
      workspaceSlug: input.onboarding.workspaceSlug,
      nodeId: input.onboarding.nodeId,
    });
    throw new ManagedCloudNodeEnrollmentError(code, `${code}: ${message}`, {
      cause: error,
    });
  }
};
