import { createWorkspaceArtifactDescriptor } from '../lib/artifacts';
import { proveGraphQLConnectivity } from '../lib/graphql-client';
import type { CallOutput, SkillContext } from '../lib/types';

export async function runDailyRevenueBrief(input: unknown, context: SkillContext): Promise<CallOutput> {
  let graphqlProof: Awaited<ReturnType<typeof proveGraphQLConnectivity>>;
  try {
    graphqlProof = await proveGraphQLConnectivity();
  } catch (error: unknown) {
    graphqlProof = {
      status: 'query_failed' as const,
      hasApiKey: Boolean(process.env.CONSUELO_INTERNAL_GRAPHQL_API_KEY),
      safeMessage: error instanceof Error ? error.message.slice(0, 240) : 'GraphQL proof failed.',
    };
  }
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
