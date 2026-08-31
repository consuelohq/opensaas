import type { DialerPlanCode } from '../plans/catalog';

const ADMIN_ROLES = new Set(['owner', 'admin']);

export const authorizeCommercialAction = (input: {
  identity: { workspaceId: string; userId: string; role: string };
  targetWorkspaceId: string;
  action:
    | 'billing.manage'
    | 'numbers.manage'
    | 'seats.manage'
    | 'calls.start';
}): void => {
  if (input.identity.workspaceId !== input.targetWorkspaceId) {
    throw new Error('WORKSPACE_MISMATCH');
  }
  if (
    input.action !== 'calls.start' &&
    !ADMIN_ROLES.has(input.identity.role.toLowerCase())
  ) {
    throw new Error('ADMIN_REQUIRED');
  }
};

export const validateSeatInventory = (input: {
  purchased: Record<DialerPlanCode, number>;
  assignments: Array<{ userId: string; planCode: DialerPlanCode }>;
  requested: Record<DialerPlanCode, number>;
}): void => {
  const assigned = { single: 0, standard: 0, power: 0 };
  const users = new Set<string>();
  for (const assignment of input.assignments) {
    if (users.has(assignment.userId)) {
      throw new Error('DUPLICATE_SEAT_ASSIGNMENT');
    }
    users.add(assignment.userId);
    assigned[assignment.planCode] += 1;
  }
  for (const planCode of ['single', 'standard', 'power'] as const) {
    const requested = input.requested[planCode];
    if (!Number.isSafeInteger(requested) || requested < 0) {
      throw new Error('INVALID_SEAT_QUANTITY');
    }
    if (requested < assigned[planCode]) {
      throw new Error('ASSIGNED_SEAT_QUANTITY');
    }
  }
};
