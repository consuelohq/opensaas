import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentMemoryController } from 'src/engine/core-modules/agent/controllers/memory.controller';
import { AgentMethodologyController } from 'src/engine/core-modules/agent/controllers/methodology.controller';
import { AgentMemoryEntity } from 'src/engine/core-modules/agent/entities/agent-memory.entity';
import { AgentMethodologyEntity } from 'src/engine/core-modules/agent/entities/agent-methodology.entity';
import { AgentWorkspaceConfigEntity } from 'src/engine/core-modules/agent/entities/agent-workspace-config.entity';
import { AgentMemoryService } from 'src/engine/core-modules/agent/services/memory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [AgentMemoryEntity, AgentMethodologyEntity, AgentWorkspaceConfigEntity],
      'core',
    ),
  ],
  controllers: [AgentMemoryController, AgentMethodologyController],
  providers: [AgentMemoryService],
  exports: [AgentMemoryService],
})
export class AgentModule {}
