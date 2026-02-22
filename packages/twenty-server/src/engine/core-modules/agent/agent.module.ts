import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentMemoryController } from 'src/engine/core-modules/agent/controllers/memory.controller';
import { AgentMemoryEntity } from 'src/engine/core-modules/agent/entities/agent-memory.entity';
import { AgentMemoryService } from 'src/engine/core-modules/agent/services/memory.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgentMemoryEntity], 'core')],
  controllers: [AgentMemoryController],
  providers: [AgentMemoryService],
  exports: [AgentMemoryService],
})
export class AgentModule {}
