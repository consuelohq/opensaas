import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { AgentMethodologyEntity } from './agent-methodology.entity';

@Entity({ name: 'agentWorkspaceConfig', schema: 'core' })
export class AgentWorkspaceConfigEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  activeMethodologyId: string;

  @ManyToOne(() => AgentMethodologyEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'activeMethodologyId' })
  activeMethodology: Relation<AgentMethodologyEntity>;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
