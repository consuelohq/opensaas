import {
  applyManagedCloudNodeFoundation,
  planManagedCloudNodeFoundation,
  type ManagedCloudNodeFoundationClient,
  type ManagedCloudNodeFoundationPlan,
  type ManagedCloudNodeFoundationOperation,
} from './managed-cloud-node';
import {
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
