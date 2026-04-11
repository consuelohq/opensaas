import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';

import { CsvMappingService } from 'src/engine/core-modules/consuelo-api/services/csv-mapping.service';

type AuthRequest = Request & {
  workspace?: { id: string };
  user?: { id: string };
};

@Controller('api/v1')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
export class CsvMappingController {
  constructor(private readonly csvMappingService: CsvMappingService) {}

  @Post('csv-mapping/analyze')
  async analyzeCsvMapping(
    @Req() request: AuthRequest,
    @Body()
    body: {
      columns?: { index: number; header: string }[];
      sampleRows?: string[][];
      targetFields?: { key: string; label: string }[];
    },
  ) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException('Authentication required');
    }

    if (
      !Array.isArray(body.columns) ||
      body.columns.length === 0 ||
      !Array.isArray(body.targetFields) ||
      body.targetFields.length === 0
    ) {
      throw new BadRequestException(
        'columns[] and targetFields[] are required',
      );
    }

    try {
      return await this.csvMappingService.analyzeCsvMapping({
        columns: body.columns,
        sampleRows: body.sampleRows ?? [],
        targetFields: body.targetFields,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'CSV mapping analysis failed';
      Sentry.captureException(err, {
        tags: { component: 'csv-mapping' },
      });
      throw new BadRequestException(message);
    }
  }
}
