import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatController } from 'src/engine/core-modules/agent/controllers/chat.controller';
import { AgentMemoryController } from 'src/engine/core-modules/agent/controllers/memory.controller';
import { AgentMethodologyController } from 'src/engine/core-modules/agent/controllers/methodology.controller';
import { SkillController } from 'src/engine/core-modules/agent/controllers/skill.controller';
import { AgentAutomationEntity } from 'src/engine/core-modules/agent/entities/automation.entity';
import { AgentMemoryEntity } from 'src/engine/core-modules/agent/entities/agent-memory.entity';
import { AgentMethodologyEntity } from 'src/engine/core-modules/agent/entities/agent-methodology.entity';
import { AgentSkillEntity } from 'src/engine/core-modules/agent/entities/agent-skill.entity';
import { AgentSkillFolderEntity } from 'src/engine/core-modules/agent/entities/agent-skill-folder.entity';
import { AgentSkillUsageLogEntity } from 'src/engine/core-modules/agent/entities/agent-skill-usage-log.entity';
import { AgentWorkspaceConfigEntity } from 'src/engine/core-modules/agent/entities/agent-workspace-config.entity';
import { AgentConversationSummaryEntity } from 'src/engine/core-modules/agent/entities/agent-conversation-summary.entity';
import { AutomationService } from 'src/engine/core-modules/agent/services/automation.service';
import { AgentContextEngineService } from 'src/engine/core-modules/agent/services/context-engine.service';
import { AgentTriggerService } from 'src/engine/core-modules/agent/services/trigger.service';
import { AgentMemoryService } from 'src/engine/core-modules/agent/services/memory.service';
import { CallContextService } from 'src/engine/core-modules/agent/services/call-context.service';
import { PipelineIntelligenceService } from 'src/engine/core-modules/agent/services/pipeline-intelligence.service';
import { PreferenceInferenceService } from 'src/engine/core-modules/agent/services/preference-inference.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        AgentAutomationEntity,
        AgentMemoryEntity,
        AgentMethodologyEntity,
        AgentSkillEntity,
        AgentSkillFolderEntity,
        AgentSkillUsageLogEntity,
        AgentWorkspaceConfigEntity,
        AgentConversationSummaryEntity,
      ],
      'core',
    ),
  ],
  controllers: [AgentMemoryController, AgentMethodologyController, ChatController, SkillController],
  providers: [AgentMemoryService, AutomationService, AgentTriggerService, CallContextService, PipelineIntelligenceService, PreferenceInferenceService, AgentContextEngineService],
  exports: [AgentMemoryService, AutomationService, AgentTriggerService, CallContextService, PipelineIntelligenceService, PreferenceInferenceService, AgentContextEngineService, TypeOrmModule],
})
export class AgentModule {}
