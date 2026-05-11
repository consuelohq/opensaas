import { createWorkspaceArtifactDescriptor } from '../scripts/lib/artifacts';
import { proveGraphQLConnectivity } from '../scripts/lib/graphql-client';
import type { CallOutput, RunbookContext } from '../scripts/lib/types';

export async function runDailyRevenueBrief(input: unknown, context: RunbookContext): Promise<CallOutput> {
  const graphqlProof = await proveGraphQLConnectivity();
  const workspaceStatus = context.workspaceId
    ? 'workspace_configured'
    : 'workspace_not_provided';

  return {
    ok: true,
    name: context.manifestEntry.name,
    permission: context.manifestEntry.permission,
    requiresApproval: context.manifestEntry.requiresApproval,
    result: {
      summary: 'Daily revenue brief scaffold executed.',
      workspaceStatus,
      graphqlStatus: graphqlProof.status,
      graphql: {
        urlHost: graphqlProof.urlHost,
        hasApiKey: graphqlProof.hasApiKey,
        safeMessage: graphqlProof.safeMessage,
      },
      receivedInput: input,
      nextSteps: [
        'Wire real call analytics',
        'Wire lead prioritization',
        'Wire artifact output',
      ],
    },
    artifacts: [
      createWorkspaceArtifactDescriptor('daily-revenue-brief.json', 'json'),
    ],
    proposedWrites: [],
  };
}

