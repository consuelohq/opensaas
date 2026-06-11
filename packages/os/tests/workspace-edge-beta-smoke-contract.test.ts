import { describe, expect, it } from 'vitest';

type SmokeStep = {
  id: string;
  kind: 'local' | 'edge' | 'dialer' | 'os-connector';
  method: 'GET' | 'POST';
  url: string;
  expectedStatus: number;
  signedLocal?: boolean;
  signedEdge?: boolean;
};

type SmokePlan = {
  workspaceHost: string;
  connectorId: string;
  steps: SmokeStep[];
  redactions: string[];
};

type SmokeContract = {
  createWorkspaceEdgeBetaSmokePlan: (input: {
    workspaceHost: string;
    connectorId: string;
    localPort: number;
    dialerPath?: string;
    osPath?: string;
  }) => SmokePlan;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadSmokeContract(): Promise<SmokeContract> {
  const module = (await import(
    new URL('../scripts/lib/workspace-edge-beta-smoke.ts', import.meta.url).href
  )) as Partial<SmokeContract>;

  if (typeof module.createWorkspaceEdgeBetaSmokePlan !== 'function') {
    throw new Error(
      'workspace edge beta smoke contract module is missing export: createWorkspaceEdgeBetaSmokePlan',
    );
  }

  return module as SmokeContract;
}

contractDescribe('workspace edge beta smoke contract', () => {
  it('should define the complete clean install to public workspace edge smoke path when workspace is public', async () => {
    const { createWorkspaceEdgeBetaSmokePlan } = await loadSmokeContract();

    const plan = createWorkspaceEdgeBetaSmokePlan({
      workspaceHost: 'kokayi.consuelohq.com',
      connectorId: 'connector_123',
      localPort: 8850,
      dialerPath: '/dialer/calls',
      osPath: '/traces',
    });

    expect(plan.steps.map((step) => step.id)).toEqual([
      'local-health-is-public',
      'local-protected-route-requires-signature',
      'local-signed-get-steering-succeeds',
      'local-replayed-signature-is-denied',
      'edge-unknown-workspace-fails-closed',
      'edge-revoked-workspace-fails-closed',
      'edge-dialer-route-reaches-railway-through-signed-internal-headers',
      'edge-os-route-reaches-installed-os-through-outbound-connector',
    ]);
    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'local-health-is-public',
          kind: 'local',
          url: 'http://127.0.0.1:8850/health',
          expectedStatus: 200,
        }),
        expect.objectContaining({
          id: 'local-protected-route-requires-signature',
          kind: 'local',
          url: 'http://127.0.0.1:8850/get_steering',
          expectedStatus: 401,
          signedLocal: false,
        }),
        expect.objectContaining({
          id: 'local-signed-get-steering-succeeds',
          kind: 'local',
          expectedStatus: 200,
          signedLocal: true,
        }),
        expect.objectContaining({
          id: 'edge-dialer-route-reaches-railway-through-signed-internal-headers',
          kind: 'dialer',
          url: 'https://kokayi.consuelohq.com/dialer/calls',
          expectedStatus: 200,
          signedEdge: true,
        }),
        expect.objectContaining({
          id: 'edge-os-route-reaches-installed-os-through-outbound-connector',
          kind: 'os-connector',
          url: 'https://kokayi.consuelohq.com/traces',
          expectedStatus: 200,
          signedEdge: true,
        }),
      ]),
    );
    expect(plan.redactions).toEqual(
      expect.arrayContaining([
        'generated auth material',
        'connector bootstrap material',
        'edge signer material',
      ]),
    );
  });

  it('should check unknown and revoked workspace hosts before positive public route checks when planning beta smoke', async () => {
    const { createWorkspaceEdgeBetaSmokePlan } = await loadSmokeContract();
    const plan = createWorkspaceEdgeBetaSmokePlan({
      workspaceHost: 'kokayi.consuelohq.com',
      connectorId: 'connector_123',
      localPort: 8850,
    });

    const ids = plan.steps.map((step) => step.id);
    const firstPositiveEdgeIndex = ids.findIndex((id) => id.includes('reaches'));

    expect(ids.indexOf('edge-unknown-workspace-fails-closed')).toBeGreaterThan(-1);
    expect(ids.indexOf('edge-revoked-workspace-fails-closed')).toBeGreaterThan(-1);
    expect(ids.indexOf('edge-unknown-workspace-fails-closed')).toBeLessThan(firstPositiveEdgeIndex);
    expect(ids.indexOf('edge-revoked-workspace-fails-closed')).toBeLessThan(firstPositiveEdgeIndex);
  });
});
