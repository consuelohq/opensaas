import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'agentConversation', schema: 'core' })
@Index('IDX_AGENT_CONVERSATION_USER_WORKSPACE', ['userId', 'workspaceId'])
export class AgentConversationEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, default: 'New conversation' })
  title: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  skillId: string | null;

  @Column({ type: 'integer', default: 0 })
  messageCount: number;

  @Column({ type: 'boolean', default: false })
  pinned: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
