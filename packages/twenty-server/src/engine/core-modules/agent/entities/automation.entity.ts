import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';

import { AgentSkillEntity } from 'src/engine/core-modules/agent/entities/agent-skill.entity';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'agentAutomation', schema: 'core' })
@Index('IDX_AGENT_AUTOMATION_USER', ['userId', 'workspaceId'])
@Index('IDX_AGENT_AUTOMATION_SKILL', ['skillId'])
@Index('IDX_AGENT_AUTOMATION_ENABLED', ['enabled'], { where: '"enabled" = true' })
export class AgentAutomationEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'uuid' })
  skillId: string;

  @ManyToOne(() => AgentSkillEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: Relation<AgentSkillEntity>;

  @Column({ type: 'jsonb' })
  triggerConfig: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  inputOverrides: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'failure' })
  notifyOn: string;

  @Column({ type: 'integer', nullable: true })
  maxRunsPerDay: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  lastRunStatus: string | null;

  @Column({ type: 'uuid' })
  userId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
