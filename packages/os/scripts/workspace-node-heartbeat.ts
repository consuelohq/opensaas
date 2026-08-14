#!/usr/bin/env bun

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
} from './lib/workspace-node-heartbeat-client';
import { reconcileGatewayWorkspaceEdgeProxyAuth } from './lib/security-gateway';

type WorkspaceNodeHeartbeatFileConfig = WorkspaceNodeHeartbeatConfig & {
  osHome?: string;
  connectorHealthUrl?: string;
};

const CONNECTOR_HEALTH_TIMEOUT_MS = 5_000;

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
    const result = await client.send();
    reconcileHeartbeatEdgeProxyAuth({ configPath, config, result });
    return result;
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('workspace node heartbeat failed', { cause: error });
  }
}

async function main(): Promise<void> {
  const result = await sendWorkspaceNodeHeartbeatFromConfig(
    parseConfigPath(process.argv.slice(2)),
  );
  process.stdout.write(
    `${JSON.stringify({
      nodeId: result.nodeId,
      presence: result.presence,
      routeReady: result.routeReady,
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
