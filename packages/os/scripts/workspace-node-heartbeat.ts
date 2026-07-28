#!/usr/bin/env bun

import fs from 'node:fs';

import {
  createWorkspaceNodeHeartbeatClient,
  type WorkspaceNodeHeartbeatConfig,
} from './lib/workspace-node-heartbeat-client';

function parseConfigPath(args: string[]): string {
  const index = args.indexOf('--config');
  const value = index >= 0 ? args[index + 1]?.trim() : '';
  if (!value) {
    throw new Error('usage: workspace-node-heartbeat --config <config-path>');
  }
  return value;
}

function readConfig(configPath: string): WorkspaceNodeHeartbeatConfig {
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
  return value as WorkspaceNodeHeartbeatConfig;
}

async function main(): Promise<void> {
  const configPath = parseConfigPath(process.argv.slice(2));
  const client = createWorkspaceNodeHeartbeatClient({
    config: readConfig(configPath),
  });
  const result = await client.send();
  process.stdout.write(
    `${JSON.stringify({ nodeId: result.nodeId, presence: result.presence })}\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
