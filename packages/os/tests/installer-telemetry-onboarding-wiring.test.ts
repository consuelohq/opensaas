import { describe, expect, it, vi } from 'vitest';

import {
  attemptWorkspaceDeviceLogin,
  completeWorkspaceDeviceSelection,
} from '../scripts/install';
import type { InstallDiagnostics } from '../scripts/lib/install-diagnostics';
import { createInstallerTelemetry } from '../scripts/lib/install-telemetry';
import type { InstallTelemetryEvent } from '../scripts/lib/install-telemetry-contract';

const INSTALL_ID = 'ins_11111111-1111-4111-8111-111111111111' as const;

function diagnostics(): InstallDiagnostics {
  return {
    enabled: false,
    reportDir: '',
    recordStep: vi.fn(),
    recordPromptDecision: vi.fn(),
    recordHttp: vi.fn(),
    finish: vi.fn(),
  };
}

function telemetryWithEvents(events: InstallTelemetryEvent[]) {
  return createInstallerTelemetry({
    installId: INSTALL_ID,
    eventSink: async (event) => events.push(event),
  });
}

describe('installer onboarding telemetry wiring', () => {
  it('correlates device-code requests and records recoverable fallback failures', async () => {
    const events: InstallTelemetryEvent[] = [];
    const telemetry = telemetryWithEvents(events);
    const requestWorkspaceDeviceCode = vi.fn(async () => ({
      status: 'unavailable' as const,
      message: 'edge unavailable',
      telemetryErrorCode: 'DEVICE_CODE_REQUEST_FAILED' as const,
    }));
    const input = {
      dryRun: false,
      home: '/tmp/consuelo-home',
      diagnostics: diagnostics(),
      telemetry,
    };

    const result = await attemptWorkspaceDeviceLogin(input, {
      readLocalNodeIdentity: vi.fn(() => undefined),
      requestWorkspaceDeviceCode,
      pollWorkspaceDeviceAccessToken: vi.fn(),
      printDeviceLoginPrompt: vi.fn(),
      openDeviceVerificationUrl: vi.fn(),
      sleep: vi.fn(),
      withRuntimeHold: vi.fn(async <T>(operation: () => Promise<T>): Promise<T> => operation()),
    });

    expect(result.status).toBe('fallback');
    expect(requestWorkspaceDeviceCode).toHaveBeenCalledWith(
      expect.objectContaining({ installId: INSTALL_ID }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        name: 'install.stage.failed',
        stage: 'device_auth',
        outcome: 'failed',
        error: {
          code: 'DEVICE_CODE_REQUEST_FAILED',
          impact: 'recoverable',
        },
      }),
    );
  });

  it('binds canonical user/workspace/node identity after approved device authorization', async () => {
    const events: InstallTelemetryEvent[] = [];
    const telemetry = telemetryWithEvents(events);
    const deviceKeyPair = {
      algorithm: 'Ed25519' as const,
      publicKeyJwk: '{}',
      signingKeyJwk: '{}',
    };
    const input = {
      dryRun: false,
      home: '/tmp/consuelo-home',
      diagnostics: diagnostics(),
      telemetry,
    };

    const result = await attemptWorkspaceDeviceLogin(input, {
      readLocalNodeIdentity: vi.fn(() => undefined),
      requestWorkspaceDeviceCode: vi.fn(async () => ({
        status: 'started' as const,
        deviceKeyPair,
        session: {
          deviceCode: 'dev_secret',
          userCode: 'ABCD-EFGH',
          verificationUri: 'https://os.consuelohq.com/login/device',
          verificationUriComplete:
            'https://os.consuelohq.com/login/device?user_code=ABCDEFGH',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          intervalSeconds: 1,
        },
      })),
      pollWorkspaceDeviceAccessToken: vi.fn(async () => ({
        status: 'approved' as const,
        userId: 'user_123',
        workspaceId: 'workspace_123',
        workspaceSlug: 'workspace',
        workspaceHost: 'workspace.consuelohq.com',
        nodeId: 'node_123',
        connectorId: 'connector_123',
        connectorBootstrapToken: 'cbt_secret',
        connectorBootstrapExpiresAt: '2026-08-13T18:00:00.000Z',
      })),
      printDeviceLoginPrompt: vi.fn(),
      openDeviceVerificationUrl: vi.fn(async () => false),
      sleep: vi.fn(async () => undefined),
      withRuntimeHold: vi.fn(async <T>(operation: () => Promise<T>): Promise<T> => operation()),
    });

    expect(result.status).toBe('approved');
    expect(telemetry.identity).toEqual({
      state: 'canonical',
      userId: 'user_123',
      workspaceId: 'workspace_123',
      nodeId: 'node_123',
    });
    expect(events).toContainEqual(
      expect.objectContaining({ name: 'install.identity.bound' }),
    );
  });

  it('carries the same install id through workspace selection and binds its canonical identity', async () => {
    const events: InstallTelemetryEvent[] = [];
    const telemetry = telemetryWithEvents(events);
    const selectWorkspaceForDeviceLogin = vi.fn(async () => ({
      status: 'approved' as const,
      userId: 'user_456',
      workspaceId: 'workspace_456',
      workspaceSlug: 'workspace',
      workspaceHost: 'workspace.consuelohq.com',
      connectorId: 'connector_456',
      connectorBootstrapToken: 'cbt_secret',
      connectorBootstrapExpiresAt: '2026-08-13T18:00:00.000Z',
      nodeId: 'node_456',
      nodeName: 'Mac',
      nodeRole: 'home' as const,
      nodeStatus: 'created' as const,
    }));
    const input = {
      diagnostics: diagnostics(),
      selection: {
        deviceCode: 'dev_secret',
        intervalSeconds: 5,
        deviceKeyPair: {
          algorithm: 'Ed25519' as const,
          publicKeyJwk: '{}',
          signingKeyJwk: '{}',
        },
      },
      workspaceName: 'workspace',
      workspaceSlug: 'workspace',
      workspaceHost: 'workspace.consuelohq.com',
      telemetry,
    };

    await completeWorkspaceDeviceSelection(input, {
      selectWorkspaceForDeviceLogin,
      withRuntimeHold: vi.fn(async <T>(operation: () => Promise<T>): Promise<T> => operation()),
    });

    expect(selectWorkspaceForDeviceLogin).toHaveBeenCalledWith(
      expect.objectContaining({ installId: INSTALL_ID }),
    );
    expect(telemetry.identity).toEqual({
      state: 'canonical',
      userId: 'user_456',
      workspaceId: 'workspace_456',
      nodeId: 'node_456',
    });
  });
});
