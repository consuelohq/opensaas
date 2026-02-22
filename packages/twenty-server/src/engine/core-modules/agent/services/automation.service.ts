import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AgentAutomationEntity } from 'src/engine/core-modules/agent/entities/automation.entity';

@Injectable()
export class AutomationService {
  constructor(
    @InjectRepository(AgentAutomationEntity, 'core')
    private readonly automationRepository: Repository<AgentAutomationEntity>,
  ) {}

  async create(
    input: Omit<AgentAutomationEntity, 'id' | 'createdAt' | 'updatedAt' | 'skill' | 'workspace' | 'lastRunAt' | 'lastRunStatus'>,
  ): Promise<AgentAutomationEntity> {
    const entity = this.automationRepository.create(input);

    return this.automationRepository.save(entity);
  }

  async findById(id: string): Promise<AgentAutomationEntity | null> {
    return this.automationRepository.findOne({ where: { id } });
  }

  async findByUser(
    userId: string,
    workspaceId: string,
  ): Promise<AgentAutomationEntity[]> {
    return this.automationRepository.find({
      where: { userId, workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async findEnabled(workspaceId: string): Promise<AgentAutomationEntity[]> {
    return this.automationRepository.find({
      where: { workspaceId, enabled: true },
    });
  }

  async update(
    id: string,
    input: Partial<Omit<AgentAutomationEntity, 'id' | 'createdAt' | 'updatedAt' | 'skill' | 'workspace'>>,
  ): Promise<AgentAutomationEntity> {
    await this.automationRepository.update(id, input);

    const updated = await this.automationRepository.findOne({ where: { id } });

    if (!updated) {
      throw new Error(`Automation ${id} not found`);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.automationRepository.delete(id);
  }

  async updateLastRun(
    id: string,
    status: 'success' | 'failure' | 'skipped',
  ): Promise<void> {
    await this.automationRepository.update(id, {
      lastRunAt: new Date(),
      lastRunStatus: status,
    });
  }
}
