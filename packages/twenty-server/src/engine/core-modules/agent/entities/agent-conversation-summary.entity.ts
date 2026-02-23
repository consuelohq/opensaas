import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'agentConversationSummary', schema: 'core' })
@Index('IDX_AGENT_CONV_SUMMARY_CONVERSATION', ['conversationId'])
@Index('IDX_AGENT_CONV_SUMMARY_USER_WORKSPACE', ['userId', 'workspaceId'])
export class AgentConversationSummaryEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'integer' })
  messageCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
