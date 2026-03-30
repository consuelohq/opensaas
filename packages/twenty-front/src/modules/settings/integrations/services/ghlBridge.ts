// GHL postMessage bridge — DEV-1206
// Handles communication between the GHL parent frame (Custom JS)
// and the Consuelo CML iframe (dialer).

import {
  GHL_MESSAGE_TYPES,
  type GHLBridgeMessage,
  type GHLClickToCallContact,
} from '@/settings/integrations/types/ghl';

const TRUSTED_ORIGINS = [
  'https://app.gohighlevel.com',
  'https://app.leadconnectorhq.com',
] as const;

type ClickToCallCallback = (
  contact: GHLClickToCallContact,
  autoDial: boolean,
) => void;

type CleanupFunction = () => void;

const isTrustedOrigin = (origin: string): boolean =>
  TRUSTED_ORIGINS.some((trusted) => origin === trusted);

// notify the GHL parent frame that the dialer is ready to receive calls
export const sendDialerReady = (): void => {
  try {
    window.parent.postMessage({ type: GHL_MESSAGE_TYPES.DIALER_READY }, '*');
  } catch (_err: unknown) {
    // postMessage may fail if not in an iframe — safe to ignore
  }
};

// notify the GHL parent frame that the dialer is busy on a call
export const sendDialerBusy = (callSid: string): void => {
  try {
    window.parent.postMessage(
      { type: GHL_MESSAGE_TYPES.DIALER_BUSY, callSid },
      '*',
    );
  } catch (_err: unknown) {
    // safe to ignore
  }
};

// subscribe to click-to-call events from the GHL Custom JS
export const onClickToCall = (
  callback: ClickToCallCallback,
): CleanupFunction => {
  const handler = (event: MessageEvent<GHLBridgeMessage>): void => {
    if (!isTrustedOrigin(event.origin)) return;

    const data = event.data;
    if (!data || typeof data.type !== 'string') return;

    if (data.type === GHL_MESSAGE_TYPES.CLICK_TO_CALL) {
      callback(data.contact, data.autoDial);
    }
  };

  window.addEventListener('message', handler);

  return () => window.removeEventListener('message', handler);
};
