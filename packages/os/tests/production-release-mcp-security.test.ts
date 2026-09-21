import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflowPath = join(
  process.cwd(),
  '..',
  '..',
  '.github',
  'workflows',
  'consuelo-production-release.yaml',
);

describe('production release MCP security controls', () => {
  it('keeps full MCP ingress reconciliation explicit and reproducible', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('reconcile_mcp_ingress_policy:');
    expect(workflow).toContain(
      "if: github.event_name == 'workflow_dispatch' && inputs.reconcile_mcp_ingress_policy",
    );
    expect(workflow).toContain(
      'bun packages/os/scripts/provision-managed-os-mcp-ingress-policy.ts --base-domain consuelohq.com --json',
    );
    expect(workflow).toContain(
      'CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME: mcp_allowed_ips',
    );
    expect(workflow).toContain(
      'CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_WAF_API_TOKEN }}',
    );
  });

  it('preflights dedicated Workspace Edge D1 authorization before any OS release mutation', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    const releaseStep = workflow.indexOf('- name: Release Consuelo OS');
    const releaseCommand = workflow.indexOf('bun run os:release', releaseStep);
    const tokenCheck = workflow.indexOf('Missing GitHub Actions secret CLOUDFLARE_WORKSPACE_EDGE_API_TOKEN', releaseStep);
    const d1Preflight = workflow.indexOf('wrangler d1 execute consuelo-workspace-route-registry', releaseStep);

    expect(workflow).toContain(
      'CLOUDFLARE_WORKSPACE_EDGE_API_TOKEN: ${{ secrets.CLOUDFLARE_WORKSPACE_EDGE_API_TOKEN }}',
    );
    expect(workflow).not.toContain(
      'CLOUDFLARE_WORKSPACE_EDGE_API_TOKEN: ${{ secrets.CLOUDFLARE_WORKSPACE_EDGE_API_TOKEN || secrets.CLOUDFLARE_OS_PROVISIONING_API_TOKEN }}',
    );
    expect(releaseStep).toBeGreaterThan(-1);
    expect(tokenCheck).toBeGreaterThan(releaseStep);
    expect(d1Preflight).toBeGreaterThan(tokenCheck);
    expect(releaseCommand).toBeGreaterThan(d1Preflight);
    expect(workflow.slice(tokenCheck, releaseCommand)).toContain(
      'CLOUDFLARE_API_TOKEN="${CLOUDFLARE_WORKSPACE_EDGE_API_TOKEN}"',
    );
    expect(workflow.slice(tokenCheck, releaseCommand)).toContain('SELECT 1 AS ok');
  });

  it('does not conflate connector-origin migration with full policy reconciliation', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    const migrationIndex = workflow.indexOf(
      'bun packages/os/scripts/migrate-managed-os-mcp-origin-class.ts --json',
    );
    const reconciliationIndex = workflow.indexOf(
      'bun packages/os/scripts/provision-managed-os-mcp-ingress-policy.ts --base-domain consuelohq.com --json',
    );

    expect(migrationIndex).toBeGreaterThan(-1);
    expect(reconciliationIndex).toBeGreaterThan(-1);
    expect(reconciliationIndex).not.toBe(migrationIndex);
  });
});
