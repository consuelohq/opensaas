import { type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { DialerCallPermissionGuard } from 'src/engine/core-modules/consuelo-api/guards/dialer-call-permission.guard';
import { PermissionsException } from 'src/engine/metadata-modules/permissions/permissions.exception';
import { type PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';

type MockGraphqlContext = {
  req: {
    apiKey?: { id: string } | null;
    application?: { id: string } | null;
    user?: { id: string } | null;
    userWorkspaceId?: string;
    workspace?: { id: string };
  };
};

describe('DialerCallPermissionGuard', () => {
  let guard: DialerCallPermissionGuard;
  let mockPermissionsService: jest.Mocked<
    Pick<PermissionsService, 'userHasWorkspaceSettingPermission'>
  >;
  let mockGraphqlContext: MockGraphqlContext;

  beforeEach(() => {
    mockPermissionsService = {
      userHasWorkspaceSettingPermission: jest.fn(),
    };
    mockGraphqlContext = {
      req: {
        apiKey: null,
        application: null,
        user: { id: 'user-id' },
        userWorkspaceId: 'user-workspace-id',
        workspace: { id: 'workspace-id' },
      },
    };

    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => mockGraphqlContext,
    } as GqlExecutionContext);

    guard = new DialerCallPermissionGuard(
      mockPermissionsService as unknown as PermissionsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject api-key-only auth for dialing', async () => {
    mockGraphqlContext.req.apiKey = { id: 'api-key-id' };

    await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(
      PermissionsException,
    );
    expect(
      mockPermissionsService.userHasWorkspaceSettingPermission,
    ).not.toHaveBeenCalled();
  });

  it('should reject signed-in users without dialing permission', async () => {
    mockPermissionsService.userHasWorkspaceSettingPermission.mockResolvedValue(
      false,
    );

    await expect(guard.canActivate({} as ExecutionContext)).rejects.toThrow(
      PermissionsException,
    );
  });

  it('should allow signed-in users with dialing permission', async () => {
    mockPermissionsService.userHasWorkspaceSettingPermission.mockResolvedValue(
      true,
    );

    await expect(guard.canActivate({} as ExecutionContext)).resolves.toBe(true);
    expect(
      mockPermissionsService.userHasWorkspaceSettingPermission,
    ).toHaveBeenCalledWith({
      userWorkspaceId: 'user-workspace-id',
      workspaceId: 'workspace-id',
      setting: PermissionFlagType.DIALER_CALLING,
    });
  });
});
