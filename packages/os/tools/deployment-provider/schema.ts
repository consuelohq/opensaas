import type { ToolSchemaContribution } from '../package';

export const deploymentProviderOperations = [
  'detect',
  'auth.status',
  'context.current',
  'project.list',
  'service.list',
  'project.link',
  'project.configuration',
  'domain.list',
  'deployment.list',
  'deployment.status',
  'deployment.promote',
  'logs.read',
  'deploy',
  'redeploy',
  'environment.listNames',
  'environment.set',
  'environment.delete',
  'raw',
] as const;

export type DeploymentProviderOperation = typeof deploymentProviderOperations[number];
export type DeploymentProviderCapability = DeploymentProviderOperation;

export type ProviderApprovalMetadata = {
  required: boolean;
  consequence?: string;
};

export type ProviderOperationPolicy = {
  operation: DeploymentProviderOperation;
  capability: DeploymentProviderCapability;
  readOnly: boolean;
  mutating: boolean;
  approval: ProviderApprovalMetadata;
};

const mutationConsequences: Partial<Record<DeploymentProviderOperation, string>> = {
  'project.link': 'Links the current checkout to a remote provider project and changes local provider context.',
  'deployment.promote': 'Promotes an existing deployment and may reassign customer-facing traffic.',
  deploy: 'Creates a new deployment and may change customer-facing runtime behavior.',
  redeploy: 'Rebuilds or restarts an existing deployment and may affect availability.',
  'environment.set': 'Changes provider environment metadata and can alter future deployments.',
  'environment.delete': 'Deletes provider environment metadata and can break future deployments.',
  raw: 'Runs an arbitrary provider CLI command that may change remote resources.',
};

export const providerOperationPolicy = (
  operation: DeploymentProviderOperation,
): ProviderOperationPolicy => {
  const consequence = mutationConsequences[operation];
  const mutating = consequence !== undefined;
  return {
    operation,
    capability: operation,
    readOnly: !mutating,
    mutating,
    approval: mutating
      ? { required: true, consequence }
      : { required: false },
  };
};

const order = [
  'name',
  'methodPath',
  'description',
  'category',
  'underlying',
  'capabilities',
  'defaultTimeout',
  'inputSchema',
  'outputSchema',
  'command',
  'exampleInput',
  'sessionRequired',
] as const;

const contribution = (
  name: string,
  description: string,
  inputSchema: string,
  exampleInput: Record<string, unknown>,
  mutating = false,
  defaultTimeout = 120_000,
): ToolSchemaContribution => ({
  name,
  order,
  definition: {
    name,
    methodPath: name.split('.'),
    description,
    category: 'deployment',
    underlying: `workspace ${name}`,
    capabilities: {
      readOnly: !mutating,
      mutating,
      deterministic: false,
      safeToRetry: !mutating,
    },
    defaultTimeout,
    inputSchema,
    outputSchema: 'RawOutput',
    exampleInput,
    sessionRequired: false,
  },
});

export const toolSchemas = [
  contribution(
    'deployment.detect',
    'detect the Railway, Vercel, or Cloudflare CLI and report its supported version; returns provider-specific install guidance when missing',
    'DeploymentDetectInput',
    { provider: 'railway' },
  ),
  contribution(
    'deployment.context',
    'inspect local Railway, Vercel, or Cloudflare authentication or linked project context without exposing credentials',
    'DeploymentContextInput',
    { provider: 'railway', action: 'current' },
  ),
  contribution(
    'deployment.list',
    'list Railway, Vercel, or Cloudflare projects, services, deployments, or domains using the selected provider CLI',
    'DeploymentListInput',
    { provider: 'railway', resource: 'deployments', serviceId: 'api' },
  ),
  contribution(
    'deployment.status',
    'inspect one Railway, Vercel, or Cloudflare deployment status by deployment id',
    'DeploymentStatusInput',
    { provider: 'railway', deploymentId: 'deployment-id' },
  ),
  contribution(
    'deployment.logs',
    'read bounded Railway, Vercel, or Cloudflare runtime or build logs without changing provider state',
    'DeploymentLogsInput',
    { provider: 'railway', serviceId: 'api', limit: 100 },
    false,
    180_000,
  ),
  contribution(
    'deployment.deploy',
    'deploy, redeploy, or promote through Railway, Vercel, or Cloudflare; requires explicit local approval before provider execution',
    'DeploymentDeployInput',
    { provider: 'railway', action: 'redeploy', serviceId: 'api', approved: true, approvalReason: 'Approved deployment mutation' },
    true,
    900_000,
  ),
  contribution(
    'deployment.environment',
    'list environment variable names or explicitly approved set/delete mutations for Railway, Vercel, or Cloudflare; secret values are never returned',
    'DeploymentEnvironmentInput',
    { provider: 'railway', action: 'list', serviceId: 'api' },
    true,
  ),
  contribution(
    'deployment.raw',
    'run an explicitly approved raw Railway, Vercel, or Cloudflare CLI argv without shell evaluation',
    'DeploymentRawInput',
    { provider: 'railway', args: ['status', '--json'], approved: true, approvalReason: 'Approved raw provider command' },
    true,
  ),
] as const satisfies readonly ToolSchemaContribution[];
