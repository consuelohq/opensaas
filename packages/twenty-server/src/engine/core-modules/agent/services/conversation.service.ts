import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AgentConversationEntity } from 'src/engine/core-modules/agent/entities/agent-conversation.entity';
import { AgentMessageEntity } from 'src/engine/core-modules/agent/entities/agent-message.entity';

type AddMessageInput = {
  role: string;
  content?: string | null;
  toolName?: string | null;
  toolInput?: Record<string, unknown> | null;
  toolResult?: Record<string, unknown> | null;
  tokenUsage?: Record<string, unknown> | null;
};

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(AgentConversationEntity, 'core')
    private readonly conversationRepo: Repository<AgentConversationEntity>,
    @InjectRepository(AgentMessageEntity, 'core')
    private readonly messageRepo: Repository<AgentMessageEntity>,
  ) {}

  async list(
    userId: string,
    workspaceId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<AgentConversationEntity[]> {
    return this.conversationRepo.find({
      where: { userId, workspaceId },
      order: { pinned: 'DESC', updatedAt: 'DESC' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  async findById(
    id: string,
    userId: string,
  ): Promise<
    (AgentConversationEntity & { messages: AgentMessageEntity[] }) | null
  > {
    const conversation = await this.conversationRepo.findOne({
      where: { id, userId },
    });

    if (!conversation) {
      return null;
    }

    const messages = await this.messageRepo.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
    });

    return { ...conversation, messages };
  }

  async create(
    userId: string,
    workspaceId: string,
    skillId?: string,
  ): Promise<AgentConversationEntity> {
    const entity = this.conversationRepo.create({
      userId,
      workspaceId,
      skillId: skillId ?? null,
    });

    return this.conversationRepo.save(entity);
  }

  async addMessage(
    conversationId: string,
    input: AddMessageInput,
  ): Promise<AgentMessageEntity> {
    const message = this.messageRepo.create({
      conversationId,
      role: input.role,
      content: input.content ?? null,
      toolName: input.toolName ?? null,
      toolInput: input.toolInput ?? null,
      toolResult: input.toolResult ?? null,
      tokenUsage: input.tokenUsage ?? null,
    });

    const saved = await this.messageRepo.save(message);

    await this.conversationRepo
      .createQueryBuilder()
      .update(AgentConversationEntity)
      .set({ messageCount: () => '"messageCount" + 1' })
      .where('id = :id', { id: conversationId })
      .execute();

    return saved;
  }

  async updateTitle(id: string, userId: string, title: string): Promise<void> {
    await this.conversationRepo.update({ id, userId }, { title });
  }

  async togglePin(id: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationRepo.findOne({
      where: { id, userId },
    });

    if (!conversation) {
      throw new Error(`Conversation ${id} not found`);
    }

    const newPinned = !conversation.pinned;

    await this.conversationRepo.update({ id, userId }, { pinned: newPinned });

    return newPinned;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.conversationRepo.delete({ id, userId });
  }
}
