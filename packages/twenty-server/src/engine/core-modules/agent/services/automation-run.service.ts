import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AgentAutomationRunEntity } from 'src/engine/core-modules/agent/entities/agent-automation-run.entity';

@Injectable()
export class AutomationRunService {
  private readonly logger = new Logger(AutomationRunService.name);

  constructor(
    @InjectRepository(AgentAutomationRunEntity)
    private readonly runRepository: Repository<AgentAutomationRunEntity>,
  ) {}

  async create(
    automationId: string,
    triggerPayload?: Record<string, unknown>,
  ): Promise<AgentAutomationRunEntity> {
    const entity = this.runRepository.create({
      automationId,
      status: 'pending',
      triggerPayload: triggerPayload ?? null,
    });

    return this.runRepository.save(entity);
  }

  async start(runId: string): Promise<void> {
    await this.runRepository.update(runId, {
      status: 'running',
      startedAt: new Date(),
    });
  }

  async complete(
    runId: string,
    result?: Record<string, unknown>,
  ): Promise<void> {
    const run = await this.runRepository.findOne({ where: { id: runId } });

    if (!run) {
      this.logger.warn(`Run ${runId} not found during complete`);

      return;
    }

    const now = new Date();
    const durationMs = run.startedAt
      ? now.getTime() - run.startedAt.getTime()
      : null;

    run.status = 'success';
    run.completedAt = now;
    run.durationMs = durationMs;
    run.result = result ?? null;

    await this.runRepository.save(run);
  }

  async fail(runId: string, error: string): Promise<void> {
    const run = await this.runRepository.findOne({ where: { id: runId } });

    if (!run) {
      this.logger.warn(`Run ${runId} not found during fail`);

      return;
    }

    const now = new Date();
    const durationMs = run.startedAt
      ? now.getTime() - run.startedAt.getTime()
      : null;

    await this.runRepository.update(runId, {
      status: 'failure',
      completedAt: now,
      durationMs,
      error,
    });
  }

  async findByAutomation(
    automationId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<AgentAutomationRunEntity[]> {
    return this.runRepository.find({
      where: { automationId },
      order: { createdAt: 'DESC' },
      take: opts?.limit ?? 20,
      skip: opts?.offset ?? 0,
    });
  }

  async findById(id: string): Promise<AgentAutomationRunEntity | null> {
    return this.runRepository.findOne({ where: { id } });
  }
}
