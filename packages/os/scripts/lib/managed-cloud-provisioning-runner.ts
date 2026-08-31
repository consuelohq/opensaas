import { getManagedCloudProviderProfile } from './managed-cloud-pricing';
import type { ManagedCloudProvisioningPublicJob } from './managed-cloud-provisioning';
import type { ManagedCloudNodeClient, ManagedCloudNodeReleaseBootstrap } from './managed-cloud-node';
import { provisionManagedCloudNode } from './platform-managed-cloud-node';

export type ManagedCloudProvisioningClaim = {
  job: ManagedCloudProvisioningPublicJob;
  workspace: {
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
  };
  leaseId: string;
  enrollmentToken: string;
};

export type ManagedCloudProvisioningAuthorityClient = {
  claim: () => Promise<ManagedCloudProvisioningClaim | undefined>;
  update: (input: {
    jobId: string;
    leaseId: string;
    status: 'provisioning' | 'booting' | 'failed';
    errorCode?: string;
    errorMessage?: string;
  }) => Promise<void>;
};

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const value = await response.json();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

export const createManagedCloudProvisioningAuthorityClient = (input: {
  authorityOrigin: string;
  provisionerSecret: string;
  fetchImpl?: typeof fetch;
}): ManagedCloudProvisioningAuthorityClient => {
  const origin = new URL(input.authorityOrigin).origin;
  const provisionerSecret = input.provisionerSecret.trim();
  if (!provisionerSecret) throw new Error('managed cloud provisioner secret is required');
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const headers = {
    authorization: `Bearer ${provisionerSecret}`,
    accept: 'application/json',
  };
  return {
    async claim() {
      try {
        const response = await fetchImpl(new URL('/internal/managed-cloud/provisioning/claim', origin), {
          method: 'POST',
          headers,
        });
        if (response.status === 204) return undefined;
        const body = await readJson(response);
        if (!response.ok) {
          throw new Error(`managed cloud provisioning claim failed (${response.status})`);
        }
        const job = body.job as ManagedCloudProvisioningPublicJob | undefined;
        const workspace = body.workspace as ManagedCloudProvisioningClaim['workspace'] | undefined;
        const leaseId = typeof body.leaseId === 'string' ? body.leaseId : '';
        const enrollmentToken = typeof body.enrollmentToken === 'string' ? body.enrollmentToken : '';
        if (!job?.jobId || !workspace?.workspaceId || !workspace.workspaceSlug || !workspace.workspaceHost || !leaseId || !enrollmentToken) {
          throw new Error('managed cloud provisioning claim response is incomplete');
        }
        return { job, workspace, leaseId, enrollmentToken };
      } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith('managed cloud provisioning claim')) throw error;
        throw new Error('managed cloud provisioning claim could not be completed', { cause: error });
      }
    },
    async update(update) {
      try {
        const response = await fetchImpl(new URL('/internal/managed-cloud/provisioning/state', origin), {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify(update),
        });
        if (!response.ok) {
          throw new Error(`managed cloud provisioning state update failed (${response.status})`);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith('managed cloud provisioning state update failed')) throw error;
        throw new Error('managed cloud provisioning state update could not be completed', { cause: error });
      }
    },
  };
};

export type RunManagedCloudProvisioningOnceInput = {
  authority: ManagedCloudProvisioningAuthorityClient;
  projectId: string;
  release: ManagedCloudNodeReleaseBootstrap;
  dryRun?: boolean;
  client?: ManagedCloudNodeClient;
  provision?: typeof provisionManagedCloudNode;
};

export const runManagedCloudProvisioningOnce = async (
  input: RunManagedCloudProvisioningOnceInput,
): Promise<{ status: 'idle' } | { status: 'provisioned'; jobId: string; nodeId: string }> => {
  const claim = await input.authority.claim();
  if (!claim) return { status: 'idle' };
  const provider = getManagedCloudProviderProfile(claim.job.planId);
  if (!provider) {
    await input.authority.update({
      jobId: claim.job.jobId,
      leaseId: claim.leaseId,
      status: 'failed',
      errorCode: 'MANAGED_CLOUD_PLAN_UNAVAILABLE',
      errorMessage: 'The selected cloud plan is no longer available.',
    });
    throw new Error(`managed cloud plan ${claim.job.planId} is unavailable`);
  }
  try {
    const provision = input.provision ?? provisionManagedCloudNode;
    await provision({
      projectId: input.projectId,
      workspaceId: claim.workspace.workspaceId,
      workspaceSlug: claim.workspace.workspaceSlug,
      workspaceHost: claim.workspace.workspaceHost,
      nodeId: claim.job.nodeId,
      nodeName: claim.job.nodeName,
      region: claim.job.region,
      machineType: provider.machineType,
      release: input.release,
      provisioningEnrollment: {
        jobId: claim.job.jobId,
        enrollmentToken: claim.enrollmentToken,
      },
      dryRun: input.dryRun,
      client: input.client,
    });
    await input.authority.update({
      jobId: claim.job.jobId,
      leaseId: claim.leaseId,
      status: 'booting',
    });
    return { status: 'provisioned', jobId: claim.job.jobId, nodeId: claim.job.nodeId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await input.authority.update({
        jobId: claim.job.jobId,
        leaseId: claim.leaseId,
        status: 'failed',
        errorCode: 'MANAGED_CLOUD_PROVISION_FAILED',
        errorMessage: message.slice(0, 240),
      });
    } catch {
      // Preserve the original provisioning failure; the lease expiry makes the job recoverable.
    }
    throw error;
  }
};
