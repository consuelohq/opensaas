import { ConferenceService } from './conference';

// mock twilio — the service does `await import('twilio')` lazily
const mockParticipantUpdate = jest.fn().mockResolvedValue({});
const mockParticipantRemove = jest.fn().mockResolvedValue({});
const mockParticipantsCreate = jest.fn();
const mockParticipantsList = jest.fn();
const mockConferencesList = jest.fn();
const mockCallsCreate = jest.fn();
const mockCallUpdate = jest.fn();
const mockRecordingFetch = jest.fn();
const mockRecordingsList = jest.fn();

const mockClient = {
  conferences: Object.assign(
    (sid: string) => ({
      participants: Object.assign(
        (callSid: string) => ({
          update: mockParticipantUpdate,
          remove: mockParticipantRemove,
        }),
        {
          create: mockParticipantsCreate,
          list: mockParticipantsList,
        },
      ),
    }),
    {
      list: mockConferencesList,
    },
  ),
  calls: Object.assign(
    (sid: string) => ({ update: mockCallUpdate }),
    { create: mockCallsCreate },
  ),
  recordings: Object.assign(
    (sid: string) => ({ fetch: mockRecordingFetch }),
    { list: mockRecordingsList },
  ),
};

jest.mock('twilio', () => ({
  __esModule: true,
  default: () => mockClient,
}));

describe('ConferenceService', () => {
  let service: ConferenceService;

  beforeEach(() => {
    mockParticipantUpdate.mockReset().mockResolvedValue({});
    mockParticipantRemove.mockReset().mockResolvedValue({});
    mockParticipantsCreate.mockReset();
    mockParticipantsList.mockReset();
    mockConferencesList.mockReset();
    mockCallsCreate.mockReset();
    mockCallUpdate.mockReset();
    mockRecordingFetch.mockReset();
    mockRecordingsList.mockReset();
    service = new ConferenceService({ accountSid: 'AC_test', authToken: 'test_token' });
  });

  describe('generateConferenceTwiml', () => {
    it('should generate valid TwiML with defaults', () => {
      const twiml = service.generateConferenceTwiml('conf-123');
      expect(twiml).toContain('<Conference');
      expect(twiml).toContain('conf-123');
      expect(twiml).toContain('startConferenceOnEnter="true"');
      expect(twiml).toContain('endConferenceOnExit="false"');
    });

    it('should include participant label when provided', () => {
      const twiml = service.generateConferenceTwiml('conf-123', { participantLabel: 'agent' });
      expect(twiml).toContain('participantLabel="agent"');
    });

    it('should respect custom options', () => {
      const twiml = service.generateConferenceTwiml('conf-456', {
        startOnEnter: false,
        endOnExit: true,
        waitUrl: 'https://example.com/hold',
      });
      expect(twiml).toContain('startConferenceOnEnter="false"');
      expect(twiml).toContain('endConferenceOnExit="true"');
      expect(twiml).toContain('waitUrl="https://example.com/hold"');
    });

    it('should include both_tracks by default for media streams', () => {
      const twiml = service.generateConferenceTwiml('conf-789', {
        streamUrl: 'wss://example.com/v1/coaching/media',
      });

      expect(twiml).toContain('track="both_tracks"');
    });

    it('should respect a custom stream track', () => {
      const twiml = service.generateConferenceTwiml('conf-101', {
        streamUrl: 'wss://example.com/v1/coaching/media',
        streamTrack: 'outbound_track',
      });

      expect(twiml).toContain('track="outbound_track"');
    });
  });

  describe('addParticipant', () => {
    it('should add a participant to an existing conference', async () => {
      mockConferencesList.mockResolvedValue([{ sid: 'CF_abc' }]);
      mockParticipantsCreate.mockResolvedValue({ callSid: 'CA_new' });

      const result = await service.addParticipant('conf-123', '+15551234567', '+15559876543');
      expect(result).toEqual({ callSid: 'CA_new', conferenceSid: 'CF_abc' });
      expect(mockConferencesList).toHaveBeenCalledWith(
        expect.objectContaining({ friendlyName: 'conf-123', status: 'in-progress' }),
      );
    });

    it('should throw 404 when conference not found', async () => {
      mockConferencesList.mockResolvedValue([]);
      await expect(
        service.addParticipant('missing', '+15551234567', '+15559876543', {
          conferenceLookupTimeoutMs: 1,
        }),
      ).rejects.toThrow('not found or not in-progress');
    });

    it('should use custom label and endConferenceOnExit', async () => {
      mockConferencesList.mockResolvedValue([{ sid: 'CF_abc' }]);
      mockParticipantsCreate.mockResolvedValue({ callSid: 'CA_new' });

      await service.addParticipant('conf-123', '+15551234567', '+15559876543', {
        label: 'transfer-target',
        endConferenceOnExit: false,
      });

      expect(mockParticipantsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'transfer-target', endConferenceOnExit: false }),
      );
    });
  });

  describe('createCall', () => {
    it('should create an outbound call with twiml', async () => {
      mockCallsCreate.mockResolvedValue({ sid: 'CA_out' });
      const result = await service.createCall('+15551234567', '+15559876543', { twiml: '<Response/>' });
      expect(result).toEqual({ callSid: 'CA_out' });
    });

    it('should throw on twilio error', async () => {
      mockCallsCreate.mockRejectedValue(new Error('twilio down'));
      await expect(service.createCall('+15551234567', '+15559876543', { twiml: '<Response/>' }))
        .rejects.toThrow('twilio down');
    });
  });

  describe('holdParticipant', () => {
    it('should toggle hold on a participant', async () => {
      await service.holdParticipant('CF_abc', 'CA_123', true);
      expect(mockParticipantUpdate).toHaveBeenCalledWith({ hold: true });
    });

    it('should throw on failure', async () => {
      mockParticipantUpdate.mockRejectedValueOnce(new Error('not found'));
      await expect(service.holdParticipant('CF_abc', 'CA_123', true))
        .rejects.toThrow('not found');
    });
  });

  describe('muteParticipant', () => {
    it('should toggle mute on a participant', async () => {
      await service.muteParticipant('CF_abc', 'CA_123', true);
      expect(mockParticipantUpdate).toHaveBeenCalledWith({ muted: true });
    });
  });

  describe('findConferenceSid', () => {
    it('should return sid when conference exists', async () => {
      mockConferencesList.mockResolvedValue([{ sid: 'CF_found' }]);
      const sid = await service.findConferenceSid('conf-123');
      expect(sid).toBe('CF_found');
    });

    it('should return null when conference not found', async () => {
      mockConferencesList.mockResolvedValue([]);
      const sid = await service.findConferenceSid('missing');
      expect(sid).toBeNull();
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant', async () => {
      await service.removeParticipant('CF_abc', 'CA_123');
      expect(mockParticipantRemove).toHaveBeenCalled();
    });
  });

  describe('listParticipants', () => {
    it('should return mapped participant list', async () => {
      mockParticipantsList.mockResolvedValue([
        { callSid: 'CA_1', conferenceSid: 'CF_abc', label: 'agent', hold: false, muted: false, status: 'connected' },
        { callSid: 'CA_2', conferenceSid: 'CF_abc', label: 'customer', hold: true, muted: false, status: 'connected' },
      ]);

      const participants = await service.listParticipants('CF_abc');
      expect(participants).toHaveLength(2);
      expect(participants[0].label).toBe('agent');
      expect(participants[1].hold).toBe(true);
    });

    it('should default label to empty string when missing', async () => {
      mockParticipantsList.mockResolvedValue([
        { callSid: 'CA_1', conferenceSid: 'CF_abc', hold: false, muted: false, status: 'connected' },
      ]);
      const participants = await service.listParticipants('CF_abc');
      expect(participants[0].label).toBe('');
    });
  });

  describe('initiateTransfer', () => {
    const baseOpts = {
      callSid: 'CA_agent',
      conferenceName: 'conf-123',
      to: '+15551111111',
      from: '+15552222222',
      userId: 'user-1',
    };

    it('should perform cold transfer (add target, remove agent)', async () => {
      mockConferencesList.mockResolvedValue([{ sid: 'CF_abc' }]);
      mockParticipantsCreate.mockResolvedValue({ callSid: 'CA_target' });

      const result = await service.initiateTransfer({ ...baseOpts, type: 'cold' });
      expect(result.success).toBe(true);
      expect(result.transferCallSid).toBe('CA_target');
      expect(mockParticipantRemove).toHaveBeenCalled();
    });

    it('should perform warm transfer (hold customer, add target)', async () => {
      mockConferencesList.mockResolvedValue([{ sid: 'CF_abc' }]);
      mockParticipantsList.mockResolvedValue([
        { callSid: 'CA_cust', conferenceSid: 'CF_abc', label: 'customer', hold: false, muted: false, status: 'connected' },
      ]);
      mockParticipantsCreate.mockResolvedValue({ callSid: 'CA_target' });

      const result = await service.initiateTransfer({ ...baseOpts, type: 'warm' });
      expect(result.success).toBe(true);
      // customer should be held
      expect(mockParticipantUpdate).toHaveBeenCalledWith({ hold: true });
    });

    it('should return error when warm transfer conference not found', async () => {
      mockConferencesList.mockResolvedValue([]);
      const result = await service.initiateTransfer({ ...baseOpts, type: 'warm' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Conference not found');
    });
  });

  describe('completeTransfer', () => {
    it('should unhold customer and remove agent', async () => {
      mockParticipantsList.mockResolvedValue([
        { callSid: 'CA_cust', conferenceSid: 'CF_abc', label: 'customer', hold: true, muted: false, status: 'connected' },
        { callSid: 'CA_target', conferenceSid: 'CF_abc', label: 'transfer-target', hold: false, muted: false, status: 'connected' },
      ]);

      const result = await service.completeTransfer('CF_abc', 'CA_agent');
      expect(result.success).toBe(true);
      // customer unhold
      expect(mockParticipantUpdate).toHaveBeenCalledWith({ hold: false });
      // transfer target gets endConferenceOnExit: true
      expect(mockParticipantUpdate).toHaveBeenCalledWith({ endConferenceOnExit: true });
      // agent removed
      expect(mockParticipantRemove).toHaveBeenCalled();
    });
  });

  describe('cancelTransfer', () => {
    it('should remove transfer target and unhold customer', async () => {
      // first call: removeParticipant for transfer target
      // then listParticipants returns customer on hold
      mockParticipantsList.mockResolvedValue([
        { callSid: 'CA_cust', conferenceSid: 'CF_abc', label: 'customer', hold: true, muted: false, status: 'connected' },
      ]);

      const result = await service.cancelTransfer('CF_abc', 'CA_target');
      expect(result.success).toBe(true);
      expect(mockParticipantRemove).toHaveBeenCalled();
      expect(mockParticipantUpdate).toHaveBeenCalledWith({ hold: false });
    });
  });

  describe('getRecording', () => {
    it('should return a recording URL and numeric duration', async () => {
      mockRecordingFetch.mockResolvedValue({ duration: '42' });

      await expect(service.getRecording('RE_123')).resolves.toEqual({
        url: 'https://api.twilio.com/2010-04-01/Accounts/AC_test/Recordings/RE_123.mp3',
        duration: 42,
      });
    });
  });
});
