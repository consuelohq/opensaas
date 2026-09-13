import type {
  InstallControlPlaneCanonicalUser,
  InstallControlPlaneRepository,
} from '../../../../scripts/lib/install-control-plane';

import { hashHex } from '../utils';

export type CanonicalUserResolution =
  | {
      status: 'resolved';
      user: InstallControlPlaneCanonicalUser;
      created: boolean;
    }
  | {
      status: 'denied';
      reason: 'directory_unavailable' | 'user_not_found' | 'ambiguous_user';
    };

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export async function resolveCanonicalUser(input: {
  repository?: InstallControlPlaneRepository;
  email: string;
  createIfMissing: boolean;
  nowMs: number;
}): Promise<CanonicalUserResolution> {
  const repository = input.repository;
  if (!repository) {
    return { status: 'denied', reason: 'directory_unavailable' };
  }

  const email = normalizeEmail(input.email);
  let existing: InstallControlPlaneCanonicalUser[];
  try {
    existing = await repository.findCanonicalUsersByEmail(email);
  } catch {
    return { status: 'denied', reason: 'directory_unavailable' };
  }

  if (existing.length > 1 || existing[0]?.userId.startsWith('google:')) {
    return { status: 'denied', reason: 'ambiguous_user' };
  }
  if (existing[0]) {
    return { status: 'resolved', user: existing[0], created: false };
  }
  if (!input.createIfMissing) {
    return { status: 'denied', reason: 'user_not_found' };
  }

  const digest = await hashHex(`consuelo:web-user:${email}`);
  const userId = `user_${digest.slice(0, 20)}`;
  const nowIso = new Date(input.nowMs).toISOString();
  try {
    await repository.upsertUser({
      userId,
      email,
      workspaceIds: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    const created = await repository.findCanonicalUsersByEmail(email);
    if (created.length !== 1 || created[0]?.userId !== userId) {
      return { status: 'denied', reason: 'ambiguous_user' };
    }
    return { status: 'resolved', user: created[0], created: true };
  } catch {
    return { status: 'denied', reason: 'directory_unavailable' };
  }
}

export async function verifyCanonicalWorkspaceMembership(input: {
  repository?: InstallControlPlaneRepository;
  userId: string;
  email?: string;
  workspaceId: string;
  nowMs: number;
}): Promise<void> {
  const repository = input.repository;
  if (!repository) {
    throw new Error('canonical identity directory is unavailable');
  }
  const nowIso = new Date(input.nowMs).toISOString();
  try {
    await repository.upsertUser({
      userId: input.userId,
      ...(input.email?.trim() ? { email: normalizeEmail(input.email) } : {}),
      workspaceIds: [input.workspaceId],
      workspaceMembershipVerifiedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } catch (error: unknown) {
    throw new Error(
      `canonical workspace verification failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
