import type { InstallControlPlaneRepository } from '../../../../scripts/lib/install-control-plane';

import type { AccountWorkspace, Store } from '../types';

export type CanonicalDeviceIdentityDeniedReason =
  | 'directory_unavailable'
  | 'user_not_found'
  | 'ambiguous_user'
  | 'workspace_verification_required';

export const CANONICAL_WORKSPACE_VERIFICATION_MAX_AGE_MS = 15 * 60 * 1000;

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
  const newestWorkspace = memberships[0]!;
  const verifiedAtMs = Date.parse(newestWorkspace.verifiedAt);
  const verificationAgeMs = input.nowMs - verifiedAtMs;
  if (
    !Number.isFinite(verifiedAtMs) ||
    verificationAgeMs < 0 ||
    verificationAgeMs > CANONICAL_WORKSPACE_VERIFICATION_MAX_AGE_MS
  ) {
    return { status: 'denied', reason: 'workspace_verification_required' };
  }

  const canonicalWorkspace = await input.store.byAccountWorkspace(user.userId);
  if (canonicalWorkspace?.workspaceId === newestWorkspace.workspaceId) {
    return {
      status: 'resolved',
      canonicalUserId: user.userId,
      canonicalWorkspaceId: newestWorkspace.workspaceId,
      operatingAccountId: user.userId,
      workspaceRoute: {
        workspaceId: newestWorkspace.workspaceId,
        workspaceSlug: canonicalWorkspace.workspaceSlug,
        workspaceHost: canonicalWorkspace.workspaceHost,
      },
    };
  }

  if (canonicalWorkspace) {
    return {
      status: 'resolved',
      canonicalUserId: user.userId,
      canonicalWorkspaceId: newestWorkspace.workspaceId,
      operatingAccountId: user.userId,
    };
  }

  const legacyAccountId = `google:${input.googleSubject}`;
  const legacyWorkspace = await input.store.byAccountWorkspace(legacyAccountId);
  if (legacyWorkspace?.workspaceId === newestWorkspace.workspaceId) {
    return {
      status: 'resolved',
      canonicalUserId: user.userId,
      canonicalWorkspaceId: newestWorkspace.workspaceId,
      operatingAccountId: legacyAccountId,
      workspaceRoute: {
        workspaceId: newestWorkspace.workspaceId,
        workspaceSlug: legacyWorkspace.workspaceSlug,
        workspaceHost: legacyWorkspace.workspaceHost,
      },
    };
  }

  return {
    status: 'resolved',
    canonicalUserId: user.userId,
    canonicalWorkspaceId: newestWorkspace.workspaceId,
    operatingAccountId: user.userId,
  };
}
