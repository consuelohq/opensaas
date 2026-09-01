#!/usr/bin/env bun

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  detectLocalAgents,
  type AgentName,
  type LocalAgentDetection,
} from './lib/local-agent-connectivity';
import {
  createWorkspaceNodeHeartbeatClient,
  type WorkspaceNodeHeartbeatConfig,
  type WorkspaceNodeHeartbeatResult,
  type WorkspaceNodeHeartbeatRuntimeStatus,
} from './lib/workspace-node-heartbeat-client';
import { MODERN_MCP_PROTOCOL_VERSION } from './lib/mcp-protocol';
import { RUNTIME_BUNDLE_MANIFEST_PATH } from './lib/distribution/runtime-bundle';
import { resolveLifecyclePaths } from './lib/lifecycle/paths';
import { reconcileGatewayWorkspaceEdgeProxyAuth } from './lib/security-gateway';
import { createWorkspaceEdgeNodeHeaders } from './lib/workspace-edge-node-auth';
import { writeStoredWorkspaceNodeSnapshot } from './lib/workspace-node-snapshot-cache';

type WorkspaceNodeHeartbeatFileConfig = WorkspaceNodeHeartbeatConfig & {
  osHome?: string;
  connectorHealthUrl?: string;
};

type CachedHeartbeatEdgeAuth = {
  connectorId: string;
  signingSecret: string;
};

const CONNECTOR_HEALTH_TIMEOUT_MS = 5_000;
const MCP_READINESS_TIMEOUT_MS = 5_000;

function parseConfigPath(args: string[]): string {
  const index = args.indexOf('--config');
  const value = index >= 0 ? args[index + 1]?.trim() : '';
  if (!value) {
    throw new Error('usage: workspace-node-heartbeat --config <config-path>');
  }
  return value;
}

function readConfig(configPath: string): WorkspaceNodeHeartbeatFileConfig {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error: unknown) {
    throw new Error('workspace node heartbeat config could not be read', {
      cause: error,
    });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('workspace node heartbeat config is invalid');
  }
  return value as WorkspaceNodeHeartbeatFileConfig;
}

function resolveOsHome(
  configPath: string,
  config: WorkspaceNodeHeartbeatFileConfig,
): string {
  const explicit = config.osHome?.trim();
  if (explicit) return path.resolve(explicit);
  return path.resolve(path.dirname(configPath), '..', '..', '..');
}

export function heartbeatRuntimeStatus(input: {
  configPath: string;
  config: WorkspaceNodeHeartbeatFileConfig;
}): WorkspaceNodeHeartbeatRuntimeStatus {
  const status: WorkspaceNodeHeartbeatRuntimeStatus = {
    mcpProtocolVersion: MODERN_MCP_PROTOCOL_VERSION,
  };
  try {
    const paths = resolveLifecyclePaths(resolveOsHome(input.configPath, input.config));
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(paths.currentLink, RUNTIME_BUNDLE_MANIFEST_PATH),
        'utf8',
      ),
    ) as Record<string, unknown>;
    if (
      manifest.kind === 'consuelo-runtime-bundle'
      && typeof manifest.version === 'string'
      && manifest.version.trim()
      && typeof manifest.bundleId === 'string'
      && manifest.bundleId.trim()
    ) {
      status.osVersion = manifest.version.trim();
      status.bundleId = manifest.bundleId.trim();
    }
  } catch {
    // Release identity is telemetry. Protocol identity remains authoritative even if a
    // partially installed or test runtime does not expose a current bundle manifest.
  }
  return status;
}

export function verifiedHeartbeatAgentNames(input: {
  configPath: string;
  config: WorkspaceNodeHeartbeatFileConfig;
  detectAgents?: (input: { home: string }) => LocalAgentDetection[];
}): AgentName[] {
  const detectAgents = input.detectAgents ?? detectLocalAgents;
  return detectAgents({
    home: resolveOsHome(input.configPath, input.config),
  })
    .filter((agent) => agent.status === 'verified')
    .map((agent) => agent.name)
    .sort();
}

function normalizeConnectorHealthUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/health' ||
    url.search ||
    url.hash
  ) {
    throw new Error('workspace node heartbeat connector health URL is invalid');
  }
  return url;
}

export async function probeHeartbeatMcpReadiness(input: {
  config: WorkspaceNodeHeartbeatFileConfig;
  result: WorkspaceNodeHeartbeatResult;
  fetchImpl?: typeof fetch;
  now?: () => number;
  createNonce?: () => string;
}): Promise<boolean> {
  const healthUrl = input.config.connectorHealthUrl?.trim();
  if (!healthUrl || input.result.routeReady !== true) return false;
  const connectorId = input.result.connectorId?.trim();
  const signingSecret = input.result.edgeRequestSigningSecret?.trim();
  if (!connectorId || !signingSecret) return false;

  try {
    const mcpUrl = normalizeConnectorHealthUrl(healthUrl);
    mcpUrl.pathname = '/mcp';
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'watchdog-' + (input.createNonce ?? randomUUID)(),
      method: 'tools/list',
    });
    const timestamp = String((input.now ?? Date.now)());
    const nonce = (input.createNonce ?? randomUUID)();
    const signedHeaders = createWorkspaceEdgeNodeHeaders({
      signingSecret,
      workspaceId: input.config.workspaceId,
      nodeId: input.config.nodeId,
      connectorId,
      surface: 'os',
      method: 'POST',
      pathWithSearch: '/mcp',
      body,
      timestamp,
      nonce,
    });
    const response = await (input.fetchImpl ?? globalThis.fetch)(
      new Request(mcpUrl, {
        method: 'POST',
        headers: {
          ...signedHeaders,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(MCP_READINESS_TIMEOUT_MS),
      }),
    );
    if (!response.ok) return false;
    const payload = await response.json() as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return false;
    }
    const result = (payload as { result?: unknown }).result;
    return Boolean(
      result
      && typeof result === 'object'
      && !Array.isArray(result)
      && Array.isArray((result as { tools?: unknown }).tools),
    );
  } catch {
    return false;
  }
}

export function reconcileHeartbeatEdgeProxyAuth(input: {
  configPath: string;
  config: WorkspaceNodeHeartbeatFileConfig;
  result: WorkspaceNodeHeartbeatResult;
}): boolean {
  if (!input.result.connectorId || !input.result.edgeRequestSigningSecret) {
    return false;
  }
  if (input.result.nodeId !== input.config.nodeId) {
    throw new Error('workspace node heartbeat returned a different node identity');
  }
  const authConfigPath = path.join(path.dirname(input.configPath), 'auth.json');
  return reconcileGatewayWorkspaceEdgeProxyAuth({
    authConfigPath,
    workspaceId: input.config.workspaceId,
    nodeId: input.result.nodeId,
    connectorId: input.result.connectorId,
    signingSecret: input.result.edgeRequestSigningSecret,
  });
}

function cachedHeartbeatEdgeAuth(input: {
  configPath: string;
  config: WorkspaceNodeHeartbeatFileConfig;
}): CachedHeartbeatEdgeAuth | null {
  try {
    const value = JSON.parse(
      fs.readFileSync(path.join(path.dirname(input.configPath), 'auth.json'), 'utf8'),
    ) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const stored = value as {
      kind?: unknown;
      workspaceId?: unknown;
      edgeProxy?: {
        version?: unknown;
        nodeId?: unknown;
        connectorId?: unknown;
        signingSecret?: unknown;
      };
    };
    const edgeProxy = stored.edgeProxy;
    const connectorId = typeof edgeProxy?.connectorId === 'string'
      ? edgeProxy.connectorId.trim()
      : '';
    const signingSecret = typeof edgeProxy?.signingSecret === 'string'
      ? edgeProxy.signingSecret.trim()
      : '';
    if (
      stored.kind !== 'consuelo-generated'
      || stored.workspaceId !== input.config.workspaceId.trim()
      || edgeProxy?.version !== 1
      || edgeProxy.nodeId !== input.config.nodeId.trim()
      || !connectorId
      || !signingSecret
    ) {
      return null;
    }
    return { connectorId, signingSecret };
  } catch {
    return null;
  }
}

export async function resolveHeartbeatConnectorStatus(input: {
  config: WorkspaceNodeHeartbeatFileConfig;
  fetchImpl?: typeof fetch;
}): Promise<'connected' | 'disconnected'> {
  const healthUrl = input.config.connectorHealthUrl?.trim();
  if (!healthUrl) return input.config.connectorStatus;

  let url: URL;
  try {
    url = normalizeConnectorHealthUrl(healthUrl);
  } catch {
    return 'disconnected';
  }

  try {
    const response = await (input.fetchImpl ?? globalThis.fetch)(
      new Request(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(CONNECTOR_HEALTH_TIMEOUT_MS),
      }),
    );
    return response.ok ? 'connected' : 'disconnected';
  } catch {
    return 'disconnected';
  }
}

export async function sendWorkspaceNodeHeartbeatFromConfig(
  configPath: string,
  input: {
    fetchImpl?: typeof fetch;
    detectAgents?: (input: { home: string }) => LocalAgentDetection[];
    acceptCachedMcpProof?: boolean;
  } = {},
) {
  try {
    const config = readConfig(configPath);
    const agents = verifiedHeartbeatAgentNames({
      configPath,
      config,
      detectAgents: input.detectAgents,
    });
    const connectorStatus = await resolveHeartbeatConnectorStatus({
      config,
      fetchImpl: input.fetchImpl,
    });
    if (input.acceptCachedMcpProof) {
      const cachedEdgeAuth = cachedHeartbeatEdgeAuth({ configPath, config });
      const cachedProbeReady = cachedEdgeAuth
        ? await probeHeartbeatMcpReadiness({
            config,
            result: {
              nodeId: config.nodeId,
              presence: 'online',
              routeReady: true,
              connectorId: cachedEdgeAuth.connectorId,
              edgeRequestSigningSecret: cachedEdgeAuth.signingSecret,
            },
            fetchImpl: input.fetchImpl,
          })
        : false;
      if (cachedProbeReady) {
        return {
          nodeId: config.nodeId,
          presence: 'online' as const,
          routeReady: true,
          mcpReady: true,
        };
      }
    }
    // Do not turn a transient public-health failure during restart into an authority-side
    // disconnect. Heartbeat TTL will classify a sustained outage if the connector stays down.
    if (connectorStatus === 'disconnected') {
      return {
        nodeId: config.nodeId,
        presence: 'offline' as const,
        routeReady: false,
        skipped: true as const,
        reason: 'connector_health_failed' as const,
      };
    }
    const client = createWorkspaceNodeHeartbeatClient({
      config: { ...config, connectorStatus },
      agents,
      fetchImpl: input.fetchImpl,
    });
    const runtimeStatus = heartbeatRuntimeStatus({ configPath, config });
    const mcpReadinessRequired = Boolean(config.connectorHealthUrl?.trim());
    let readinessResult: WorkspaceNodeHeartbeatResult;
    let mcpReady: boolean | undefined;
    if (!mcpReadinessRequired) {
      readinessResult = await client.send(runtimeStatus);
    } else {
      const cachedEdgeAuth = cachedHeartbeatEdgeAuth({ configPath, config });
      const cachedProbeReady = cachedEdgeAuth
        ? await probeHeartbeatMcpReadiness({
            config,
            result: {
              nodeId: config.nodeId,
              presence: 'online',
              routeReady: true,
              connectorId: cachedEdgeAuth.connectorId,
              edgeRequestSigningSecret: cachedEdgeAuth.signingSecret,
            },
            fetchImpl: input.fetchImpl,
          })
        : false;
      if (cachedProbeReady) {
        mcpReady = true;
      } else {
        const recoveryResult = await client.send({ ...runtimeStatus, mcpReady: false });
        reconcileHeartbeatEdgeProxyAuth({ configPath, config, result: recoveryResult });
        mcpReady = await probeHeartbeatMcpReadiness({
          config,
          result: recoveryResult,
          fetchImpl: input.fetchImpl,
        });
      }
      try {
        readinessResult = await client.send({ ...runtimeStatus, mcpReady });
        reconcileHeartbeatEdgeProxyAuth({ configPath, config, result: readinessResult });
      } catch (error: unknown) {
        if (mcpReady !== true) throw error;
        return {
          nodeId: config.nodeId,
          presence: 'online' as const,
          routeReady: true,
          mcpReady: true,
          authorityReady: false,
        };
      }
    }
    const acceptedResult = mcpReadinessRequired
      ? {
          ...readinessResult,
          routeReady: mcpReady === true,
          mcpReady,
          authorityReady: true,
        }
      : readinessResult;
    if (readinessResult.workspace) {
      writeStoredWorkspaceNodeSnapshot({
        home: resolveOsHome(configPath, config),
        workspace: readinessResult.workspace,
        expectedWorkspaceId: config.workspaceId,
        expectedCurrentNodeId: config.nodeId,
      });
    }
    return acceptedResult;
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('workspace node heartbeat failed', { cause: error });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const result = await sendWorkspaceNodeHeartbeatFromConfig(
    parseConfigPath(args),
    { acceptCachedMcpProof: args.includes('--accept-cached-mcp-proof') },
  );
  process.stdout.write(
    `${JSON.stringify({
      nodeId: result.nodeId,
      presence: result.presence,
      routeReady: result.routeReady,
      ...('mcpReady' in result ? { mcpReady: result.mcpReady } : {}),
      ...('authorityReady' in result
        ? { authorityReady: result.authorityReady }
        : {}),
      ...('skipped' in result && result.skipped
        ? { skipped: true, reason: result.reason }
        : {}),
    })}\n`,
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
