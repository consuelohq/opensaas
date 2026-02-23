export type CallParticipant = {
  callSid: string;
  label: 'agent' | 'customer' | 'transfer-target';
  phoneNumber?: string;
};

export type ActiveDealContext = {
  dealId: string;
  dealName: string;
  stage: string;
  value: number;
  lastActivityAt: Date;
  daysInStage: number;
};

export type ExpandedCallContext = {
  callSid: string;
  contactId: string;
  contactName: string;
  direction: 'inbound' | 'outbound';
  startedAt: Date;
  durationSeconds: number;
  participants: CallParticipant[];
  dealContext?: ActiveDealContext;
  recentNotes: string[];
};
