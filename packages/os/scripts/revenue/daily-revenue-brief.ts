import { createWorkspaceArtifact } from '../lib/artifacts';
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

  const result = {
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
  };

  const artifact = createWorkspaceArtifact({
    traceId: context.traceId,
    workspaceId: context.workspaceId,
    createdByUserId: context.userId,
    skillName: context.manifestEntry.name,
    title: 'Daily Revenue Brief',
    fileName: 'daily-revenue-brief.json',
    type: 'brief',
    format: 'json',
    content: {
      generatedAt: new Date().toISOString(),
      traceId: context.traceId,
      skillName: context.manifestEntry.name,
      result,
    },
    inputSummary: input,
  });

  return {
    ok: true,
    name: context.manifestEntry.name,
    permission: context.manifestEntry.permission,
    requiresApproval: context.manifestEntry.requiresApproval,
    result,
    artifacts: [artifact],
    proposedWrites: [],
  };
}