#!/usr/bin/env bun

import { migrateManagedOsMcpConnectorOriginClass } from './lib/managed-os-mcp-origin-class-migration';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const json = args.has('--json');
for (const arg of args) {
  if (arg !== '--dry-run' && arg !== '--json') {
    throw new Error(`unknown option: ${arg}`);
  }
}

const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
const baseDomain = process.env.OS_DEVICE_AUTH_BASE_DOMAIN?.trim() || 'consuelohq.com';
if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN is required');
if (!zoneId) throw new Error('CLOUDFLARE_ZONE_ID is required');

const result = await migrateManagedOsMcpConnectorOriginClass({
  apiToken,
  zoneId,
  baseDomain,
  dryRun,
});

process.stdout.write(
  json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `managed OS MCP connector-origin class: ${result.status}\n`,
);
