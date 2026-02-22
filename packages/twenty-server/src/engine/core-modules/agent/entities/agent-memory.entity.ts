import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'agentMemory', schema: 'core' })
@Unique('UQ_AGENT_MEMORY_USER_KEY', ['userId', 'key'])
@Index('IDX_AGENT_MEMORY_USER_CONFIDENCE', ['userId', 'confidence'])
@Index('IDX_AGENT_MEMORY_WORKSPACE', ['workspaceId'])
@Index('IDX_AGENT_MEMORY_USER_TYPE', ['userId', 'type'])
export class AgentMemoryEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'real', default: 0.5 })
  confidence: number;

  @Column({ type: 'varchar', length: 20, default: 'inferred' })
  source: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  useCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
