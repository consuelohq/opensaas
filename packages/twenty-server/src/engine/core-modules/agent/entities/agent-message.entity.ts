import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { AgentConversationEntity } from 'src/engine/core-modules/agent/entities/agent-conversation.entity';

@Entity({ name: 'agentMessage', schema: 'core' })
@Index('IDX_AGENT_MESSAGE_CONVERSATION', ['conversationId'])
export class AgentMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => AgentConversationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Relation<AgentConversationEntity>;

  @Column({ type: 'varchar', length: 20 })
  role: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  toolName: string | null;

  @Column({ type: 'jsonb', nullable: true })
  toolInput: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  toolResult: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  tokenUsage: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
