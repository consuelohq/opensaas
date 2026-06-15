import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const osPackageRoot = path.join(__dirname, '..');
const workspaceEdgeRoot = path.join(osPackageRoot, 'cloudflare', 'workspace-edge');
const wranglerPath = path.join(workspaceEdgeRoot, 'wrangler.toml');
const workerEntrypointPath = path.join(workspaceEdgeRoot, 'src', 'index.ts');
const workerReadmePath = path.join(workspaceEdgeRoot, 'README.md');
const d1MigrationPath = path.join(
  workspaceEdgeRoot,
  'migrations',
  '0001_workspace_route_registry.sql',
);
const packageJsonPath = path.join(osPackageRoot, 'package.json');

function readRequiredFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required workspace edge deployment file: ${path.relative(osPackageRoot, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireScript(scripts: Record<string, string>, key: string): string {
  expect(scripts).toHaveProperty(key);
  expect(typeof scripts[key]).toBe('string');
  return scripts[key];
}

contractDescribe('workspace Cloudflare Worker deployment contract', () => {
  it('should ship a Wrangler-deployable workspace edge Worker with D1 bindings and controlled wildcard workspace routing', () => {
    const wrangler = readRequiredFile(wranglerPath);

    expect(wrangler).toMatch(/name\s*=\s*["']consuelo-workspace-edge["']/);
    expect(wrangler).toMatch(/main\s*=\s*["']src\/index\.ts["']/);
    expect(wrangler).toMatch(/compatibility_date\s*=/);
    expect(wrangler).toMatch(/\[\[d1_databases\]\]/);
    expect(wrangler).toMatch(/binding\s*=\s*["']WORKSPACE_ROUTE_REGISTRY["']/);
    expect(wrangler).toMatch(/database_name\s*=\s*["']consuelo-workspace-route-registry["']/);
    expect(wrangler).toMatch(/database_id\s*=\s*["'][0-9a-f-]{36}["']/i);
    expect(wrangler).not.toMatch(/database_id\s*=\s*["']00000000-0000-0000-0000-000000000000["']/);
    expect(wrangler).toMatch(/pattern\s*=\s*["']internal\.consuelohq\.com\/\*["']/);
    expect(wrangler).toMatch(/pattern\s*=\s*["']\*\.consuelohq\.com\/\*["']/);
    expect(wrangler).not.toMatch(/pattern\s*=\s*["']sites\.consuelohq\.com\/\*["']/);
    expect(wrangler).toMatch(/\[\[r2_buckets\]\]/);
    expect(wrangler).toMatch(/binding\s*=\s*["']SITES_SNAPSHOTS["']/);
    expect(wrangler).toMatch(/bucket_name\s*=\s*["']consuelo-sites-snapshots["']/);
    expect(wrangler).toMatch(/zone_name\s*=\s*["']consuelohq\.com["']/);
    expect(wrangler).not.toMatch(/CONSUELO_EDGE_SIGNING_SECRET\s*=\s*["'][^"']+["']/);
    expect(wrangler).not.toMatch(/api[_-]?token\s*=\s*["'][^"']+["']/i);
  });
  it('should expose a Worker entrypoint that composes the router with D1, R2 snapshots, and edge signing', () => {
    const worker = readRequiredFile(workerEntrypointPath);

    expect(worker).toMatch(/createWorkspaceCloudflareEdgeRouter/);
    expect(worker).toMatch(/createWorkspaceCloudflareD1RouteRegistry/);
    expect(worker).toMatch(/WORKSPACE_ROUTE_REGISTRY/);
    expect(worker).toMatch(/CONSUELO_EDGE_SIGNING_SECRET/);
    expect(worker).toMatch(/SITES_SNAPSHOTS/);
    expect(worker).toMatch(/MCP_CONNECTION_CREDENTIALS/);
    expect(worker).toMatch(/MCP_CONNECTION_STATES/);
    expect(worker).toMatch(/MCP_APPROVED_CONNECTOR_BINDINGS/);
    expect(worker).toMatch(/MCP_GOOGLE_OAUTH_CLIENT_ID/);
    expect(worker).toMatch(/MCP_GOOGLE_OAUTH_CLIENT_SECRET/);
    expect(worker).toMatch(/createWorkspaceMcpConnectionAuthHandler/);
    expect(worker).toMatch(/createWorkspaceMcpApprovedConnectorBindingStore/);
    expect(worker).toMatch(/siteSnapshots/);
    expect(worker).toMatch(
      /export\s+(?:(?:async\s+)?function|const)\s+fetch|export\s*\{[^}]*\bfetch\b[^}]*\}/,
    );
    expect(worker).toMatch(/fetch\s*\(/);
    expect(worker).not.toMatch(/process\.env/);
  });

  it('should document required Cloudflare bindings, WAF/IP lists, and Sites route-policy separation', () => {
    const readme = readRequiredFile(workerReadmePath);

    for (const bindingName of [
      'WORKSPACE_ROUTE_REGISTRY',
      'SITES_SNAPSHOTS',
      'MCP_CONNECTION_CREDENTIALS',
      'MCP_CONNECTION_STATES',
      'MCP_APPROVED_CONNECTOR_BINDINGS',
      'CONSUELO_EDGE_SIGNING_SECRET',
      'MCP_GOOGLE_OAUTH_CLIENT_ID',
      'MCP_GOOGLE_OAUTH_CLIENT_SECRET',
      'MCP_ALLOWED_PROVIDER_CIDRS',
    ]) {
      expect(readme).toContain(bindingName);
    }
    expect(readme).toMatch(/WAF/i);
    expect(readme).toMatch(/IP list|CIDR/i);
    expect(readme).toMatch(/route policy/i);
    expect(readme).toMatch(/Sites.*R2|R2.*Sites/s);
    expect(readme).toMatch(/local gateway token/i);
    expect(readme).toMatch(/MCP connection credential/i);
  });
  it('should ship a D1 migration for the edge route registry tables and indexes', () => {
    const migration = readRequiredFile(d1MigrationPath);
    expect(migration).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+workspace_route_registry/i);
    expect(migration).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+workspace_connectors/i);
    expect(migration).toMatch(/hostname\s+TEXT\s+PRIMARY\s+KEY/i);
    expect(migration).toMatch(/workspace_id\s+TEXT\s+NOT\s+NULL/i);
    expect(migration).toMatch(/record_json\s+TEXT\s+NOT\s+NULL/i);
    expect(migration).toMatch(/FOREIGN\s+KEY\s*\(connector_id\)\s+REFERENCES\s+workspace_connectors\s*\(connector_id\)/i);
    expect(migration).not.toMatch(/connector_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+['"]connected['"]/i);
    expect(migration).toMatch(/revoked_at\s+TEXT/i);
    expect(migration).toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
    expect(migration).not.toMatch(/tunnel_credential|api_token|signing_secret/i);
  });

  it('should add package scripts for dry-run deploy, migration, and runtime smoke verification', () => {
    const packageJson = JSON.parse(readRequiredFile(packageJsonPath)) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};

    expect(requireScript(scripts, 'cloudflare:workspace-edge:dev')).toMatch(/wrangler\s+dev/);
    expect(requireScript(scripts, 'cloudflare:workspace-edge:deploy:dry-run')).toMatch(/wrangler\s+deploy.*--dry-run/);
    expect(requireScript(scripts, 'cloudflare:workspace-edge:deploy')).toMatch(/wrangler\s+deploy/);
    expect(requireScript(scripts, 'cloudflare:workspace-edge:migrate')).toMatch(/wrangler\s+d1\s+migrations\s+apply/);
    expect(requireScript(scripts, 'cloudflare:workspace-edge:seed')).toMatch(/scripts\/seed-workspace-edge-route\.ts/);
    expect(requireScript(scripts, 'smoke:workspace-edge')).toMatch(/scripts\/smoke-workspace-edge\.ts/);
  });
});
