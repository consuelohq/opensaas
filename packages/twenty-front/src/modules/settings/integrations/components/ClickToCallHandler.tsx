// ClickToCallHandler — DEV-1206
// Listens for click-to-call postMessages from the GHL Custom JS
// and updates recoil state so the dialer can pre-fill the number.

import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';

import { onClickToCall, sendDialerReady } from '@/settings/integrations/services/ghlBridge';
import { ghlClickToCallState } from '@/settings/integrations/states/ghlClickToCallState';
import type { GHLClickToCallContact } from '@/settings/integrations/types/ghl';

export const ClickToCallHandler = () => {
  const setClickToCall = useSetRecoilState(ghlClickToCallState);

  useEffect(() => {
    const handleClickToCall = (
      contact: GHLClickToCallContact,
      autoDial: boolean,
    ) => {
      setClickToCall({ pendingContact: contact, autoDial });
    };

    // subscribe to click-to-call messages from GHL parent frame
    const cleanup = onClickToCall(handleClickToCall);

    // notify GHL parent that dialer is ready
    sendDialerReady();

    return cleanup;
  }, [setClickToCall]);

  return null;
};
