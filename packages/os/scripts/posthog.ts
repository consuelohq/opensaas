#!/usr/bin/env bun
import { createPosthogClient, resolvePosthogConfig } from './lib/posthog-client';

type Args = {
  command: 'config' | 'projects' | 'query' | 'capture';
  projectId?: string;
  sql?: string;
  limit?: number;
  event?: string;
  distinctId?: string;
  propertiesJson?: string;
};

const COMMANDS = new Set(['config', 'projects', 'query', 'capture']);

function parse(argv: string[]): Args {
  const command = argv[0];
  if (!command || !COMMANDS.has(command)) {
    throw new Error('usage: posthog <config|projects|query|capture> [--project-id <id>] [--sql <HogQL>] [--limit <n>] [--event <name>] [--distinct-id <opaque>] [--properties-json <json>] [--json]');
  }
  const args: Args = { command: command as Args['command'] };
  const flags = {
    '--project-id': 'projectId',
    '--sql': 'sql',
    '--limit': 'limit',
    '--event': 'event',
    '--distinct-id': 'distinctId',
    '--properties-json': 'propertiesJson',
  } as const;
  for (let index = 1; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--json') continue;
    const name = flags[flag as keyof typeof flags];
    const value = argv[++index];
    if (!name || !value || value.startsWith('--')) throw new Error('invalid PostHog command options.');
    if (name === 'limit') args.limit = Number(value);
    else args[name] = value;
  }
  return args;
}

async function run(argv: string[], client = createPosthogClient({ config: resolvePosthogConfig() })) {
  const args = parse(argv);
  switch (args.command) {
    case 'config': return client.status();
    case 'projects': return client.projects({ limit: args.limit });
    case 'query':
      if (!args.sql) throw new Error('PostHog query requires sql.');
      return client.query({ sql: args.sql, projectId: args.projectId, limit: args.limit });
    case 'capture':
      if (!args.event || !args.distinctId) throw new Error('PostHog capture requires event and distinct id.');
      let properties: Record<string, unknown> = {};
      if (args.propertiesJson) {
        let value: unknown;
        try { value = JSON.parse(args.propertiesJson) as unknown; }
        catch { throw new Error('PostHog properties must be valid JSON object.'); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('PostHog properties must be a JSON object.');
        }
        properties = value as Record<string, unknown>;
      }
      return client.capture({ event: args.event, distinctId: args.distinctId, properties });
  }
}

if (import.meta.main) {
  run(process.argv.slice(2))
    .then((data) => process.stdout.write(JSON.stringify({ ok: true, data }) + '\n'))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'PostHog request failed.';
      process.stdout.write(JSON.stringify({ ok: false, code: 'POSTHOG_ERROR', message }) + '\n');
      process.exitCode = 1;
    });
}

export { parse as parsePosthogArgs, run as runPosthogCommand };
