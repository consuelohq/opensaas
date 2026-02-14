/** Contact info displayed in the dialer sidebar */
export interface DialerContact {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  // phase 4 — contact integration fields (DEV-729)
  twentyPersonId?: string;
  phoneRaw?: string;
  phoneStatus?: 'valid' | 'invalid' | 'unknown';
  lastCalled?: string | null;
  callCount?: number;
  timezone?: string | null;
  lastNote?: string | null;
  tags?: string[];
  dncStatus?: boolean;
}

/** Call lifecycle states */
export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'ringing'
  | 'active'
  | 'ended'
  | 'failed';

/** Browser WebRTC vs phone callback */
export type CallingMode = 'browser' | 'phone';

/** Core call state tracked in recoil */
export interface CallState {
  status: CallStatus;
  callSid: string | null;
  duration: number;
  startedAt: Date | null;
  contact: DialerContact | null;
  callingMode: CallingMode;
  fromNumber: string | null;
  parallelGroupId: string | null;
  transferId: string | null;
}

/** Audio input/output device info */
export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

/** DTMF tone keys */
export type DTMFKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '*'
  | '#';

/** Dial pad key with sub-label letters */
export interface DialPadKey {
  digit: DTMFKey;
  letters: string;
}

/** Available caller ID for outbound calls */
export interface CallerIdOption {
  phoneNumber: string;
  friendlyName: string;
  areaCode: string;
}

/** Transfer types supported by the dialer */
export type TransferType = 'cold' | 'warm';

/** Transfer lifecycle states */
export type TransferStatus =
  | 'initiating'
  | 'ringing'
  | 'consulting'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Transfer error codes from backend */
export type TransferErrorCode =
  | 'CALL_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'CALL_NOT_ACTIVE'
  | 'RECIPIENT_NOT_FOUND'
  | 'RECIPIENT_NO_PHONE'
  | 'RECIPIENT_NOT_IN_ORG'
  | 'INVALID_PHONE_NUMBER'
  | 'VALIDATION_ERROR';

/** Active transfer record */
export interface TransferRecord {
  id: string;
  callSid: string;
  fromUserId: string;
  toUserId: string | null;
  recipientPhone: string;
  recipientLabel: string | null;
  transferType: TransferType;
  status: TransferStatus;
  conferenceId: string | null;
  initiatedAt: Date;
  completedAt: Date | null;
  durationBeforeTransfer: number;
}

/** Parallel dialing — outcome per call leg */
export type ParallelOutcome =
  | 'pending'
  | 'winner'
  | 'terminated'
  | 'voicemail'
  | 'no-answer'
  | 'failed';

/** Single call leg in a parallel group */
export interface ParallelCall {
  callSid: string | null;
  customerNumber: string;
  fromNumber: string;
  position: number;
  status:
    | 'dialing'
    | 'ringing'
    | 'in-progress'
    | 'completed'
    | 'failed'
    | 'terminated'
    | 'voicemail';
  amdResult?: 'human' | 'machine' | 'unknown';
  contactId?: string;
  failureReason?: string;
}

/** Parallel dial group (3 concurrent calls) */
export interface ParallelGroup {
  groupId: string;
  conferenceName: string;
  calls: ParallelCall[];
  winnerSid: string | null;
  status: 'dialing' | 'connected' | 'completed' | 'failed';
  createdAt: Date;
}
