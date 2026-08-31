import {
  applyManagedCloudNode,
  applyManagedCloudNodeFoundation,
  planManagedCloudNode,
  planManagedCloudNodeFoundation,
  type ManagedCloudNodeClient,
  type ManagedCloudNodeFoundationClient,
  type ManagedCloudNodeFoundationPlan,
  type ManagedCloudNodeFoundationOperation,
  type ManagedCloudNodeOperation,
  type ManagedCloudNodePlan,
  type ManagedCloudNodeReleaseBootstrap,
} from './managed-cloud-node';
import {
  createGcloudManagedCloudNodeClient,
  createGcloudManagedCloudNodeFoundationClient,
  createLocalGcloudCommandRunner,
} from './gcloud-managed-cloud-node';

export type ProvisionManagedCloudNodeFoundationInput = {
  projectId: string;
  billingAccountId: string;
  region?: string;
  budgetAmountUsd?: number;
  dryRun?: boolean;
  client?: ManagedCloudNodeFoundationClient;
};

export type ProvisionManagedCloudNodeFoundationResult = {
  status: 'planned' | 'provisioned';
  plan: ManagedCloudNodeFoundationPlan;
  operations: ManagedCloudNodeFoundationOperation[];
};

export const provisionManagedCloudNodeFoundation = async (
  input: ProvisionManagedCloudNodeFoundationInput,
): Promise<ProvisionManagedCloudNodeFoundationResult> => {
  const plan = planManagedCloudNodeFoundation({
    projectId: input.projectId,
    billingAccountId: input.billingAccountId,
    region: input.region,
    budgetAmountUsd: input.budgetAmountUsd,
  });
  const client =
    input.client ??
    createGcloudManagedCloudNodeFoundationClient({
      projectId: plan.projectId,
      billingAccountId: plan.billingAccountId,
      run: createLocalGcloudCommandRunner(),
    });
  let result: Awaited<ReturnType<typeof applyManagedCloudNodeFoundation>>;
  try {
    result = await applyManagedCloudNodeFoundation({
      client,
      plan,
      dryRun: input.dryRun,
    });
  } catch (error: unknown) {
    throw new Error(
      `managed cloud node platform provisioning failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
  return {
    ...result,
    plan,
  };
};

export type ProvisionManagedCloudNodeInput = {
  projectId: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  region?: string;
  zone?: string;
  machineType?: string;
  release: ManagedCloudNodeReleaseBootstrap;
  provisioningEnrollment?: { jobId: string; enrollmentToken: string };
  dryRun?: boolean;
  client?: ManagedCloudNodeClient;
};

export type ProvisionManagedCloudNodeResult = {
  status: 'planned' | 'provisioned';
  plan: ManagedCloudNodePlan;
  operations: ManagedCloudNodeOperation[];
};

export const provisionManagedCloudNode = async (
  input: ProvisionManagedCloudNodeInput,
): Promise<ProvisionManagedCloudNodeResult> => {
  const plan = planManagedCloudNode({
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    workspaceHost: input.workspaceHost,
    nodeId: input.nodeId,
    nodeName: input.nodeName,
    region: input.region,
    zone: input.zone,
    machineType: input.machineType,
    release: input.release,
    provisioningEnrollment: input.provisioningEnrollment,
  });
  const client =
    input.client ??
    createGcloudManagedCloudNodeClient({
      run: createLocalGcloudCommandRunner(),
    });
  let result: Awaited<ReturnType<typeof applyManagedCloudNode>>;
  try {
    result = await applyManagedCloudNode({
      client,
      plan,
      dryRun: input.dryRun,
    });
  } catch (error: unknown) {
    throw new Error(
      `managed cloud node instance provisioning failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
  return {
    ...result,
    plan,
  };
};
