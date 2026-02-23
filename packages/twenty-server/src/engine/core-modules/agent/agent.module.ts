import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { AutomationController } from 'src/engine/core-modules/agent/controllers/automation.controller';
import { ChatController } from 'src/engine/core-modules/agent/controllers/chat.controller';
import { ConversationController } from 'src/engine/core-modules/agent/controllers/conversation.controller';
import { AgentMemoryController } from 'src/engine/core-modules/agent/controllers/memory.controller';
import { AgentMethodologyController } from 'src/engine/core-modules/agent/controllers/methodology.controller';
import { SkillController } from 'src/engine/core-modules/agent/controllers/skill.controller';
import { SkillVersionController } from 'src/engine/core-modules/agent/controllers/skill-version.controller';
import { AgentAutomationRunEntity } from 'src/engine/core-modules/agent/entities/agent-automation-run.entity';
import { AgentConversationEntity } from 'src/engine/core-modules/agent/entities/agent-conversation.entity';
import { AgentMessageEntity } from 'src/engine/core-modules/agent/entities/agent-message.entity';
import { AgentAutomationEntity } from 'src/engine/core-modules/agent/entities/automation.entity';
import { AgentMemoryEntity } from 'src/engine/core-modules/agent/entities/agent-memory.entity';
import { AgentMethodologyEntity } from 'src/engine/core-modules/agent/entities/agent-methodology.entity';
import { AgentSkillEntity } from 'src/engine/core-modules/agent/entities/agent-skill.entity';
import { AgentSkillFolderEntity } from 'src/engine/core-modules/agent/entities/agent-skill-folder.entity';
import { AgentSkillUsageLogEntity } from 'src/engine/core-modules/agent/entities/agent-skill-usage-log.entity';
import { AgentSkillVersionEntity } from 'src/engine/core-modules/agent/entities/agent-skill-version.entity';
import { AgentWorkspaceConfigEntity } from 'src/engine/core-modules/agent/entities/agent-workspace-config.entity';
import { AgentConversationSummaryEntity } from 'src/engine/core-modules/agent/entities/agent-conversation-summary.entity';
import { AgentAutomationExecuteJob } from 'src/engine/core-modules/agent/jobs/agent-automation-execute.job';
import { AutomationRunService } from 'src/engine/core-modules/agent/services/automation-run.service';
import { AutomationService } from 'src/engine/core-modules/agent/services/automation.service';
import { AgentContextEngineService } from 'src/engine/core-modules/agent/services/context-engine.service';
import { ConversationService } from 'src/engine/core-modules/agent/services/conversation.service';
import { AgentTriggerService } from 'src/engine/core-modules/agent/services/trigger.service';
import { AgentMemoryService } from 'src/engine/core-modules/agent/services/memory.service';
import { CallContextService } from 'src/engine/core-modules/agent/services/call-context.service';
import { PipelineIntelligenceService } from 'src/engine/core-modules/agent/services/pipeline-intelligence.service';
import { PreferenceInferenceService } from 'src/engine/core-modules/agent/services/preference-inference.service';
import { SkillVersionService } from 'src/engine/core-modules/agent/services/skill-version.service';
import { UsageMeteringService } from 'src/engine/core-modules/agent/services/usage-metering.service';

@Module({
  imports: [
    AuthModule,
    WorkspaceCacheStorageModule,
    TypeOrmModule.forFeature([
      AgentAutomationEntity,
      AgentAutomationRunEntity,
      AgentConversationEntity,
      AgentMemoryEntity,
      AgentMessageEntity,
      AgentMethodologyEntity,
      AgentSkillEntity,
      AgentSkillFolderEntity,
      AgentSkillUsageLogEntity,
      AgentSkillVersionEntity,
      AgentWorkspaceConfigEntity,
      AgentConversationSummaryEntity,
    ]),
  ],
  controllers: [
    AgentMemoryController,
    AgentMethodologyController,
    AutomationController,
    ChatController,
    ConversationController,
    SkillController,
    SkillVersionController,
  ],
  providers: [
    AgentAutomationExecuteJob,
    AgentMemoryService,
    AutomationRunService,
    AutomationService,
    AgentTriggerService,
    CallContextService,
    ConversationService,
    PipelineIntelligenceService,
    PreferenceInferenceService,
    AgentContextEngineService,
    SkillVersionService,
    UsageMeteringService,
  ],
  exports: [
    AgentMemoryService,
    AutomationRunService,
    AutomationService,
    AgentTriggerService,
    CallContextService,
    ConversationService,
    PipelineIntelligenceService,
    PreferenceInferenceService,
    AgentContextEngineService,
    SkillVersionService,
    UsageMeteringService,
    TypeOrmModule,
  ],
})
export class AgentModule {}
