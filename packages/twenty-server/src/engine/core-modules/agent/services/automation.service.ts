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
    input: Omit<AgentAutomationEntity, 'id' | 'createdAt' | 'updatedAt' | 'skill' | 'workspace' | 'lastRunAt' | 'lastRunStatus' | 'consecutiveFailures' | 'maxConsecutiveFailures' | 'disabledReason'>,
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

  async recordSuccess(id: string): Promise<void> {
    await this.automationRepository.update(id, {
      consecutiveFailures: 0,
    });
  }

  async recordFailure(id: string): Promise<void> {
    const automation = await this.automationRepository.findOne({
      where: { id },
    });

    if (!automation) {
      throw new Error(`Automation ${id} not found`);
    }

    const newCount = automation.consecutiveFailures + 1;
    const tripped = newCount >= automation.maxConsecutiveFailures;

    await this.automationRepository.update(id, {
      consecutiveFailures: newCount,
      ...(tripped && {
        enabled: false,
        disabledReason: `Circuit breaker: ${newCount} consecutive failures`,
      }),
    });
  }

  async isCircuitOpen(id: string): Promise<boolean> {
    const automation = await this.automationRepository.findOne({
      where: { id },
    });

    if (!automation) {
      return false;
    }

    return automation.consecutiveFailures >= automation.maxConsecutiveFailures;
  }

  async resetCircuitBreaker(id: string): Promise<void> {
    await this.automationRepository.update(id, {
      consecutiveFailures: 0,
      disabledReason: null,
      enabled: true,
    });
  }

  async getHealthStats(
    workspaceId: string,
  ): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    circuitBroken: number;
  }> {
    const automations = await this.automationRepository.find({
      where: { workspaceId },
    });

    const total = automations.length;
    const enabled = automations.filter((a) => a.enabled).length;
    const disabled = total - enabled;
    const circuitBroken = automations.filter(
      (a) =>
        a.disabledReason !== null &&
        a.disabledReason.startsWith('Circuit breaker'),
    ).length;

    return { total, enabled, disabled, circuitBroken };
  }
}
