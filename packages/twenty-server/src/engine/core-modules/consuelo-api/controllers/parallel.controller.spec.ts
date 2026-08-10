jest.mock('@consuelo/contacts', () => ({
  isValidPhone: jest.fn(() => true),
  normalizePhone: jest.fn((phoneNumber: string) => phoneNumber),
}));

import { UnauthorizedException } from '@nestjs/common';

import { ParallelController } from 'src/engine/core-modules/consuelo-api/controllers/parallel.controller';
import { type ParallelService } from 'src/engine/core-modules/consuelo-api/services/parallel.service';

const createController = () => {
  const service = {
    initiateParallelDial: jest.fn().mockResolvedValue({ groupId: 'pg-1' }),
    validateParallelDial: jest.fn().mockResolvedValue({ valid: true }),
    statusCallback: jest.fn().mockResolvedValue({ received: true }),
    customerTwiml: jest.fn().mockResolvedValue('<Response />'),
    getGroupStatus: jest.fn().mockResolvedValue({ groupId: 'pg-1' }),
    terminateGroup: jest.fn().mockResolvedValue({
      groupId: 'pg-1',
      status: 'completed',
    }),
  } as unknown as jest.Mocked<ParallelService>;

  return {
    controller: new ParallelController(service),
    service,
  };
};

describe('ParallelController compatibility adapter', () => {
  it('propagates authenticated workspace and user context exactly once', async () => {
    const { controller, service } = createController();
    const body = {
      customerNumbers: ['+15550000001', '+15550000002'],
      queueId: 'queue-1',
    };

    await expect(
      controller.initiateParallelDial(
        {
          workspace: { id: 'workspace-1' },
          user: { id: 'user-1' },
        } as never,
        body,
      ),
    ).resolves.toEqual({ groupId: 'pg-1' });

    expect(service.initiateParallelDial).toHaveBeenCalledTimes(1);
    expect(service.initiateParallelDial).toHaveBeenCalledWith({
      body,
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
  });

  it('translates the signed Twilio callback body exactly once', async () => {
    const { controller, service } = createController();
    const body = {
      CallSid: 'CA_TEST',
      CallStatus: 'completed',
      AnsweredBy: 'human',
      CallDuration: '42',
    };

    await expect(controller.statusCallback(body)).resolves.toEqual({
      received: true,
    });

    expect(service.statusCallback).toHaveBeenCalledTimes(1);
    expect(service.statusCallback).toHaveBeenCalledWith(body);
  });

  it('returns TwiML without changing the callback payload', async () => {
    const { controller, service } = createController();
    const response = {
      type: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    const body = {
      CallSid: 'CA_TEST',
      CallStatus: 'in-progress',
      AnsweredBy: 'human',
    };

    await controller.customerTwiml(body, response as never);

    expect(service.customerTwiml).toHaveBeenCalledTimes(1);
    expect(service.customerTwiml).toHaveBeenCalledWith(body);
    expect(response.type).toHaveBeenCalledWith('text/xml');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith('<Response />');
  });

  it('fails closed when authenticated workspace or user context is absent', async () => {
    const { controller, service } = createController();

    await expect(
      controller.initiateParallelDial({ workspace: undefined } as never, {}),
    ).rejects.toThrow(UnauthorizedException);
    expect(service.initiateParallelDial).not.toHaveBeenCalled();
  });
});
