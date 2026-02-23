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

import { AgentSkillEntity } from 'src/engine/core-modules/agent/entities/agent-skill.entity';

@Entity({ name: 'agentSkillVersion', schema: 'core' })
@Index('IDX_AGENT_SKILL_VERSION_SKILL_VERSION', ['skillId', 'version'], {
  unique: true,
})
export class AgentSkillVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  skillId: string;

  @ManyToOne(() => AgentSkillEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: Relation<AgentSkillEntity>;

  @Column({ type: 'integer' })
  version: number;

  @Column({ type: 'text', nullable: true })
  systemPrompt: string | null;

  @Column({ type: 'text', nullable: true })
  sandboxTemplate: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  changeSummary: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
