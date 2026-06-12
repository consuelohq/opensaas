import {
  createWorkspaceEdgeBetaSmokePlan,
  type WorkspaceEdgeBetaSmokePlan,
} from './lib/workspace-edge-beta-smoke';

type SmokeArgs = {
  workspaceHost: string;
  connectorId: string;
  localPort: number;
  execute: boolean;
};

const readArg = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const parseArgs = (): SmokeArgs => {
  const workspaceHost =
    readArg('--workspace-host') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SMOKE_HOST ??
    'internal.consuelohq.com';
  const connectorId =
    readArg('--connector-id') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SMOKE_CONNECTOR_ID ??
    'connector_smoke_internal';
  const localPortInput =
    readArg('--local-port') ??
    process.env.CONSUELO_WORKSPACE_EDGE_SMOKE_LOCAL_PORT ??
    '8787';
  const localPort = Number(localPortInput);

  if (!Number.isInteger(localPort) || localPort <= 0 || localPort > 65535) {
    throw new Error('workspace edge smoke requires a valid --local-port');
  }

  return {
    workspaceHost,
    connectorId,
    localPort,
    execute: process.argv.includes('--execute'),
  };
};

const summarizePlan = (plan: WorkspaceEdgeBetaSmokePlan): string =>
  `${JSON.stringify(
    {
      ok: true,
      mode: 'plan',
      workspaceHost: plan.workspaceHost,
      connectorId: plan.connectorId,
      stepCount: plan.steps.length,
      steps: plan.steps,
      redactions: plan.redactions,
    },
    null,
    2,
  )}
`;

const run = (): void => {
  const args = parseArgs();
  const plan = createWorkspaceEdgeBetaSmokePlan({
    workspaceHost: args.workspaceHost,
    connectorId: args.connectorId,
    localPort: args.localPort,
  });

  if (args.execute) {
    throw new Error(
      'workspace edge live smoke execution is not enabled until staging Worker routing is deployed',
    );
  }

  process.stdout.write(summarizePlan(plan));
};

run();
