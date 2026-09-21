import type {
  ManagedCloudPlanId,
  ManagedCloudRegionId,
} from './managed-cloud-pricing';

export type ManagedCloudProvisioningStatus =
  | 'requested'
  | 'provisioning'
  | 'booting'
  | 'connecting'
  | 'ready'
  | 'failed';

export type ManagedCloudProvisioningJob = {
  jobId: string;
  accountId: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  planId: ManagedCloudPlanId;
  region: ManagedCloudRegionId;
  pricingVersion: string;
  monthlyPriceCents: number;
  currency: 'USD';
  idempotencyKey: string;
  status: ManagedCloudProvisioningStatus;
  createdAt: number;
  updatedAt: number;
  leaseId?: string;
  leaseExpiresAt?: number;
  enrollmentNonce?: string;
  enrollmentExpiresAt?: number;
  enrollmentConsumedAt?: number;
  errorCode?: string;
  errorMessage?: string;
  readyAt?: number;
};

export type ManagedCloudProvisioningCreateResult =
  | { status: 'created'; job: ManagedCloudProvisioningJob }
  | { status: 'idempotent'; job: ManagedCloudProvisioningJob }
  | { status: 'active-conflict'; job: ManagedCloudProvisioningJob };

export type ManagedCloudProvisioningClaimResult =
  | { status: 'claimed'; job: ManagedCloudProvisioningJob }
  | { status: 'empty' };

export type ManagedCloudProvisioningPublicJob = Pick<
  ManagedCloudProvisioningJob,
  | 'jobId'
  | 'nodeId'
  | 'nodeName'
  | 'planId'
  | 'region'
  | 'pricingVersion'
  | 'monthlyPriceCents'
  | 'currency'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'errorCode'
  | 'errorMessage'
  | 'readyAt'
>;

export const MANAGED_CLOUD_PROVISIONING_LEASE_MS = 5 * 60_000;
export const MANAGED_CLOUD_ENROLLMENT_TTL_MS = 60 * 60_000;

export const managedCloudProvisioningTerminal = (
  status: ManagedCloudProvisioningStatus,
): boolean => status === 'ready' || status === 'failed';

export const publicManagedCloudProvisioningJob = (
  job: ManagedCloudProvisioningJob,
): ManagedCloudProvisioningPublicJob => ({
  jobId: job.jobId,
  nodeId: job.nodeId,
  nodeName: job.nodeName,
  planId: job.planId,
  region: job.region,
  pricingVersion: job.pricingVersion,
  monthlyPriceCents: job.monthlyPriceCents,
  currency: job.currency,
  status: job.status,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  ...(job.errorCode ? { errorCode: job.errorCode } : {}),
  ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
  ...(job.readyAt !== undefined ? { readyAt: job.readyAt } : {}),
});
