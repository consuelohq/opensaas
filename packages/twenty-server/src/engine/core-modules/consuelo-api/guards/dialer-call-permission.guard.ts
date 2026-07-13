import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { msg } from '@lingui/core/macro';
import { PermissionFlagType } from 'twenty-shared/constants';
import { isDefined } from 'twenty-shared/utils';

import {
  PermissionsException,
  PermissionsExceptionCode,
  PermissionsExceptionMessage,
} from 'src/engine/metadata-modules/permissions/permissions.exception';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';

type DialerCallRequest = {
  apiKey?: { id?: string };
  application?: { id?: string };
  user?: { id?: string };
  userWorkspaceId?: string;
  workspace?: { id?: string };
};

@Injectable()
export class DialerCallPermissionGuard implements CanActivate {
  constructor(
    @Inject(PermissionsService)
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = GqlExecutionContext.create(context).getContext()
      .req as DialerCallRequest;
    const userWorkspaceId = request.userWorkspaceId;
    const workspaceId = request.workspace?.id;
    const userId = request.user?.id;

    if (
      isDefined(request.apiKey?.id) ||
      isDefined(request.application?.id) ||
      !isDefined(userWorkspaceId) ||
      !isDefined(workspaceId) ||
      !isDefined(userId)
    ) {
      throw new PermissionsException(
        PermissionsExceptionMessage.PERMISSION_DENIED,
        PermissionsExceptionCode.PERMISSION_DENIED,
        {
          userFriendlyMessage: msg`Dialing requires a signed-in workspace user.`,
        },
      );
    }

    const hasPermission =
      await this.permissionsService.userHasWorkspaceSettingPermission({
        userWorkspaceId,
        workspaceId,
        setting: PermissionFlagType.DIALER_CALLING,
      });

    if (hasPermission === true) {
      return true;
    }

    throw new PermissionsException(
      PermissionsExceptionMessage.PERMISSION_DENIED,
      PermissionsExceptionCode.PERMISSION_DENIED,
      {
        userFriendlyMessage: msg`You do not have permission to start calls. Please contact your workspace administrator for access.`,
      },
    );
  }
}
