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
  it('should ship a Wrangler-deployable workspace edge Worker with D1 bindings and wildcard workspace routes', () => {
    const wrangler = readRequiredFile(wranglerPath);

    expect(wrangler).toMatch(/name\s*=\s*["']consuelo-workspace-edge["']/);
    expect(wrangler).toMatch(/main\s*=\s*["']src\/index\.ts["']/);
    expect(wrangler).toMatch(/compatibility_date\s*=/);
    expect(wrangler).toMatch(/\[\[d1_databases\]\]/);
    expect(wrangler).toMatch(/binding\s*=\s*["']WORKSPACE_ROUTE_REGISTRY["']/);
    expect(wrangler).toMatch(/database_name\s*=\s*["']consuelo-workspace-route-registry["']/);
    expect(wrangler).toMatch(/pattern\s*=\s*["']\*\.consuelohq\.com\/\*["']/);
    expect(wrangler).toMatch(/zone_name\s*=\s*["']consuelohq\.com["']/);
    expect(wrangler).not.toMatch(/CONSUELO_EDGE_SIGNING_SECRET\s*=\s*["'][^"']+["']/);
    expect(wrangler).not.toMatch(/api[_-]?token\s*=\s*["'][^"']+["']/i);
  });

  it('should expose a Worker entrypoint that composes the router with the D1 registry and edge signing secret', () => {
    const worker = readRequiredFile(workerEntrypointPath);

    expect(worker).toMatch(/createWorkspaceCloudflareEdgeRouter/);
    expect(worker).toMatch(/createWorkspaceCloudflareD1RouteRegistry/);
    expect(worker).toMatch(/WORKSPACE_ROUTE_REGISTRY/);
    expect(worker).toMatch(/CONSUELO_EDGE_SIGNING_SECRET/);
    expect(worker).toMatch(
      /export\s+(?:(?:async\s+)?function|const)\s+fetch|export\s*\{[^}]*\bfetch\b[^}]*\}/,
    );
    expect(worker).toMatch(/fetch\s*\(/);
    expect(worker).not.toMatch(/process\.env/);
  });

  it('should ship a D1 migration for the edge route registry tables and indexes', () => {
    const migration = readRequiredFile(d1MigrationPath);

    expect(migration).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+workspace_hostname_routes/i);
    expect(migration).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+workspace_connectors/i);
    expect(migration).toMatch(/hostname\s+TEXT\s+NOT\s+NULL/i);
    expect(migration).toMatch(/workspace_id\s+TEXT\s+NOT\s+NULL/i);
    expect(migration).toMatch(/connector_status\s+TEXT\s+NOT\s+NULL/i);
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
    expect(requireScript(scripts, 'smoke:workspace-edge')).toMatch(/workspace-edge/);
  });
});
