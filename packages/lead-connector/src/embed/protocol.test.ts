import { describe, expect, it, mock } from 'bun:test';

import {
  LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION,
  LEAD_CONNECTOR_PARENT_ORIGINS,
  createLeadConnectorParentBridge,
  normalizeClickToCallTarget,
} from './protocol';

const createHost = () => {
  const listeners = new Set<(event: MessageEvent) => void>();
  const posts: Array<{ message: unknown; targetOrigin: string }> = [];
  const parent = {
    postMessage: (message: unknown, targetOrigin: string) => {
      posts.push({ message, targetOrigin });
    },
  };
  return {
    posts,
    host: {
      parent,
      addEventListener: (
        _type: 'message',
        listener: (event: MessageEvent) => void,
      ) => listeners.add(listener),
      removeEventListener: (
        _type: 'message',
        listener: (event: MessageEvent) => void,
      ) => listeners.delete(listener),
    },
    dispatch: (origin: string, data: unknown, source: unknown = parent) => {
      for (const listener of listeners)
        listener({ origin, data, source } as MessageEvent);
    },
  };
};

describe('LeadConnector embed protocol', () => {
  it('requests encrypted platform user context from the exact trusted parent origin', () => {
    const fixture = createHost();
    const onMessage = mock(() => undefined);
    const parentOrigin = LEAD_CONNECTOR_PARENT_ORIGINS[0];
    const bridge = createLeadConnectorParentBridge(fixture.host, {
      allowedOrigins: LEAD_CONNECTOR_PARENT_ORIGINS,
      parentOrigin,
      onMessage,
    });

    bridge.start();
    bridge.requestUserContext();
    expect(fixture.posts).toEqual([
      {
        targetOrigin: parentOrigin,
        message: { message: 'REQUEST_USER_DATA' },
      },
    ]);

    fixture.dispatch(parentOrigin, {
      message: 'REQUEST_USER_DATA_RESPONSE',
      payload: 'opaque-parent-ciphertext',
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: 'bootstrap',
      encryptedData: 'opaque-parent-ciphertext',
    });
  });

  it('accepts a versioned handshake only from a trusted parent and responds to that exact origin', () => {
    const fixture = createHost();
    const onMessage = mock(() => undefined);
    const bridge = createLeadConnectorParentBridge(fixture.host, {
      allowedOrigins: LEAD_CONNECTOR_PARENT_ORIGINS,
      onMessage,
    });
    bridge.start();
    fixture.dispatch(LEAD_CONNECTOR_PARENT_ORIGINS[0], {
      type: 'consuelo.leadconnector/handshake',
      version: LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION,
      bootstrapToken: 'opaque-bootstrap',
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: 'handshake',
      bootstrapToken: 'opaque-bootstrap',
    });
    bridge.sendReady();
    expect(fixture.posts).toEqual([
      {
        targetOrigin: LEAD_CONNECTOR_PARENT_ORIGINS[0],
        message: {
          type: 'consuelo.leadconnector/ready',
          version: LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION,
        },
      },
    ]);
  });

  it('rejects untrusted origins and reports protocol version mismatches', () => {
    const fixture = createHost();
    const onMessage = mock(() => undefined);
    const onProtocolError = mock(() => undefined);
    const bridge = createLeadConnectorParentBridge(fixture.host, {
      allowedOrigins: LEAD_CONNECTOR_PARENT_ORIGINS,
      onMessage,
      onProtocolError,
    });
    bridge.start();
    fixture.dispatch('https://untrusted.example', {
      type: 'consuelo.leadconnector/handshake',
      version: LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION,
      bootstrapToken: 'opaque-bootstrap',
    });
    fixture.dispatch(LEAD_CONNECTOR_PARENT_ORIGINS[0], {
      type: 'consuelo.leadconnector/handshake',
      version: 999,
      bootstrapToken: 'opaque-bootstrap',
    });
    expect(onMessage).not.toHaveBeenCalled();
    expect(onProtocolError).toHaveBeenCalledWith('PROTOCOL_VERSION_MISMATCH');
  });

  it('rejects a trusted-origin message that did not come from the parent window', () => {
    const fixture = createHost();
    const onMessage = mock(() => undefined);
    const bridge = createLeadConnectorParentBridge(fixture.host, {
      allowedOrigins: LEAD_CONNECTOR_PARENT_ORIGINS,
      onMessage,
    });
    bridge.start();
    fixture.dispatch(
      LEAD_CONNECTOR_PARENT_ORIGINS[0],
      {
        type: 'consuelo.leadconnector/handshake',
        version: LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION,
        bootstrapToken: 'opaque-bootstrap',
      },
      {},
    );
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('normalizes click-to-call targets and produces a stable dedupe key', () => {
    expect(
      normalizeClickToCallTarget({
        phone: '(555) 010-0123',
        contactId: 'contact-1',
        name: 'Test Contact',
        opportunityId: 'opportunity-1',
      }),
    ).toEqual({
      phone: '+15550100123',
      contactId: 'contact-1',
      name: 'Test Contact',
      opportunityId: 'opportunity-1',
      dedupeKey: 'contact-1:+15550100123',
    });
    expect(normalizeClickToCallTarget({ phone: '123' })).toBeNull();
  });
});
