import { type Repository, type UpdateResult } from 'typeorm';

import type { AgentAutomationEntity } from 'src/engine/core-modules/agent/entities/automation.entity';
import { AutomationService } from 'src/engine/core-modules/agent/services/automation.service';

describe('AutomationService', () => {
  let automationRepository: jest.Mocked<
    Pick<Repository<AgentAutomationEntity>, 'findOne' | 'save' | 'update'>
  >;
  let service: AutomationService;

  beforeEach(() => {
    automationRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<Repository<AgentAutomationEntity>, 'findOne' | 'save' | 'update'>
    >;

    service = new AutomationService(
      automationRepository as unknown as Repository<AgentAutomationEntity>,
    );
  });

  it('should update only editable fields when runtime fields changed after lookup', async () => {
    const existingAutomation = {
      id: 'automation-id',
      name: 'Existing automation',
      lastRunAt: new Date('2026-06-29T12:00:00.000Z'),
      lastRunStatus: 'success',
      consecutiveFailures: 0,
      disabledReason: null,
    } as AgentAutomationEntity;
    const updatedAutomation = {
      ...existingAutomation,
      name: 'Updated automation',
      lastRunAt: new Date('2026-06-29T12:01:00.000Z'),
      consecutiveFailures: 1,
    } as AgentAutomationEntity;

    automationRepository.findOne
      .mockResolvedValueOnce(existingAutomation)
      .mockResolvedValueOnce(updatedAutomation);
    automationRepository.update.mockResolvedValue({
      affected: 1,
    } as UpdateResult);

    const result = await service.update('automation-id', {
      name: 'Updated automation',
    });

    expect(automationRepository.update).toHaveBeenCalledWith('automation-id', {
      name: 'Updated automation',
    });
    expect(automationRepository.save).not.toHaveBeenCalled();
    expect(result).toBe(updatedAutomation);
  });
});
