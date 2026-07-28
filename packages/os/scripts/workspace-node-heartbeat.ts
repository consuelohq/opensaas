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
} from './lib/workspace-node-heartbeat-client';

type WorkspaceNodeHeartbeatFileConfig = WorkspaceNodeHeartbeatConfig & {
  osHome?: string;
};

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

async function main(): Promise<void> {
  const configPath = parseConfigPath(process.argv.slice(2));
  const config = readConfig(configPath);
  const agents = verifiedHeartbeatAgentNames({ configPath, config });
  const client = createWorkspaceNodeHeartbeatClient({
    config,
    agents,
  });
  const result = await client.send();
  process.stdout.write(
    `${JSON.stringify({ nodeId: result.nodeId, presence: result.presence })}\n`,
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
