type CallerIdSelection =
  | { kind: 'automatic' }
  | { kind: 'explicit'; phoneNumber: string };

const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return digits.length > 0 ? `+${digits}` : '';
};

export const resolveEffectiveLineCount = (input: {
  requestedLines: number;
  planMaximum: number;
  activeAssignedNumbers: string[];
  callerIdSelection: CallerIdSelection;
}) => {
  const callerIds = [
    ...new Set(input.activeAssignedNumbers.map(normalizePhone).filter(Boolean)),
  ];
  if (input.callerIdSelection.kind === 'explicit') {
    const selectedPhoneNumber = normalizePhone(
      input.callerIdSelection.phoneNumber,
    );
    if (!callerIds.includes(selectedPhoneNumber)) {
      throw new Error('CALLER_ID_NOT_ASSIGNED');
    }
    return {
      lineCount: Math.min(1, input.requestedLines, input.planMaximum),
      callerIds: [selectedPhoneNumber],
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
  const requestedPhoneNumber = normalizePhone(input.phoneNumber);
  const existing = active.find(
    (assignment) =>
      normalizePhone(assignment.phoneNumber) === requestedPhoneNumber,
  );
  if (existing?.userId && existing.userId !== input.seatUserId) {
    throw new Error('NUMBER_ALREADY_ASSIGNED');
  }
  const ownedCount = new Set(
    active
      .filter((assignment) => assignment.userId === input.seatUserId)
      .map((assignment) => normalizePhone(assignment.phoneNumber)),
  ).size;
  if (!existing && ownedCount >= input.planMaximum) {
    throw new Error('NUMBER_LIMIT_REACHED');
  }
};
