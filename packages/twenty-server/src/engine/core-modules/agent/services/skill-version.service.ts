import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { AgentSkillVersionEntity } from 'src/engine/core-modules/agent/entities/agent-skill-version.entity';

@Injectable()
export class SkillVersionService {
  constructor(
    @InjectRepository(AgentSkillVersionEntity)
    private readonly versionRepository: Repository<AgentSkillVersionEntity>,
  ) {}

  async listVersions(skillId: string): Promise<AgentSkillVersionEntity[]> {
    return this.versionRepository.find({
      where: { skillId },
      order: { version: 'DESC' },
    });
  }

  async getVersion(
    skillId: string,
    version: number,
  ): Promise<AgentSkillVersionEntity | null> {
    return this.versionRepository.findOne({
      where: { skillId, version },
    });
  }

  async createVersion(
    skillId: string,
    data: {
      systemPrompt?: string | null;
      sandboxTemplate?: string | null;
      changeSummary?: string | null;
      createdBy?: string | null;
    },
  ): Promise<AgentSkillVersionEntity> {
    const result = await this.versionRepository
      .createQueryBuilder()
      .select('COALESCE(MAX(version), 0)', 'maxVersion')
      .where('"skillId" = :skillId', { skillId })
      .getRawOne<{ maxVersion: number }>();

    const nextVersion = (result?.maxVersion ?? 0) + 1;

    const entity = this.versionRepository.create({
      skillId,
      version: nextVersion,
      systemPrompt: data.systemPrompt ?? null,
      sandboxTemplate: data.sandboxTemplate ?? null,
      changeSummary: data.changeSummary ?? null,
      createdBy: data.createdBy ?? null,
    });

    return this.versionRepository.save(entity);
  }

  async rollback(
    skillId: string,
    targetVersion: number,
  ): Promise<AgentSkillVersionEntity> {
    const target = await this.versionRepository.findOne({
      where: { skillId, version: targetVersion },
    });

    if (!target) {
      throw new Error(
        `Version ${targetVersion} not found for skill ${skillId}`,
      );
    }

    return this.createVersion(skillId, {
      systemPrompt: target.systemPrompt,
      sandboxTemplate: target.sandboxTemplate,
      changeSummary: `Rollback to v${targetVersion}`,
      createdBy: target.createdBy,
    });
  }
}
