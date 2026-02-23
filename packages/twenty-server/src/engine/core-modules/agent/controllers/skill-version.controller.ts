import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { SkillVersionService } from 'src/engine/core-modules/agent/services/skill-version.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@Controller('v1/agent/skills/:skillId/versions')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(RestApiExceptionFilter)
export class SkillVersionController {
  constructor(private readonly skillVersionService: SkillVersionService) {}

  // literal routes before param routes

  @Get()
  async listVersions(@Param('skillId') skillId: string) {
    try {
      const versions = await this.skillVersionService.listVersions(skillId);

      return { versions };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to list versions';

      throw new HttpException(
        { error: { code: 'LIST_VERSIONS_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':version/rollback')
  async rollback(
    @Param('skillId') skillId: string,
    @Param('version') version: string,
  ) {
    try {
      const newVersion = await this.skillVersionService.rollback(
        skillId,
        parseInt(version, 10),
      );

      return { version: newVersion };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Rollback failed';

      throw new HttpException(
        { error: { code: 'ROLLBACK_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':version')
  async getVersion(
    @Param('skillId') skillId: string,
    @Param('version') version: string,
  ) {
    try {
      const result = await this.skillVersionService.getVersion(
        skillId,
        parseInt(version, 10),
      );

      if (!result) {
        throw new HttpException(
          {
            error: {
              code: 'VERSION_NOT_FOUND',
              message: `Version ${version} not found`,
            },
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return { version: result };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }

      const message =
        err instanceof Error ? err.message : 'Failed to get version';

      throw new HttpException(
        { error: { code: 'GET_VERSION_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
