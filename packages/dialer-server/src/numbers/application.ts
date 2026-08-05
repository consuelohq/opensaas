type CallerIdSelection =
  | { kind: 'automatic' }
  | { kind: 'explicit'; phoneNumber: string };

export const resolveEffectiveLineCount = (input: {
  requestedLines: number;
  planMaximum: number;
  activeAssignedNumbers: string[];
  callerIdSelection: CallerIdSelection;
}) => {
  const callerIds = [...new Set(input.activeAssignedNumbers)];
  if (input.callerIdSelection.kind === 'explicit') {
    if (!callerIds.includes(input.callerIdSelection.phoneNumber)) {
      throw new Error('CALLER_ID_NOT_ASSIGNED');
    }
    return {
      lineCount: Math.min(1, input.requestedLines, input.planMaximum),
      callerIds: [input.callerIdSelection.phoneNumber],
    };
  }
  const lineCount = Math.max(
    0,
    Math.min(input.requestedLines, input.planMaximum, callerIds.length),
  );
  return { lineCount, callerIds: callerIds.slice(0, lineCount) };
};

export const validateNumberAssignment = (input: {
  workspaceId: string;
  seatUserId: string;
  planMaximum: number;
  existingAssignments: Array<{
    workspaceId: string;
    userId: string;
    phoneNumber: string;
    status: 'active' | 'released';
  }>;
  phoneNumber: string;
}): void => {
  const active = input.existingAssignments.filter(
    (assignment) =>
      assignment.workspaceId === input.workspaceId &&
      assignment.status === 'active',
  );
  const existing = active.find(
    (assignment) => assignment.phoneNumber === input.phoneNumber,
  );
  if (existing?.userId && existing.userId !== input.seatUserId) {
    throw new Error('NUMBER_ALREADY_ASSIGNED');
  }
  const ownedCount = new Set(
    active
      .filter((assignment) => assignment.userId === input.seatUserId)
      .map((assignment) => assignment.phoneNumber),
  ).size;
  if (!existing && ownedCount >= input.planMaximum) {
    throw new Error('NUMBER_LIMIT_REACHED');
  }
};
