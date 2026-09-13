import type { CallbackPolicy, RoutingRequestMetadata } from '@consuelo/dialer';
export type InboundNumber = {
  numberId: string;
  workspaceId: string;
  queueId: string;
  accountSid: string;
  did: string;
  enabled: boolean;
  maxActiveRequests: number;
  callback?: CallbackPolicy | null;
  voicemail: null | {
    disclosure: string;
    maxSeconds: number;
    retentionMilliseconds: number;
  };
};
export type InboundEndpoint = {
  workspaceId: string;
  repId: string;
  endpointId: string;
  kind: 'browser' | 'phone';
  address: string;
};
export type TelephonySession = {
  workspace_id: string;
  request_id: string;
  number_id: string;
  queue_id: string;
  caller_sid: string;
  conference_name: string;
  mode: 'waiting' | 'callback_requested' | 'voicemail' | 'ended';
};
export type TelephonyEffect = {
  workspace_id: string;
  effect_id: string;
  request_id: string;
  assignment_id: string;
  command_id: string;
  endpoint_id: string;
  kind: 'offer' | 'bridge_caller' | 'bridge_rep' | 'terminate';
  status: 'pending' | 'dispatched' | 'unknown' | 'succeeded' | 'failed';
  call_sid: string | null;
};
export type CarrierCall = { sid: string; accountSid: string; status: string };
export type InboundCarrier = {
  offer: (input: {
    to: string;
    from: string;
    url: string;
    statusCallback: string;
    timeoutSeconds: number;
  }) => Promise<CarrierCall>;
  redirect: (callSid: string, twiml: string) => Promise<void>;
  end: (callSid: string) => Promise<void>;
  call: (callSid: string) => Promise<CarrierCall>;
  participants: (
    conferenceName: string,
  ) => Promise<readonly { callSid: string; muted: boolean; hold: boolean }[]>;
  recording: (
    recordingSid: string,
  ) => Promise<{ accountSid: string; callSid: string; status: string }>;
  deleteRecording: (recordingSid: string) => Promise<void>;
};
export type InboundEnrichment = (input: {
  workspaceId: string;
  caller: string;
}) => Promise<RoutingRequestMetadata>;
export const terminalCarrierStatus = (status: string) =>
  ['completed', 'canceled', 'busy', 'failed', 'no-answer'].includes(status);
