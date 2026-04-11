/** Twilio credentials configuration */
export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  apiKey?: string;
  apiSecret?: string;
  twimlAppSid?: string;
}

/** Dialer configuration */
export interface DialerConfig {
  provider?: 'twilio';
  credentials?: TwilioCredentials;
  /** Base URL for webhooks (status callbacks, TwiML) */
  baseUrl?: string;
  /** Default caller ID number */
  defaultNumber?: string;
}

/** Options for initiating a call */
export interface DialOptions {
  /** Number to call */
  to: string;
  /** Caller's personal number (agent's phone) */
  from: string;
  /** Manually selected outbound number (overrides auto-selection) */
  callerIdNumber?: string;
  /** User ID for the agent making the call */
  userId: string;
  /** Enable double-dial retry on no-answer */
  doubleDial?: boolean;
  /** Enable local presence number selection */
  localPresence?: boolean;
  /** Status callback URL */
  statusCallbackUrl?: string;
}

/** Result of a dial() call */
export interface DialResult {
  success: boolean;
  callSid?: string;
  fromNumber?: string;
  selectionMethod?: 'manual' | 'primary' | 'local_presence' | 'primary_fallback' | 'system_default';
  error?: string;
}

/** Result of a hangup() call */
export interface HangupResult {
  success: boolean;
  callSid: string;
  error?: string;
}

/** Twilio voice token for browser calling */
export interface VoiceToken {
  token: string;
  identity: string;
  ttl: number;
}

/** Available phone number from Twilio search */
export interface AvailableNumber {
  phoneNumber: string;
  areaCode: string;
  friendlyName: string;
  city?: string;
  state?: string;
  region?: string;
}

/** Options for searching available numbers */
export interface SearchAvailableNumbersOptions {
  areaCode: string;
  country?: string;
  limit?: number;
}

/** Result of releasing a number */
export interface ReleaseResult {
  success: boolean;
  error?: string;
}

/** Options for provisioning a phone number */
export interface ProvisionNumberOptions {
  /** Area code to search for (3-digit string, e.g. "415") */
  areaCode: string;
  /** Specific number to provision (if known) */
  phoneNumber?: string;
  /** Friendly name for the number */
  friendlyName?: string;
  /** Voice webhook URL */
  voiceUrl?: string;
  /** SMS webhook URL */
  smsUrl?: string;
}

/** Result of provisioning a number */
export interface ProvisionResult {
  success: boolean;
  phoneNumber?: string;
  sid?: string;
  areaCode?: string;
  error?: string;
}

/** Phone number with metadata */
export interface PhoneNumber {
  phoneNumber: string;
  areaCode: string;
  isPrimary: boolean;
  isActive: boolean;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  twilioSid?: string;
  friendlyName?: string;
}

/** Local presence number selection result */
export interface NumberSelection {
  phoneNumber: string;
  areaCode: string;
  localMatch: boolean;
  proximityMatch: boolean;
  distanceMiles?: number;
  isPrimary: boolean;
  customerAreaCode?: string;
}

/** Caller ID lock record */
export interface CallerIdLock {
  phoneNumber: string;
  userId: string;
  callSid: string;
  acquiredAt: Date;
  expiresAt: Date;
}

// --- Conference + Transfer types ---

/** Conference participant info from Twilio */
export interface ConferenceParticipant {
  callSid: string;
  conferenceSid: string;
  label: string;
  hold: boolean;
  muted: boolean;
  status: string;
}

/** Conference info tracked per call */
export interface ConferenceInfo {
  conferenceSid: string;
  conferenceName: string;
  callSid: string;
  customerCallSid: string | null;
  participants: ConferenceParticipant[];
}

/** Transfer type — cold (blind) or warm (consult) */
export type TransferType = 'cold' | 'warm';

/** Transfer lifecycle */
export type TransferStatus =
  | 'initiating'
  | 'ringing'
  | 'consulting'
  | 'completed'
  | 'cancelled'
  | 'failed';

/** Options to start a transfer */
export interface TransferOptions {
  callSid: string;
  conferenceName: string;
  to: string;
  from: string;
  type: TransferType;
  userId: string;
  statusCallbackUrl?: string;
  transferId?: string;
}

/** Result of a transfer operation */
export interface TransferResult {
  success: boolean;
  transferCallSid?: string;
  conferenceSid?: string;
  error?: string;
  transferId?: string;
}

// Ring time tracking for billing
export type RingTimeMetrics = {
  callSid: string;
  ringingAt: string;
  answeredAt?: string;
  ringDurationMs?: number;
}

// Dial status callback payload from Twilio
export type DialStatusPayload = {
  CallSid: string;
  DialCallStatus: string;
  DialCallDuration?: string;
  DialSipResponseCode?: string;
  RecordingUrl?: string;
  CallerName?: string;
  transferId?: string;
}

// TwiML generation params for the conference webhook
export type TwimlParams = {
  to: string;
  from: string;
  conferenceName?: string;
}

// --- Parallel dialing types ---

// Parallel dial group lifecycle
export type ParallelGroupStatus = 'dialing' | 'connected' | 'completed' | 'failed';

// AMD (answering machine detection) result
export type AmdResult = 'human' | 'machine' | 'unknown';

export type ParallelAmdPolicy = 'human-only' | 'human-or-unknown';

export type ParallelTerminationPolicy = 'winner-take-all';

export type ParallelDialProfile = {
  id: ProfileKey;
  fanout: number;
  staggerMs: number;
  amdPolicy: ParallelAmdPolicy;
  terminationPolicy: ParallelTerminationPolicy;
}

export type ProfileKey = 'balanced' | 'aggressive' | 'conservative';

export type ProfilePosterior = {
  profileId: ProfileKey;
  alpha: number;
  beta: number;
}

export type BetaSampler = {
  sample(alpha: number, beta: number): number;
}

export type PosteriorStore = {
  loadPosteriors(workspaceId?: string): Promise<ProfilePosterior[]>;
  updatePosterior(
    profileId: ProfileKey,
    success: boolean,
    workspaceId?: string,
  ): Promise<void>;
}

export type ParallelStrategyContext = {
  queueId: string;
  campaignSegment?: string;
  recentAnswerRate?: number;
  profileId?: ProfileKey;
}

export type ParallelStrategyResolution = {
  profile: ParallelDialProfile;
  reason: string;
  scope?: 'global' | 'workspace' | 'fallback';
}

export type ParallelTelemetry = {
  winnerRate: number;
  wastedLegs: number;
  connectLatencyMs: number | null;
}

// Single call within a parallel group
export type ParallelCall = {
  callSid: string;
  customerNumber: string;
  fromNumber: string;
  position: number;
  status: string;
  amdResult?: AmdResult;
  contactId?: string;
  dialStartedAt: string;
  answeredAt?: string;
  terminatedAt?: string;
}

// Full parallel dial group state (stored in redis)
export type ParallelGroup = {
  groupId: string;
  conferenceName: string;
  status: ParallelGroupStatus;
  winnerSid: string | null;
  calls: ParallelCall[];
  queueId: string;
  userId: string;
  createdAt: string;
  campaignSegment?: string;
  profile: ParallelDialProfile;
  resolverReason: string;
  connectedAt?: string;
  completedAt?: string;
  telemetryEmittedAt?: string;
}

/** Options for initiating a parallel dial batch */
export interface ParallelDialOptions {
  customerNumbers: string[];
  queueId: string;
  contactIds?: string[];
  userId: string;
  fromNumbers: string[];
  statusCallbackUrl: string;
  customerTwimlUrl: string;
  profile: ParallelDialProfile;
  campaignSegment?: string;
}

/** Result of initiating a parallel dial batch */
export interface ParallelDialResult {
  groupId: string;
  conferenceName: string;
  profileId: string;
  calls: Array<{
    callSid: string;
    customerNumber: string;
    fromNumber: string;
    position: number;
    status: 'dialing';
  }>;
}

/** Storage interface for parallel dial state (redis in prod, in-memory for dev) */
export interface ParallelStore {
  setGroup(groupId: string, data: string, ttlSeconds: number): Promise<void>;
  getGroup(groupId: string): Promise<string | null>;
  setCallMapping(callSid: string, groupId: string, ttlSeconds: number): Promise<void>;
  getCallMapping(callSid: string): Promise<string | null>;
  setWinnerIfAbsent(groupId: string, callSid: string, ttlSeconds: number): Promise<boolean>;
  getWinner(groupId: string): Promise<string | null>;
  deleteGroup(groupId: string): Promise<void>;
}
