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
      const g = global as any;

      return {
        yogaPhases: g.__yogaPhases ?? null,
        schemaError: g.__lastGraphQLError ?? null,
        schemaMergeError: g.__lastSchemaMergeError ?? null,
        validationError: g.__lastValidationError ?? null,
        middlewareError: g.__lastMiddlewareError ?? null,
        yogaExecError: g.__lastYogaExecError ?? null,
        yogaResultError: g.__lastYogaResultError ?? null,
      };
    }

    return this.health.check([]);
  }
}
