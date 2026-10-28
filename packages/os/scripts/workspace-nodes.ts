#!/usr/bin/env bun

import {
  createWorkspaceNodeClient,
  formatWorkspaceNodeCommandResult,
  parseWorkspaceNodeCommand,
  WORKSPACE_NODES_USAGE,
} from './lib/workspace-node-client';

function writeError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${WORKSPACE_NODES_USAGE}\n`);
    return;
  }
  const accessToken = process.env.CONSUELO_OS_WORKSPACE_TOKEN?.trim() ?? '';
  if (!accessToken) {
    throw new Error(
      'CONSUELO_OS_WORKSPACE_TOKEN is required; credentials are accepted only through the environment.',
    );
  }
  const command = parseWorkspaceNodeCommand(args);
  const client = createWorkspaceNodeClient({
    origin:
      process.env.CONSUELO_OS_AUTHORITY_ORIGIN?.trim() ||
      'https://os.consuelohq.com',
    accessToken,
  });
  const result = await client.execute(command);
  process.stdout.write(`${formatWorkspaceNodeCommandResult(command, result)}\n`);
}

main().catch((error: unknown) => {
  writeError(error);
  process.exitCode = 1;
});
