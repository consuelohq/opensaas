import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentSkillEntity } from 'src/engine/core-modules/agent/entities/agent-skill.entity';
import { AgentSkillFolderEntity } from 'src/engine/core-modules/agent/entities/agent-skill-folder.entity';
import { AgentSkillUsageLogEntity } from 'src/engine/core-modules/agent/entities/agent-skill-usage-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentSkillEntity,
      AgentSkillFolderEntity,
      AgentSkillUsageLogEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class AgentModule {}
