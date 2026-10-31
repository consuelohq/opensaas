import type { CoachingLibrary, ScriptDraft } from './coaching-scripts.js';
import type { LeadConnectorEmbedState } from './state-machine.js';

export type CallingWorkspace = {
  screen:
    | 'calling'
    | 'settings'
    | 'history'
    | 'call-detail'
    | 'team'
    | 'numbers'
    | 'billing'
    | 'queue-details'
    | 'call-options'
    | 'appearance'
    | 'mercury';
  nativeFloating?: boolean;
  theme?: 'system' | 'light' | 'dark';
  answeringEndpointIds?: string[];
  coachingLibrary?: CoachingLibrary;
  scriptDraft?: ScriptDraft;
  scriptId?: string;
  scriptSaving?: boolean;
  mode: 'inbound' | 'outbound';
  compact: boolean;
};
/** Native sidebar is a launcher; the parent-owned overlay is the calling UI. */
export const createCallingWorkspace = (
  surface: 'admin' | 'overlay',
): CallingWorkspace => ({
  screen: 'calling',
  mode: surface === 'admin' ? 'inbound' : 'outbound',
  compact: false,
  nativeFloating: surface === 'admin',
});

export type SessionPresentation = {
  active: boolean;
  status:
    | 'idle'
    | 'available'
    | 'offering'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'wrap-up'
    | 'paused'
    | 'calling';
  label: string;
  detail: string;
};
export const inboundPresentation = (
  state: LeadConnectorEmbedState['inboundOperator'],
): SessionPresentation => {
  const assignment = state.rep.assignment;
  const active =
    state.rep.ready || assignment !== null || state.offers.length > 0;
  if (
    state.phase === 'error' ||
    state.phase === 'reconnecting' ||
    assignment?.phase === 'unknown'
  )
    return {
      active,
      status: 'reconnecting',
      label: 'Reconnecting',
      detail: 'Checking your call status. Keep this window open.',
    };
  if (assignment?.phase === 'connected')
    return {
      active: true,
      status: 'connected',
      label: 'On a call',
      detail: 'Your incoming call is connected.',
    };
  if (assignment?.phase === 'wrap_up')
    return {
      active: true,
      status: 'wrap-up',
      label: 'Wrap up',
      detail: 'Save the outcome before your next call.',
    };
  if (assignment?.phase === 'connecting')
    return {
      active: true,
      status: 'connecting',
      label: 'Connecting',
      detail: 'Joining the caller. Waiting for the connection to be confirmed.',
    };
  if (state.offers.length || assignment?.phase === 'offering')
    return {
      active: true,
      status: 'offering',
      label: 'Incoming call',
      detail: 'An incoming caller is waiting for you.',
    };
  if (
    state.rep.ready &&
    state.rep.presence === 'online' &&
    state.rep.endpoints.some((e) => e.healthy && e.active !== false)
  )
    return {
      active: true,
      status: 'available',
      label: 'Receiving calls',
      detail:
        'You can keep working in your CRM. We’ll ring you when a call arrives.',
    };
  if (state.rep.ready)
    return {
      active: true,
      status: 'reconnecting',
      label: 'Reconnecting',
      detail: 'Checking your availability and answering device.',
    };
  return {
    active: false,
    status: 'idle',
    label: 'Not receiving calls',
    detail: 'Choose where you want incoming calls to ring.',
  };
};
export const outboundPresentation = (
  state: LeadConnectorEmbedState,
): SessionPresentation => {
  if (
    state.phase === 'failed' &&
    state.activeSessionId &&
    state.callSession &&
    !['completed', 'failed', 'canceled', 'busy', 'no-answer'].includes(
      state.callSession.status,
    )
  )
    return {
      active: true,
      status: 'reconnecting',
      label: 'Reconnecting',
      detail: 'Checking the current call before starting another.',
    };
  const active = [
    'starting',
    'dialing',
    'ringing',
    'connected',
    'paused',
    'wrapping-up',
  ].includes(state.phase);
  if (state.phase === 'connected') {
    const confirmed = ['connected', 'in-progress', 'answered'].includes(
      state.callSession?.status ?? '',
    );
    return {
      active,
      status: confirmed ? 'connected' : 'connecting',
      label: confirmed ? 'On a call' : 'Connecting',
      detail: confirmed
        ? 'Your call is connected.'
        : 'Waiting for the connection to be confirmed.',
    };
  }
  if (state.phase === 'wrapping-up')
    return {
      active,
      status: 'wrap-up',
      label: 'Wrap up',
      detail: 'Save the outcome of your call.',
    };
  if (state.phase === 'paused')
    return {
      active,
      status: 'paused',
      label: 'Calling paused',
      detail: 'Your calling list is saved.',
    };
  if (active)
    return {
      active,
      status: 'calling',
      label: state.phase === 'starting' ? 'Starting calls' : 'Calling',
      detail: 'Waiting for an answer.',
    };
  return {
    active: false,
    status: 'idle',
    label: 'Ready to call',
    detail: 'Choose a list or a single contact.',
  };
};
export const sessionPresentation = (
  state: LeadConnectorEmbedState,
  mode: CallingWorkspace['mode'],
): SessionPresentation =>
  mode === 'inbound'
    ? inboundPresentation(state.inboundOperator)
    : outboundPresentation(state);

export const activeCallingMode = (
  state: LeadConnectorEmbedState,
): CallingWorkspace['mode'] | null => {
  if (
    state.inboundOperator.rep.assignment ||
    state.inboundOperator.offers.length
  )
    return 'inbound';
  return outboundPresentation(state).active ? 'outbound' : null;
};
