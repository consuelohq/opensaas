import { type CanActivate, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { type Observable } from 'rxjs';

export class WorkspaceAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request =
      context.getType<string>() === 'http'
        ? context.switchToHttp().getRequest()
        : GqlExecutionContext.create(context).getContext().req;

    return request.workspace !== undefined;
  }
}
