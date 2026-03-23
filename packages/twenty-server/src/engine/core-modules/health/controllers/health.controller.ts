import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  type HealthIndicatorResult,
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import { withHealthCheckTimeout } from 'src/engine/core-modules/admin-panel/utils/health-check-timeout.util';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

const HEALTH_CHECK_DATABASE_TIMEOUT = 'database healthcheck timed out';
const HEALTH_CHECK_DATABASE_FAILED = 'database connection failed';
const HEALTH_CHECK_REDIS_TIMEOUT = 'redis healthcheck timed out';
const HEALTH_CHECK_REDIS_FAILED = 'redis connection failed';

@Controller('healthz')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisClientService: RedisClientService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async checkDatabaseHealth(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check('database');

    try {
      await withHealthCheckTimeout(
        this.dataSource.query('SELECT 1'),
        HEALTH_CHECK_DATABASE_TIMEOUT,
      );

      return indicator.up({ timestamp: new Date().toISOString() });
    } catch (error: unknown) {
      const message =
        error instanceof Error &&
        error.message === HEALTH_CHECK_DATABASE_TIMEOUT
          ? HEALTH_CHECK_DATABASE_TIMEOUT
          : HEALTH_CHECK_DATABASE_FAILED;

      return indicator.down({ message, timestamp: new Date().toISOString() });
    }
  }

  private async checkRedisHealth(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check('redis');

    try {
      await withHealthCheckTimeout(
        this.redisClientService.getClient().ping(),
        HEALTH_CHECK_REDIS_TIMEOUT,
      );

      return indicator.up({ timestamp: new Date().toISOString() });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message === HEALTH_CHECK_REDIS_TIMEOUT
          ? HEALTH_CHECK_REDIS_TIMEOUT
          : HEALTH_CHECK_REDIS_FAILED;

      return indicator.down({ message, timestamp: new Date().toISOString() });
    }
  }

  @Get()
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HealthCheck()
  check() {
    return this.health.check([
      async () => this.checkDatabaseHealth(),
      async () => this.checkRedisHealth(),
    ]);
  }
}
