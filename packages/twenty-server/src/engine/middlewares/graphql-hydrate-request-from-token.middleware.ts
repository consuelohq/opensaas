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
      // DEV-878: log full stack trace for graphql hydration errors
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      console.error('[GRAPHQL_HYDRATE_ERROR]', msg);

      if (stack) {
        console.error('[GRAPHQL_HYDRATE_STACK]', stack);
      }
      this.middlewareService.writeGraphqlResponseOnExceptionCaught(res, error);

      return;
    }

    next();
  }
}
