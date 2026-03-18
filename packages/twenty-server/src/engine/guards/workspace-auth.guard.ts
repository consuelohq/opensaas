import { type CanActivate, type ExecutionContext } from '@nestjs/common';

import { type Observable } from 'rxjs';

export class WorkspaceAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    return request.workspace !== undefined;
  }
}
