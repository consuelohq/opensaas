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
