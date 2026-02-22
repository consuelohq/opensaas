import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentMemoryController } from 'src/engine/core-modules/agent/controllers/memory.controller';
import { AgentMethodologyController } from 'src/engine/core-modules/agent/controllers/methodology.controller';
import { AgentMemoryEntity } from 'src/engine/core-modules/agent/entities/agent-memory.entity';
import { AgentMethodologyEntity } from 'src/engine/core-modules/agent/entities/agent-methodology.entity';
import { AgentSkillEntity } from 'src/engine/core-modules/agent/entities/agent-skill.entity';
import { AgentSkillFolderEntity } from 'src/engine/core-modules/agent/entities/agent-skill-folder.entity';
import { AgentSkillUsageLogEntity } from 'src/engine/core-modules/agent/entities/agent-skill-usage-log.entity';
import { AgentWorkspaceConfigEntity } from 'src/engine/core-modules/agent/entities/agent-workspace-config.entity';
import { AgentMemoryService } from 'src/engine/core-modules/agent/services/memory.service';
import { PipelineIntelligenceService } from 'src/engine/core-modules/agent/services/pipeline-intelligence.service';
import { PreferenceInferenceService } from 'src/engine/core-modules/agent/services/preference-inference.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        AgentMemoryEntity,
        AgentMethodologyEntity,
        AgentSkillEntity,
        AgentSkillFolderEntity,
        AgentSkillUsageLogEntity,
        AgentWorkspaceConfigEntity,
      ],
      'core',
    ),
  ],
  controllers: [AgentMemoryController, AgentMethodologyController],
  providers: [AgentMemoryService, PipelineIntelligenceService, PreferenceInferenceService],
  exports: [AgentMemoryService, PipelineIntelligenceService, PreferenceInferenceService, TypeOrmModule],
})
export class AgentModule {}
