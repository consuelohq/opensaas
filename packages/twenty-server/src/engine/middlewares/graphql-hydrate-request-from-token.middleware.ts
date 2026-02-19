import { Injectable, type NestMiddleware } from '@nestjs/common';

import { type NextFunction, type Request, type Response } from 'express';

import { MiddlewareService } from 'src/engine/middlewares/middleware.service';

@Injectable()
export class GraphQLHydrateRequestFromTokenMiddleware
  implements NestMiddleware
{
  constructor(private readonly middlewareService: MiddlewareService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      await this.middlewareService.hydrateGraphqlRequest(req);
    } catch (error: unknown) {
      // DEV-878: store error for debug endpoint (Railway logs are rate-limited)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).__lastMiddlewareError = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      };
      this.middlewareService.writeGraphqlResponseOnExceptionCaught(res, error);

      return;
    }

    next();
  }
}
