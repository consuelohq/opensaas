import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from 'src/engine/core-modules/health/controllers/health.controller';
import { RedisClientModule } from 'src/engine/core-modules/redis-client/redis-client.module';

@Module({
  imports: [TerminusModule, RedisClientModule],
  controllers: [HealthController],
})
export class HealthModule {}
