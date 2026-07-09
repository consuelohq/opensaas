import {
  Controller,
  Get,
  InternalServerErrorException,
  Res,
  UseGuards,
} from '@nestjs/common';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Response } from 'express';

import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
const BOOTSTRAP_SCRIPT_PATH = 'packages/os/scripts/bootstrap.sh';
const PRODUCTION_BOOTSTRAP_SCRIPT_PATH =
  '/app/packages/os/scripts/bootstrap.sh';

function getBootstrapScriptPathCandidates(): string[] {
  return [
    process.env.CONSUELO_OS_BOOTSTRAP_SCRIPT_PATH,
    resolve(process.cwd(), BOOTSTRAP_SCRIPT_PATH),
    resolve(process.cwd(), '../os/scripts/bootstrap.sh'),
    PRODUCTION_BOOTSTRAP_SCRIPT_PATH,
  ].filter((path): path is string => Boolean(path));
}

function resolveBootstrapScriptPath(): string | undefined {
  return getBootstrapScriptPathCandidates().find((scriptPath) =>
    existsSync(scriptPath),
  );
}

@Controller()
export class OsInstallController {
  @Get('os')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  getOsInstaller(@Res() response: Response): void {
    const scriptPath = resolveBootstrapScriptPath();

    if (!scriptPath) {
      throw new InternalServerErrorException(
        `Consuelo OS bootstrap script not found. Checked: ${getBootstrapScriptPathCandidates().join(', ')}`,
      );
    }

    const script = readFileSync(scriptPath, 'utf8');

    response.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.status(200).send(script);
  }
}
