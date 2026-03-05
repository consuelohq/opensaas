import { snapshot_UNSTABLE } from 'recoil';

import { callStateAtom } from '@/dialer/states/callStateAtom';
import { activeCallState } from '@/dialer/states/activeCallState';
import { conferenceSidState } from '@/dialer/states/conferenceState';
import { isMutedState } from '@/dialer/states/isMutedState';
import { isOnHoldState } from '@/dialer/states/isOnHoldState';
import { deviceReadyState } from '@/dialer/states/deviceReadyState';
import { deviceErrorState } from '@/dialer/states/deviceErrorState';
import { callErrorState } from '@/dialer/states/callErrorState';
import { reconnectingState } from '@/dialer/states/reconnectingState';
import { dialerSidebarOpenState } from '@/dialer/states/dialerSidebarOpenState';
import { activeTransferState } from '@/dialer/states/activeTransferState';
import { reconnectPromptState } from '@/dialer/states/reconnectPromptState';
import { twilioConfigStatusState } from '@/dialer/states/twilioConfigStatusState';
import { selectedMicState } from '@/dialer/states/selectedMicState';
import { selectedSpeakerState } from '@/dialer/states/selectedSpeakerState';

describe('dialer state atoms', () => {
  it('should have correct default for callStateAtom', () => {
    const snap = snapshot_UNSTABLE();
    const value = snap.getLoadable(callStateAtom).getValue();

    expect(value).toEqual({
      status: 'idle',
      callSid: null,
      duration: 0,
      startedAt: null,
      contact: null,
      callingMode: 'browser',
      fromNumber: null,
      parallelGroupId: null,
      transferId: null,
    });
  });

  it('should have null default for activeCallState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(activeCallState).getValue()).toBeNull();
  });

  it('should have null default for conferenceSidState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(conferenceSidState).getValue()).toBeNull();
  });

  it('should have false default for isMutedState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(isMutedState).getValue()).toBe(false);
  });

  it('should have false default for isOnHoldState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(isOnHoldState).getValue()).toBe(false);
  });

  it('should have false default for deviceReadyState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(deviceReadyState).getValue()).toBe(false);
  });

  it('should have null default for deviceErrorState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(deviceErrorState).getValue()).toBeNull();
  });

  it('should have null default for callErrorState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(callErrorState).getValue()).toBeNull();
  });

  it('should have false default for reconnectingState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(reconnectingState).getValue()).toBe(false);
  });

  it('should have false default for dialerSidebarOpenState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(dialerSidebarOpenState).getValue()).toBe(false);
  });

  it('should have null default for activeTransferState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(activeTransferState).getValue()).toBeNull();
  });

  it('should have null default for reconnectPromptState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(reconnectPromptState).getValue()).toBeNull();
  });

  it('should have null default for twilioConfigStatusState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(twilioConfigStatusState).getValue()).toBeNull();
  });

  it('should have null default for selectedMicState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(selectedMicState).getValue()).toBeNull();
  });

  it('should have null default for selectedSpeakerState', () => {
    const snap = snapshot_UNSTABLE();
    expect(snap.getLoadable(selectedSpeakerState).getValue()).toBeNull();
  });
});
