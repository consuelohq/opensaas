import type { InstallControlPlaneCanonicalUser } from '../../../../scripts/lib/install-control-plane';
import type {
  ManagedCloudPlanId,
  ManagedCloudRegionId,
} from '../../../../scripts/lib/managed-cloud-pricing';
import {
  publicManagedCloudProvisioningJob,
  type ManagedCloudProvisioningJob,
} from '../../../../scripts/lib/managed-cloud-provisioning';
import type {
  AccountWorkspace,
  DeviceAuthorityRuntime,
  WorkspaceCloudTrial,
} from '../types';
import { hashHex, rand, slug } from '../utils';
import { buildManagedCloudPublicCatalog } from './managed-cloud-pricing';

export const CLOUD_FIRST_TRIAL_MS = 14 * 24 * 60 * 60_000;
export const CLOUD_FIRST_PLAN_ID: ManagedCloudPlanId = 'standard';
export const CLOUD_FIRST_REGION_ID: ManagedCloudRegionId = 'us-east1';

export class CloudFirstOnboardingError extends Error {
  constructor(
    readonly code:
      | 'IDENTITY_DIRECTORY_UNAVAILABLE'
      | 'IDENTITY_AMBIGUOUS'
      | 'ACCOUNT_NOT_FOUND'
      | 'WORKSPACE_NAME_INVALID'
      | 'WORKSPACE_EXISTS'
      | 'PRICING_UNAVAILABLE'
      | 'ONBOARDING_UNAVAILABLE',
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CloudFirstOnboardingError';
  }
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const normalizeWorkspaceName = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

export async function resolveCanonicalWebUser(input: {
  runtime: DeviceAuthorityRuntime;
  email: string;
  intent: 'login' | 'signup';
}): Promise<{ user: InstallControlPlaneCanonicalUser; created: boolean }> {
  try {
    const repository = input.runtime.installControlPlaneRepository;
    if (!repository) {
      throw new CloudFirstOnboardingError(
        'IDENTITY_DIRECTORY_UNAVAILABLE',
        503,
        'Consuelo identity is temporarily unavailable.',
      );
    }
    const email = normalizeEmail(input.email);
    const existing = await repository.findCanonicalUsersByEmail(email);
    if (existing.length > 1) {
      throw new CloudFirstOnboardingError(
        'IDENTITY_AMBIGUOUS',
        409,
        'This Google identity is connected to more than one Consuelo user.',
      );
    }
    if (existing[0]) {
      if (existing[0].userId.startsWith('google:')) {
        throw new CloudFirstOnboardingError(
          'IDENTITY_AMBIGUOUS',
          409,
          'A legacy Google alias cannot be used as a canonical Consuelo user.',
        );
      }
      return { user: existing[0], created: false };
    }
    if (input.intent === 'login') {
      throw new CloudFirstOnboardingError(
        'ACCOUNT_NOT_FOUND',
        404,
        'No Consuelo account found for this Google account.',
      );
    }

    const digest = await hashHex(`consuelo:web-user:${email}`);
    const userId = `user_${digest.slice(0, 20)}`;
    const nowIso = new Date(input.runtime.now()).toISOString();
    await repository.upsertUser({
      userId,
      email,
      workspaceIds: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const created = await repository.findCanonicalUsersByEmail(email);
    if (created.length !== 1 || created[0]?.userId !== userId) {
      throw new CloudFirstOnboardingError(
        'IDENTITY_AMBIGUOUS',
        409,
        'This Google identity could not be bound unambiguously.',
      );
    }
    return { user: created[0], created: true };
  } catch (error: unknown) {
    if (error instanceof CloudFirstOnboardingError) throw error;
    throw new CloudFirstOnboardingError(
      'IDENTITY_DIRECTORY_UNAVAILABLE',
      503,
      'Consuelo identity is temporarily unavailable.',
    );
  }
}

export async function resolveWebOperatingAccountId(input: {
  runtime: DeviceAuthorityRuntime;
  user: InstallControlPlaneCanonicalUser;
  googleSubject: string;
}): Promise<string> {
  try {
    const canonicalMemberships = await input.runtime.store.listWorkspaceMemberships(
      input.user.userId,
    );
    if (canonicalMemberships.some((membership) => membership.status === 'active')) {
      return input.user.userId;
    }

    const googleSubject = input.googleSubject.trim();
    if (!googleSubject) return input.user.userId;
    const legacyAccountId = `google:${googleSubject}`;
    const legacyMemberships = (
      await input.runtime.store.listWorkspaceMemberships(legacyAccountId)
    ).filter((membership) => membership.status === 'active');
    if (legacyMemberships.length === 0) return input.user.userId;

    const canonicalWorkspaceIds = new Set(
      input.user.workspaceMemberships.map((membership) => membership.workspaceId),
    );
    if (
      canonicalWorkspaceIds.size > 0 &&
      !legacyMemberships.some((membership) =>
        canonicalWorkspaceIds.has(membership.workspaceId),
      )
    ) {
      return input.user.userId;
    }
    return legacyAccountId;
  } catch (error: unknown) {
    if (error instanceof CloudFirstOnboardingError) throw error;
    throw new CloudFirstOnboardingError(
      'IDENTITY_DIRECTORY_UNAVAILABLE',
      503,
      'Consuelo workspace identity is temporarily unavailable.',
    );
  }
}

async function derivedWorkspaceIdentity(input: {
  accountId: string;
  displayName: string;
}): Promise<Pick<AccountWorkspace, 'workspaceId' | 'workspaceSlug' | 'workspaceHost'>> {
  const baseSlug = slug(input.displayName).slice(0, 44);
  if (!baseSlug) {
    throw new CloudFirstOnboardingError(
      'WORKSPACE_NAME_INVALID',
      400,
      'Enter a workspace name.',
    );
  }
  try {
    const digest = await hashHex(
      `consuelo:cloud-first-workspace:${input.accountId}:${input.displayName.toLowerCase()}`,
    );
    const workspaceSlug = `${baseSlug}-${digest.slice(0, 6)}`;
    return {
      workspaceId: `workspace_${digest.slice(0, 20)}`,
      workspaceSlug,
      workspaceHost: `${workspaceSlug}.consuelohq.com`,
    };
  } catch {
    throw new CloudFirstOnboardingError(
      'ONBOARDING_UNAVAILABLE',
      503,
      'Cloud workspace setup is temporarily unavailable.',
    );
  }
}

function standardQuote(runtime: DeviceAuthorityRuntime) {
  const catalog = buildManagedCloudPublicCatalog(
    runtime.managedCloudPricing,
    CLOUD_FIRST_REGION_ID,
  );
  const quote = catalog.quotes.find(
    (candidate) =>
      candidate.plan.id === CLOUD_FIRST_PLAN_ID &&
      candidate.region.id === CLOUD_FIRST_REGION_ID,
  );
  if (!catalog.pricingAvailable || !quote) {
    throw new CloudFirstOnboardingError(
      'PRICING_UNAVAILABLE',
      503,
      'Cloud pricing is temporarily unavailable.',
    );
  }
  return quote;
}

export async function createCloudFirstWorkspace(input: {
  runtime: DeviceAuthorityRuntime;
  accountId: string;
  email: string;
  workspaceName: string;
}): Promise<{
  workspace: AccountWorkspace;
  trial: WorkspaceCloudTrial;
  job: ManagedCloudProvisioningJob;
}> {
  try {
  const displayName = normalizeWorkspaceName(input.workspaceName);
  if (displayName.length < 1 || displayName.length > 80) {
    throw new CloudFirstOnboardingError(
      'WORKSPACE_NAME_INVALID',
      400,
      'Workspace names must be between 1 and 80 characters.',
    );
  }

  // Pricing is validated before any durable workspace/trial mutation. This keeps
  // a temporary provider pricing outage from producing a half-onboarded tenant.
  const quote = standardQuote(input.runtime);
  const nowMs = input.runtime.now();
  const nowIso = new Date(nowMs).toISOString();
  const existingWorkspace = await input.runtime.store.byAccountWorkspace(
    input.accountId,
  );
  const existingTrial = existingWorkspace?.workspaceId
    ? await input.runtime.store.byWorkspaceCloudTrial(existingWorkspace.workspaceId)
    : undefined;
  if (existingWorkspace && !existingTrial) {
    throw new CloudFirstOnboardingError(
      'WORKSPACE_EXISTS',
      409,
      'This account already has a workspace.',
    );
  }
  if (existingWorkspace?.workspaceId && existingTrial) {
    const existingJob = await input.runtime.store.byManagedCloudProvisioningJob(
      existingTrial.provisioningJobId,
    );
    if (existingJob && existingJob.accountId !== input.accountId) {
      throw new CloudFirstOnboardingError(
        'WORKSPACE_EXISTS',
        409,
        'This workspace already exists but its cloud onboarding state is unavailable.',
      );
    }
    if (existingJob) {
      const repository = input.runtime.installControlPlaneRepository;
      if (!repository) {
        throw new CloudFirstOnboardingError(
          'IDENTITY_DIRECTORY_UNAVAILABLE',
          503,
          'Consuelo identity is temporarily unavailable.',
        );
      }
      await repository.upsertUser({
        userId: input.accountId,
        email: normalizeEmail(input.email),
        workspaceIds: [existingWorkspace.workspaceId],
        workspaceMembershipVerifiedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      return {
        workspace: existingWorkspace,
        trial: existingTrial,
        job: existingJob,
      };
    }
  }

  const workspace =
    existingWorkspace ??
    ({
      accountId: input.accountId,
      displayName,
      ...(await derivedWorkspaceIdentity({
        accountId: input.accountId,
        displayName,
      })),
      updatedAt: nowMs,
    } satisfies AccountWorkspace);
  if (!workspace.workspaceId) {
    throw new Error('cloud-first workspace requires a canonical workspace id');
  }

  if (!existingWorkspace) {
    await input.runtime.store.putAccountWorkspace(workspace);
  }
  await input.runtime.store.putWorkspaceMembership({
    accountId: input.accountId,
    workspaceId: workspace.workspaceId,
    workspaceSlug: workspace.workspaceSlug,
    workspaceHost: workspace.workspaceHost,
    status: 'active',
    createdAt: existingTrial?.createdAt ?? nowMs,
    updatedAt: nowMs,
  });

  const candidate: ManagedCloudProvisioningJob = {
    jobId: existingTrial?.provisioningJobId ?? rand('mcpj', 16),
    accountId: input.accountId,
    workspaceId: workspace.workspaceId,
    workspaceSlug: workspace.workspaceSlug,
    workspaceHost: workspace.workspaceHost,
    nodeId: rand('node', 16),
    nodeName: 'Cloud',
    planId: CLOUD_FIRST_PLAN_ID,
    region: CLOUD_FIRST_REGION_ID,
    pricingVersion: quote.pricingVersion,
    monthlyPriceCents: quote.monthlyPriceCents,
    currency: quote.currency,
    idempotencyKey: `cloud-first:${workspace.workspaceId}`,
    status: 'requested',
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  const trial = await input.runtime.store.createWorkspaceCloudTrial({
    accountId: input.accountId,
    workspaceId: workspace.workspaceId,
    planId: 'standard',
    provisioningJobId: candidate.jobId,
    startedAt: nowMs,
    endsAt: nowMs + CLOUD_FIRST_TRIAL_MS,
    createdAt: nowMs,
    updatedAt: nowMs,
  });
  const created = await input.runtime.store.createManagedCloudProvisioningJob(
    candidate,
  );

  const repository = input.runtime.installControlPlaneRepository;
  if (!repository) {
    throw new CloudFirstOnboardingError(
      'IDENTITY_DIRECTORY_UNAVAILABLE',
      503,
      'Consuelo identity is temporarily unavailable.',
    );
  }
  await repository.upsertUser({
    userId: input.accountId,
    email: normalizeEmail(input.email),
    workspaceIds: [workspace.workspaceId],
    workspaceMembershipVerifiedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return { workspace, trial, job: created.job };
  } catch (error: unknown) {
    if (error instanceof CloudFirstOnboardingError) throw error;
    throw new CloudFirstOnboardingError(
      'ONBOARDING_UNAVAILABLE',
      503,
      'Cloud workspace setup is temporarily unavailable.',
    );
  }
}

export async function cloudFirstProvisioningStatus(input: {
  runtime: DeviceAuthorityRuntime;
  accountId: string;
  jobId: string;
}) {
  try {
    const job = input.jobId
      ? await input.runtime.store.byManagedCloudProvisioningJob(input.jobId)
      : undefined;
    if (!job || job.accountId !== input.accountId) return undefined;
    const trial = await input.runtime.store.byWorkspaceCloudTrial(job.workspaceId);
    if (!trial || trial.accountId !== input.accountId) return undefined;
    return {
      job: publicManagedCloudProvisioningJob(job),
      trial: {
        planId: trial.planId,
        provisioningJobId: trial.provisioningJobId,
        startedAt: trial.startedAt,
        endsAt: trial.endsAt,
      },
    };
  } catch (error: unknown) {
    if (error instanceof CloudFirstOnboardingError) throw error;
    throw new CloudFirstOnboardingError(
      'ONBOARDING_UNAVAILABLE',
      503,
      'Cloud workspace status is temporarily unavailable.',
    );
  }
}
