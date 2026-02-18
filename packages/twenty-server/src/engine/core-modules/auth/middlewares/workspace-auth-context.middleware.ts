import { Injectable, type NestMiddleware } from '@nestjs/common';

import { type NextFunction, type Request, type Response } from 'express';
import { isDefined } from 'twenty-shared/utils';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { withWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type UserEntity } from 'src/engine/core-modules/user/user.entity';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';
import { type ApplicationEntity } from 'src/engine/core-modules/application/application.entity';
import { type ApiKeyEntity } from 'src/engine/core-modules/api-key/api-key.entity';
import { buildApiKeyAuthContext } from 'src/engine/core-modules/auth/utils/build-api-key-auth-context.util';
import { buildApplicationAuthContext } from 'src/engine/core-modules/auth/utils/build-application-auth-context.util';
import { buildPendingActivationUserAuthContext } from 'src/engine/core-modules/auth/utils/build-pending-activation-user-auth-context.util';
import { buildUserAuthContext } from 'src/engine/core-modules/auth/utils/build-user-auth-context.util';

type AuthRequest = Request & {
  workspace?: WorkspaceEntity;
  user?: UserEntity;
  apiKey?: ApiKeyEntity;
  application?: ApplicationEntity;
  userWorkspaceId?: string;
  workspaceMemberId?: string;
  workspaceMember?: WorkspaceMemberWorkspaceEntity;
};

@Injectable()
export class WorkspaceAuthContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;

    if (!isDefined(authReq.workspace)) {
      next();

      return;
    }

    const authContext = this.buildAuthContext(authReq);

    withWorkspaceAuthContext(authContext, () => {
      next();
    });
  }

  private buildAuthContext(req: AuthRequest): WorkspaceAuthContext {
    if (isDefined(req.apiKey)) {
      return buildApiKeyAuthContext({
        workspace: req.workspace!,
        apiKey: req.apiKey,
      });
    }

    if (isDefined(req.application)) {
      return buildApplicationAuthContext({
        workspace: req.workspace!,
        application: req.application,
      });
    }

    if (
      isDefined(req.userWorkspaceId) &&
      isDefined(req.workspaceMemberId) &&
      isDefined(req.workspaceMember) &&
      isDefined(req.user)
    ) {
      return buildUserAuthContext({
        workspace: req.workspace!,
        userWorkspaceId: req.userWorkspaceId,
        user: req.user,
        workspaceMemberId: req.workspaceMemberId,
        workspaceMember: req.workspaceMember,
      });
    }

    if (isDefined(req.userWorkspaceId) && isDefined(req.user)) {
      return buildPendingActivationUserAuthContext({
        workspace: req.workspace!,
        userWorkspaceId: req.userWorkspaceId,
        user: req.user,
      });
    }

    throw new AuthException(
      'No authentication context found',
      AuthExceptionCode.UNAUTHENTICATED,
    );
  }
}
