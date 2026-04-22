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
      headers?: string[];
      sampleRows?: string[][];
      rawRows?: string[][];
      targetFields?: { key: string; label: string }[];
    },
  ) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException('Authentication required');
    }

    // accept rawRows (new) or columns/headers (legacy)
    const columns =
      body.columns ??
      body.headers?.map((h, i) => ({ index: i, header: h }));

    // rawRows mode doesn't require columns
    if (
      !body.rawRows &&
      (!Array.isArray(columns) || columns.length === 0)
    ) {
      throw new BadRequestException(
        'rawRows[] or columns[] (or headers[]) required',
      );
    }

    if (!Array.isArray(body.targetFields) || body.targetFields.length === 0) {
      throw new BadRequestException('targetFields[] required');
    }

    try {
      return await this.csvMappingService.analyzeCsvMapping({
        columns: columns ?? [],
        sampleRows: body.sampleRows ?? [],
        targetFields: body.targetFields,
        rawRows: body.rawRows,
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
