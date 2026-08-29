import type { InstallControlPlaneRepository } from '../../../../scripts/lib/install-control-plane';

import type { AccountWorkspace, Store } from '../types';

export type CanonicalDeviceIdentityDeniedReason =
  | 'directory_unavailable'
  | 'user_not_found'
  | 'ambiguous_user'
  | 'workspace_verification_required';

export const CANONICAL_WORKSPACE_VERIFICATION_MAX_AGE_MS = 15 * 60 * 1000;
export const CANONICAL_ESTABLISHED_WORKSPACE_VERIFICATION_MAX_AGE_MS =
  7 * 24 * 60 * 60 * 1000;

export type CanonicalDeviceIdentityDenialDescription = {
  status: 403 | 409 | 503;
  code:
    | 'DEVICE_DIRECTORY_UNAVAILABLE'
    | 'CANONICAL_USER_NOT_FOUND'
    | 'CANONICAL_USER_AMBIGUOUS'
    | 'WORKSPACE_VERIFICATION_REQUIRED';
  message: string;
};

export function describeCanonicalDeviceIdentityDenial(
  reason: CanonicalDeviceIdentityDeniedReason,
): CanonicalDeviceIdentityDenialDescription {
  switch (reason) {
    case 'directory_unavailable':
      return {
        status: 503,
        code: 'DEVICE_DIRECTORY_UNAVAILABLE',
        message: 'The Consuelo account directory is temporarily unavailable. Retry device approval shortly.',
      };
    case 'user_not_found':
      return {
        status: 403,
        code: 'CANONICAL_USER_NOT_FOUND',
        message: 'This Google account is not registered with Consuelo. Sign in to Consuelo or ask an administrator to verify the account.',
      };
    case 'ambiguous_user':
      return {
        status: 409,
        code: 'CANONICAL_USER_AMBIGUOUS',
        message: 'This Google account matches multiple Consuelo users. Ask an administrator to reconcile the account before retrying.',
      };
    case 'workspace_verification_required':
      return {
        status: 403,
        code: 'WORKSPACE_VERIFICATION_REQUIRED',
        message: 'This account does not have a verified workspace membership for device approval. Sign in to Consuelo or ask an administrator to verify the workspace.',
      };
  }
}

export type CanonicalDeviceIdentityResult =
  | {
      status: 'resolved';
      canonicalUserId: string;
      canonicalWorkspaceId: string;
      operatingAccountId: string;
      workspaceRoute?: Pick<
        AccountWorkspace,
        'workspaceId' | 'workspaceSlug' | 'workspaceHost'
      >;
    }
  | { status: 'denied'; reason: CanonicalDeviceIdentityDeniedReason };

function membershipVerificationIsCurrent(
  membership: { verifiedAt: string },
  nowMs: number,
  maxAgeMs: number,
): boolean {
  return nowMs - Date.parse(membership.verifiedAt) <= maxAgeMs;
}

export async function resolveCanonicalDeviceIdentity(input: {
  repository?: InstallControlPlaneRepository;
  store: Store;
  email: string;
  googleSubject: string;
  nowMs: number;
}): Promise<CanonicalDeviceIdentityResult> {
  if (!input.repository) {
    return { status: 'denied', reason: 'directory_unavailable' };
  }

  let users;
  try {
    users = await input.repository.findCanonicalUsersByEmail(input.email);
  } catch {
    return { status: 'denied', reason: 'directory_unavailable' };
  }
  if (users.length === 0) {
    return { status: 'denied', reason: 'user_not_found' };
  }
  if (users.length !== 1) {
    return { status: 'denied', reason: 'ambiguous_user' };
  }

  const user = users[0]!;
  const memberships = user.workspaceMemberships.filter(({ workspaceId }) =>
    Boolean(workspaceId.trim()),
  );
  if (memberships.length === 0) {
    return { status: 'denied', reason: 'workspace_verification_required' };
  }
  const verifiedMemberships = memberships.filter((membership) => {
    const verifiedAtMs = Date.parse(membership.verifiedAt);
    return Number.isFinite(verifiedAtMs) && verifiedAtMs <= input.nowMs;
  });
  if (verifiedMemberships.length === 0) {
    return { status: 'denied', reason: 'workspace_verification_required' };
  }

  const canonicalWorkspace = await input.store.byAccountWorkspace(user.userId);
  const canonicalMembership = canonicalWorkspace
    ? verifiedMemberships.find(
        ({ workspaceId }) => workspaceId === canonicalWorkspace.workspaceId,
      )
    : undefined;
  if (
    canonicalWorkspace &&
    canonicalMembership &&
    membershipVerificationIsCurrent(
      canonicalMembership,
      input.nowMs,
      CANONICAL_ESTABLISHED_WORKSPACE_VERIFICATION_MAX_AGE_MS,
    )
  ) {
    return {
      status: 'resolved',
      canonicalUserId: user.userId,
      canonicalWorkspaceId: canonicalMembership.workspaceId,
      operatingAccountId: user.userId,
      workspaceRoute: {
        workspaceId: canonicalMembership.workspaceId,
        workspaceSlug: canonicalWorkspace.workspaceSlug,
        workspaceHost: canonicalWorkspace.workspaceHost,
      },
    };
  }

  const legacyAccountId = `google:${input.googleSubject}`;
  const legacyWorkspace = await input.store.byAccountWorkspace(legacyAccountId);
  const legacyMembership = legacyWorkspace
    ? verifiedMemberships.find(
        ({ workspaceId }) => workspaceId === legacyWorkspace.workspaceId,
      )
    : undefined;
  if (
    legacyWorkspace &&
    legacyMembership &&
    membershipVerificationIsCurrent(
      legacyMembership,
      input.nowMs,
      CANONICAL_ESTABLISHED_WORKSPACE_VERIFICATION_MAX_AGE_MS,
    )
  ) {
    return {
      status: 'resolved',
      canonicalUserId: user.userId,
      canonicalWorkspaceId: legacyMembership.workspaceId,
      operatingAccountId: legacyAccountId,
      workspaceRoute: {
        workspaceId: legacyMembership.workspaceId,
        workspaceSlug: legacyWorkspace.workspaceSlug,
        workspaceHost: legacyWorkspace.workspaceHost,
      },
    };
  }

  const newestWorkspace = verifiedMemberships.reduce(
    (newestVerifiedMembership, membership) =>
      Date.parse(membership.verifiedAt) >
      Date.parse(newestVerifiedMembership.verifiedAt)
        ? membership
        : newestVerifiedMembership,
  );
  const verificationAgeMs = input.nowMs - Date.parse(newestWorkspace.verifiedAt);
  if (verificationAgeMs > CANONICAL_WORKSPACE_VERIFICATION_MAX_AGE_MS) {
    return { status: 'denied', reason: 'workspace_verification_required' };
  }

  return {
    status: 'resolved',
    canonicalUserId: user.userId,
    canonicalWorkspaceId: newestWorkspace.workspaceId,
    operatingAccountId: user.userId,
  };
}
