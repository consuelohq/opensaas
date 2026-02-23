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

import { AgentAutomationEntity } from 'src/engine/core-modules/agent/entities/automation.entity';

@Entity({ name: 'agentAutomationRun', schema: 'core' })
@Index('IDX_AGENT_AUTOMATION_RUN_AUTOMATION', ['automationId'])
@Index('IDX_AGENT_AUTOMATION_RUN_AUTOMATION_STATUS', ['automationId', 'status'])
export class AgentAutomationRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  automationId: string;

  @ManyToOne(() => AgentAutomationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'automationId' })
  automation: Relation<AgentAutomationEntity>;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'integer', nullable: true })
  durationMs: number | null;

  @Column({ type: 'jsonb', nullable: true })
  triggerPayload: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
