import { describe, expect, it, mock } from 'bun:test';

import { createLeadConnectorAgentVoice } from './agent-voice';

const createCall = () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    call: {
      on: mock((event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler);
      }),
      disconnect: mock(() => undefined),
    },
    emit: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
  };
};

describe('LeadConnector browser agent voice', () => {
  it('gets microphone permission, registers the device, and resolves after the agent call is accepted', async () => {
    const created = createCall();
    const device = {
      state: 'registered',
      register: mock(async () => undefined),
      connect: mock(async () => created.call),
      disconnectAll: mock(() => undefined),
      destroy: mock(() => undefined),
      on: mock(() => undefined),
      audio: { incoming: mock(() => undefined), outgoing: mock(() => undefined), disconnect: mock(() => undefined) },
    };
    const tracks = [{ stop: mock(() => undefined) }];
    const voice = createLeadConnectorAgentVoice({
      getToken: mock(async () => ({ token: 'voice-token' })),
      getUserMedia: mock(async () => ({ getTracks: () => tracks } as unknown as MediaStream)),
      createDevice: mock(() => device as never),
      registeredState: 'registered',
      connectTimeoutMs: 100,
    });

    await voice.prepare();
    const connected = voice.connect('group-1');
    await Promise.resolve();
    created.emit('accept');
    await connected;

    expect(device.connect).toHaveBeenCalledWith({ params: { SessionId: 'group-1' } });
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
  });

  it('rejects if the media call fails before acceptance and disconnects the partial leg', async () => {
    const created = createCall();
    const device = {
      state: 'registered',
      register: mock(async () => undefined),
      connect: mock(async () => created.call),
      disconnectAll: mock(() => undefined),
      destroy: mock(() => undefined),
      on: mock(() => undefined),
      audio: { incoming: mock(() => undefined), outgoing: mock(() => undefined), disconnect: mock(() => undefined) },
    };
    const voice = createLeadConnectorAgentVoice({
      getToken: mock(async () => ({ token: 'voice-token' })),
      getUserMedia: mock(async () => ({ getTracks: () => [] } as unknown as MediaStream)),
      createDevice: mock(() => device as never),
      registeredState: 'registered',
      connectTimeoutMs: 100,
    });

    await voice.prepare();
    const connected = voice.connect('group-1');
    await Promise.resolve();
    created.emit('error', new Error('media failed'));

    await expect(connected).rejects.toThrow('media failed');
    expect(created.call.disconnect).toHaveBeenCalledTimes(1);
  });
});
