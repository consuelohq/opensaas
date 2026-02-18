import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

@Controller('healthz')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HealthCheck()
  check(@Query('debug') debug?: string) {
    if (debug === '1') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (global as any).__lastGraphQLError ?? { message: 'no error captured yet' };
    }

    return this.health.check([]);
  }
}
