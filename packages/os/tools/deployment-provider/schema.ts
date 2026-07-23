import type { ToolSchemaContribution } from '../package';

export const deploymentProviderOperations = [
  'detect',
  'auth.status',
  'context.current',
  'project.list',
  'service.list',
  'deployment.list',
  'deployment.status',
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
  deploy: 'Creates a new deployment and may change customer-facing runtime behavior.',
  redeploy: 'Rebuilds or restarts an existing deployment and may affect availability.',
  'environment.set': 'Changes provider environment metadata and can alter future deployments.',
  'environment.delete': 'Deletes provider environment metadata and can alter future deployments.',
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

// Worker 12 owns public facade registration. This package intentionally
// contributes no manifest definitions until the provider adapters exist.
export const toolSchemas = [] as const satisfies readonly ToolSchemaContribution[];
