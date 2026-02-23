import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AgentMemoryEntity } from 'src/engine/core-modules/agent/entities/agent-memory.entity';

@Injectable()
export class AgentMemoryService {
  private readonly logger = new Logger(AgentMemoryService.name);

  constructor(
    @InjectRepository(AgentMemoryEntity, 'core')
    private readonly memoryRepository: Repository<AgentMemoryEntity>,
  ) {}

  async getTopMemories(
    userId: string,
    limit = 20,
    minConfidence = 0.3,
  ): Promise<AgentMemoryEntity[]> {
    return this.memoryRepository
      .find({
        where: {
          userId,
        },
        order: { confidence: 'DESC', useCount: 'DESC' },
        take: limit,
      })
      .then((rows) => rows.filter((r) => r.confidence >= minConfidence));
  }

  async upsert(
    userId: string,
    workspaceId: string,
    memory: Pick<
      AgentMemoryEntity,
      'type' | 'key' | 'value' | 'confidence' | 'source'
    >,
  ): Promise<AgentMemoryEntity> {
    const existing = await this.memoryRepository.findOne({
      where: { userId, key: memory.key },
    });

    if (existing) {
      existing.value = memory.value;
      existing.confidence = memory.confidence;
      existing.type = memory.type;
      existing.source = memory.source;

      return this.memoryRepository.save(existing);
    }

    const entity = this.memoryRepository.create({
      userId,
      workspaceId,
      ...memory,
    });

    return this.memoryRepository.save(entity);
  }

  async recordUsage(memoryId: string): Promise<void> {
    await this.memoryRepository
      .createQueryBuilder()
      .update(AgentMemoryEntity)
      .set({
        useCount: () => '"useCount" + 1',
        lastUsedAt: new Date(),
      })
      .where('id = :id', { id: memoryId })
      .execute();
  }

  async decayUnused(): Promise<number> {
    const cutoff = new Date();

    cutoff.setDate(cutoff.getDate() - 90);

    const result = await this.memoryRepository
      .createQueryBuilder()
      .update(AgentMemoryEntity)
      .set({
        confidence: () => 'GREATEST("confidence" - 0.1, 0)',
      })
      .where('"lastUsedAt" < :cutoff AND "source" != :source', {
        cutoff,
        source: 'explicit',
      })
      .execute();

    return result.affected ?? 0;
  }

  async delete(memoryId: string, userId: string): Promise<void> {
    await this.memoryRepository.delete({ id: memoryId, userId });
  }

  async update(
    memoryId: string,
    userId: string,
    updates: Partial<Pick<AgentMemoryEntity, 'value' | 'confidence' | 'type'>>,
  ): Promise<AgentMemoryEntity> {
    await this.memoryRepository.update({ id: memoryId, userId }, updates);

    const updated = await this.memoryRepository.findOne({
      where: { id: memoryId, userId },
    });

    if (!updated) {
      throw new Error(`Memory ${memoryId} not found for user ${userId}`);
    }

    return updated;
  }

  async list(
    userId: string,
    options?: { type?: string; limit?: number; offset?: number },
  ): Promise<AgentMemoryEntity[]> {
    const where: Record<string, unknown> = { userId };

    if (options?.type) {
      where.type = options.type;
    }

    return this.memoryRepository.find({
      where,
      order: { confidence: 'DESC', useCount: 'DESC' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }
}
