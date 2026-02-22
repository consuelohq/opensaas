import { ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { AgentSkillEntity } from 'src/engine/core-modules/agent/entities/agent-skill.entity';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'agentSkillUsageLog', schema: 'core' })
@ObjectType('AgentSkillUsageLog')
export class AgentSkillUsageLogEntity extends WorkspaceRelatedEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  skillId: string;

  @ManyToOne(() => AgentSkillEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: Relation<AgentSkillEntity>;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  triggeredBy: string;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  errorCode: string | null;

  @Column({ type: 'integer' })
  durationMs: number;

  @Column({ type: 'integer', default: 0 })
  tokensInput: number;

  @Column({ type: 'integer', default: 0 })
  tokensCached: number;

  @Column({ type: 'integer', default: 0 })
  tokensOutput: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  @Column({ type: 'boolean', default: false })
  sandboxUsed: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  executedAt: Date;
}
