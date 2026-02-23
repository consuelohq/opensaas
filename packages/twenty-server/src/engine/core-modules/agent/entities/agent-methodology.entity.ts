import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'agentMethodology', schema: 'core' })
@Index('IDX_AGENT_METHODOLOGY_WORKSPACE', ['workspaceId'])
export class AgentMethodologyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  systemPrompt: string;

  @Column({ type: 'jsonb' })
  qualificationCriteria: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: true })
  scoringWeights: Record<string, number> | null;

  @Column({ type: 'uuid', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
