import { ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { AgentSkillFolderEntity } from 'src/engine/core-modules/agent/entities/agent-skill-folder.entity';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'agentSkill', schema: 'core' })
@ObjectType('AgentSkill')
@Index('IDX_AGENT_SKILL_WORKSPACE_NAME', ['workspaceId', 'name'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class AgentSkillEntity extends WorkspaceRelatedEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 20, default: 'custom' })
  type: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tools: string[];

  @Column({ type: 'text' })
  systemPrompt: string;

  @Column({ type: 'text', nullable: true })
  sandboxTemplate: string | null;

  @Column({ type: 'text', array: true, default: () => "'{manual}'" })
  triggers: string[];

  @Column({ type: 'jsonb', nullable: true })
  inputSchema: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'text' })
  outputFormat: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  integrations: Record<string, unknown>[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  useWhen: string[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  dontUseWhen: string[];

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'varchar', length: 50 })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  folderId: string | null;

  @ManyToOne(() => AgentSkillFolderEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'folderId' })
  folder: Relation<AgentSkillFolderEntity> | null;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'integer', default: 30000 })
  sandboxTimeoutMs: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
