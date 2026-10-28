import { Device, type Call } from '@twilio/voice-sdk';

export type LeadConnectorAgentVoice = {
  prepare: () => Promise<void>;
  connect: (sessionId: string) => Promise<void>;
  disconnect: () => void;
};

type AgentCall = Pick<Call, 'on' | 'disconnect'>;
type AgentDevice = {
  state: unknown;
  register: () => Promise<void>;
  connect: (options: { params: { SessionId: string } }) => Promise<AgentCall>;
  disconnectAll: () => void;
  destroy: () => void;
  audio?: {
    incoming: (enabled: boolean) => void;
    outgoing: (enabled: boolean) => void;
    disconnect: (enabled: boolean) => void;
  } | null;
};

type AgentVoiceOptions = {
  getToken: () => Promise<{ token: string }>;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createDevice?: (token: string) => AgentDevice;
  registeredState?: unknown;
  connectTimeoutMs?: number;
};

const errorMessage = (value: unknown, fallback: string): string =>
  value instanceof Error && value.message ? value.message : fallback;

export const createLeadConnectorAgentVoice = (
  options: AgentVoiceOptions,
): LeadConnectorAgentVoice => {
  const getUserMedia =
    options.getUserMedia ??
    ((constraints: MediaStreamConstraints) =>
      navigator.mediaDevices.getUserMedia(constraints));
  const createDevice =
    options.createDevice ??
    ((token: string) => new Device(token, { closeProtection: true }));
  const registeredState = options.registeredState ?? Device.State.Registered;
  const connectTimeoutMs = options.connectTimeoutMs ?? 12_000;
  let device: AgentDevice | null = null;
  let activeCall: AgentCall | null = null;

  const prepare = async (): Promise<void> => {
    try {
      const stream = await getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      if (device?.state === registeredState) return;

      device?.destroy();
      device = null;
      const { token } = await options.getToken();
      const nextDevice = createDevice(token);
      nextDevice.audio?.incoming(false);
      nextDevice.audio?.outgoing(false);
      nextDevice.audio?.disconnect(false);
      await nextDevice.register();
      if (nextDevice.state !== registeredState) {
        nextDevice.destroy();
        throw new Error('Browser calling device did not register');
      }
      device = nextDevice;
    } catch (error: unknown) {
      device?.destroy();
      device = null;
      throw error instanceof Error
        ? error
        : new Error('Browser calling device could not be prepared');
    }
  };

  const connect = async (sessionId: string): Promise<void> => {
    try {
      if (!device || device.state !== registeredState) {
        throw new Error('Browser calling device is not ready');
      }
      const call = await device.connect({ params: { SessionId: sessionId } });
      activeCall = call;
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (operation: () => void): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          operation();
        };
        const fail = (error: unknown, fallback: string): void =>
          finish(() => {
            call.disconnect();
            activeCall = null;
            reject(new Error(errorMessage(error, fallback)));
          });
        const timer = setTimeout(
          () =>
            fail(
              new Error('Agent media connection timed out'),
              'Agent media connection timed out',
            ),
          connectTimeoutMs,
        );
        call.on('accept', () => finish(resolve));
        call.on('error', (error: unknown) =>
          fail(error, 'Agent media connection failed'),
        );
        call.on('cancel', () =>
          fail(null, 'Agent media connection was canceled'),
        );
        call.on('reject', () =>
          fail(null, 'Agent media connection was rejected'),
        );
        call.on('disconnect', () => {
          if (!settled) {
            fail(null, 'Agent media connection ended before bridging');
          } else {
            activeCall = null;
          }
        });
      });
    } catch (error: unknown) {
      activeCall?.disconnect();
      activeCall = null;
      throw error instanceof Error
        ? error
        : new Error('Agent media connection failed');
    }
  };

  const disconnect = (): void => {
    activeCall?.disconnect();
    activeCall = null;
    device?.disconnectAll();
  };

  return { prepare, connect, disconnect };
};
