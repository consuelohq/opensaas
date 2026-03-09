// dialer tools for pi-agent-core — call control during coaching sessions
// uses TypeBox (pi's schema format)

import { Type, type Static } from '@sinclair/typebox';

import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';

// minimal interface — consumers provide their own Dialer instance
export type DialerService = {
  muteParticipant(conferenceSid: string, callSid: string, muted: boolean): Promise<void>;
  holdParticipant(conferenceSid: string, callSid: string, hold: boolean): Promise<void>;
  initiateTransfer(options: {
    callSid: string;
    conferenceName: string;
    to: string;
    from: string;
    type: 'cold' | 'warm';
    userId: string;
  }): Promise<{ success: boolean; transferCallSid?: string; conferenceSid?: string; error?: string }>;
  completeTransfer(conferenceSid: string, agentCallSid: string): Promise<{ success: boolean; error?: string }>;
  cancelTransfer(conferenceSid: string, transferCallSid: string): Promise<{ success: boolean; error?: string }>;
};

type DialerToolResult = AgentToolResult<Record<string, unknown>>;

const textResult = (data: unknown): DialerToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  details: {},
});

const safeExecute = async (fn: () => Promise<unknown>, fallbackMsg: string): Promise<DialerToolResult> => {
  try {
    const result = await fn();

    return textResult(result ?? { success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : fallbackMsg;

    return textResult({ error: message });
  }
};

// parameter schemas

const MuteParams = Type.Object({
  conferenceSid: Type.String({ description: 'Conference SID for the active call' }),
  callSid: Type.String({ description: 'Call SID of the participant to mute/unmute' }),
  muted: Type.Boolean({ description: 'true to mute, false to unmute' }),
});

const HoldParams = Type.Object({
  conferenceSid: Type.String({ description: 'Conference SID for the active call' }),
  callSid: Type.String({ description: 'Call SID of the customer participant' }),
  hold: Type.Boolean({ description: 'true to hold, false to unhold' }),
});

const TransferParams = Type.Object({
  conferenceSid: Type.String({ description: 'Conference SID for the active call' }),
  conferenceName: Type.String({ description: 'Conference friendly name' }),
  callSid: Type.String({ description: 'Agent call SID' }),
  targetNumber: Type.String({ description: 'Phone number to transfer to' }),
  from: Type.String({ description: 'Caller ID number for the transfer leg' }),
  type: Type.Union([Type.Literal('cold'), Type.Literal('warm')], {
    description: 'cold = immediate handoff, warm = consult first then complete',
  }),
});

const CompleteTransferParams = Type.Object({
  conferenceSid: Type.String({ description: 'Conference SID' }),
  agentCallSid: Type.String({ description: 'Agent call SID to remove from conference' }),
});

const CancelTransferParams = Type.Object({
  conferenceSid: Type.String({ description: 'Conference SID' }),
  transferCallSid: Type.String({ description: 'Transfer target call SID to remove' }),
});

type MuteP = Static<typeof MuteParams>;
type HoldP = Static<typeof HoldParams>;
type TransferP = Static<typeof TransferParams>;
type CompleteP = Static<typeof CompleteTransferParams>;
type CancelP = Static<typeof CancelTransferParams>;

export const createDialerTools = (
  dialer: DialerService,
  userId: string,
): AgentTool[] => [
  {
    name: 'mute_call',
    label: 'Mute Call',
    description: 'Toggle mute on a conference participant. This only affects audio — the call stays connected.',
    parameters: MuteParams,
    async execute(_toolCallId, params) {
      const { conferenceSid, callSid, muted } = params as MuteP;

      return safeExecute(
        () => dialer.muteParticipant(conferenceSid, callSid, muted),
        'mute toggle failed',
      );
    },
  },
  {
    name: 'hold_call',
    label: 'Hold Call',
    description: 'Toggle hold on a conference participant. Hold plays music to the participant while keeping the call active.',
    parameters: HoldParams,
    async execute(_toolCallId, params) {
      const { conferenceSid, callSid, hold } = params as HoldP;

      return safeExecute(
        () => dialer.holdParticipant(conferenceSid, callSid, hold),
        'hold toggle failed',
      );
    },
  },
  {
    name: 'transfer_call',
    label: 'Transfer Call',
    description:
      'Initiate a call transfer. CAUTION: cold transfers immediately remove the agent from the call. ' +
      'Warm transfers hold the customer while the agent consults with the target — use complete_transfer or cancel_transfer after.',
    parameters: TransferParams,
    async execute(_toolCallId, params) {
      const { conferenceSid: _sid, conferenceName, callSid, targetNumber, from, type } = params as TransferP;

      return safeExecute(
        () => dialer.initiateTransfer({
          callSid,
          conferenceName,
          to: targetNumber,
          from,
          type,
          userId,
        }),
        'transfer failed',
      );
    },
  },
  {
    name: 'complete_transfer',
    label: 'Complete Transfer',
    description: 'Complete a warm transfer — unholds the customer and removes the agent from the conference. Only use after a successful warm transfer_call.',
    parameters: CompleteTransferParams,
    async execute(_toolCallId, params) {
      const { conferenceSid, agentCallSid } = params as CompleteP;

      return safeExecute(
        () => dialer.completeTransfer(conferenceSid, agentCallSid),
        'complete transfer failed',
      );
    },
  },
  {
    name: 'cancel_transfer',
    label: 'Cancel Transfer',
    description: 'Cancel a warm transfer — removes the transfer target and unholds the customer. The original call continues.',
    parameters: CancelTransferParams,
    async execute(_toolCallId, params) {
      const { conferenceSid, transferCallSid } = params as CancelP;

      return safeExecute(
        () => dialer.cancelTransfer(conferenceSid, transferCallSid),
        'cancel transfer failed',
      );
    },
  },
];
