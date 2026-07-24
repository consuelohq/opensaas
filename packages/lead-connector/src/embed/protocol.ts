export const LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION = 1 as const;

export const LEAD_CONNECTOR_PARENT_ORIGINS = [
  'https://app.leadconnectorhq.com',
  'https://app.msgsndr.com',
] as const;

export type LeadConnectorClickToCallInput = {
  phone: string;
  contactId?: string | null;
  name?: string | null;
  opportunityId?: string | null;
};

export type LeadConnectorClickToCallTarget = {
  phone: string;
  contactId: string | null;
  name: string | null;
  opportunityId: string | null;
  dedupeKey: string;
};

export type LeadConnectorEmbedMessage =
  | { type: 'bootstrap'; encryptedData: string }
  | { type: 'handshake'; bootstrapToken: string }
  | {
      type: 'click-to-call';
      target: LeadConnectorClickToCallTarget;
      autoDial: boolean;
    };

export type LeadConnectorProtocolError =
  | 'INVALID_MESSAGE'
  | 'PROTOCOL_VERSION_MISMATCH';

export type EmbedMessageHost = {
  parent: { postMessage: (message: unknown, targetOrigin: string) => void };
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent) => void,
  ) => void;
  removeEventListener: (
    type: 'message',
    listener: (event: MessageEvent) => void,
  ) => void;
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readOptionalString = (
  record: Record<string, unknown>,
  key: string,
): string | null => {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
};

export const normalizeClickToCallTarget = (
  input: LeadConnectorClickToCallInput,
): LeadConnectorClickToCallTarget | null => {
  const digits = input.phone.replace(/\D/g, '');
  let phone: string;
  if (digits.length === 10) phone = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) phone = `+${digits}`;
  else if (digits.length >= 10 && digits.length <= 15) phone = `+${digits}`;
  else return null;
  const contactId = input.contactId?.trim() || null;
  const name = input.name?.trim() || null;
  const opportunityId = input.opportunityId?.trim() || null;
  return {
    phone,
    contactId,
    name,
    opportunityId,
    dedupeKey: `${contactId ?? 'phone'}:${phone}`,
  };
};

export const createLeadConnectorParentBridge = (
  host: EmbedMessageHost,
  options: {
    allowedOrigins: readonly string[];
    parentOrigin?: string;
    onMessage: (message: LeadConnectorEmbedMessage) => void;
    onProtocolError?: (error: LeadConnectorProtocolError) => void;
  },
) => {
  let activeOrigin: string | null = null;
  let started = false;
  const trusted = new Set(options.allowedOrigins);

  const handler = (event: MessageEvent): void => {
    if (!trusted.has(event.origin)) return;
    if (event.source !== (host.parent as unknown as MessageEventSource)) {
      return;
    }
    const data = readRecord(event.data);
    if (!data) return;
    if (data.message === 'REQUEST_USER_DATA_RESPONSE') {
      const encryptedData = readOptionalString(data, 'payload');
      if (!encryptedData) {
        options.onProtocolError?.('INVALID_MESSAGE');
        return;
      }
      activeOrigin = event.origin;
      options.onMessage({ type: 'bootstrap', encryptedData });
      return;
    }
    if (typeof data.type !== 'string') return;
    if (data.version !== LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION) {
      options.onProtocolError?.('PROTOCOL_VERSION_MISMATCH');
      return;
    }
    if (data.type === 'consuelo.leadconnector/handshake') {
      const bootstrapToken = readOptionalString(data, 'bootstrapToken');
      if (!bootstrapToken) {
        options.onProtocolError?.('INVALID_MESSAGE');
        return;
      }
      activeOrigin = event.origin;
      options.onMessage({ type: 'handshake', bootstrapToken });
      return;
    }
    if (data.type === 'consuelo.leadconnector/click-to-call') {
      if (event.origin !== activeOrigin) return;
      const contact = readRecord(data.target);
      const phone = contact ? readOptionalString(contact, 'phone') : null;
      if (!contact || !phone) {
        options.onProtocolError?.('INVALID_MESSAGE');
        return;
      }
      const target = normalizeClickToCallTarget({
        phone,
        contactId: readOptionalString(contact, 'contactId'),
        name: readOptionalString(contact, 'name'),
        opportunityId: readOptionalString(contact, 'opportunityId'),
      });
      if (!target) {
        options.onProtocolError?.('INVALID_MESSAGE');
        return;
      }
      options.onMessage({
        type: 'click-to-call',
        target,
        autoDial: data.autoDial === true,
      });
    }
  };

  const post = (message: unknown): void => {
    if (activeOrigin) host.parent.postMessage(message, activeOrigin);
  };

  const configuredParentOrigin = options.parentOrigin?.trim() || null;
  if (configuredParentOrigin && !trusted.has(configuredParentOrigin)) {
    throw new Error('LeadConnector parent origin is not trusted');
  }

  return {
    start: () => {
      if (started) return;
      started = true;
      host.addEventListener('message', handler);
    },
    stop: () => {
      if (!started) return;
      started = false;
      host.removeEventListener('message', handler);
    },
    requestUserContext: () => {
      if (!configuredParentOrigin) {
        options.onProtocolError?.('INVALID_MESSAGE');
        return;
      }
      activeOrigin = configuredParentOrigin;
      host.parent.postMessage(
        { message: 'REQUEST_USER_DATA' },
        configuredParentOrigin,
      );
    },
    sendReady: () =>
      post({
        type: 'consuelo.leadconnector/ready',
        version: LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION,
      }),
    sendBusy: (sessionId: string) =>
      post({
        type: 'consuelo.leadconnector/busy',
        version: LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION,
        sessionId,
      }),
    sendCompleted: (sessionId: string) =>
      post({
        type: 'consuelo.leadconnector/completed',
        version: LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION,
        sessionId,
      }),
  };
};
