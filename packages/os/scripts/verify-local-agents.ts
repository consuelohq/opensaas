#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';

import {
  detectLocalAgents,
  verifyLocalAgents,
  type AgentName,
} from './lib/local-agent-connectivity';

const AGENT_NAMES = new Set<AgentName>([
  'codex',
  'cursor',
  'claude',
  'opencode',
  'factory',
  'gemini',
  'pi',
]);

function isAgentName(value: unknown): value is AgentName {
  return typeof value === 'string' && AGENT_NAMES.has(value as AgentName);
}

function previouslyConfiguredAgentNames(home: string): AgentName[] {
  const configPath = path.join(home, 'config.json');
  if (!fs.existsSync(configPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
    agents?: Array<{ name?: unknown; status?: unknown; configuredAt?: unknown }>;
  };
  if (!Array.isArray(parsed.agents)) return [];
  return parsed.agents
    .filter((agent) => isAgentName(agent.name) && (
      typeof agent.configuredAt === 'string' ||
      agent.status === 'configured' ||
      agent.status === 'verified'
    ))
    .map((agent) => agent.name as AgentName);
}

async function main(): Promise<void> {
  try {
    const home = process.env.CONSUELO_HOME?.trim();
    if (!home) throw new Error('CONSUELO_HOME is required.');
  
    const detected = detectLocalAgents({ home });
    const configured = detected
      .filter((agent) => agent.status === 'configured' || agent.status === 'verified')
      .map((agent) => agent.name);
    const previouslyVerified = previouslyConfiguredAgentNames(home);
    const agentNames = [...new Set<AgentName>([...configured, ...previouslyVerified])];
    if (agentNames.length === 0) {
      process.stdout.write('No configured local agents require verification.\n');
      return;
    }
  
    const result = await verifyLocalAgents({ home, agentNames });
    const failures = result.agents.filter(
      (agent) => agentNames.includes(agent.name) && agent.status !== 'verified',
    );
    if (result.error || failures.length > 0) {
      const labels = failures.map((agent) => agent.label).join(', ');
      throw new Error(result.error?.message ?? `Local-agent verification failed: ${labels}`);
    }
  
    const handshake = result.handshake;
    process.stdout.write(
      `Verified ${agentNames.length} local agent${agentNames.length === 1 ? '' : 's'}` +
      `${handshake ? ` (${handshake.toolCount} tools, protocol ${handshake.protocolVersion})` : ''}.\n`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error("Local-agent verification could not complete: " + message, { cause: error });
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Local-agent verification failed: ${message}\n`);
  process.exitCode = 1;
});
