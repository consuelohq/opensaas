import { type APP_LOCALES } from 'twenty-shared/translations';

import { type ApiKeyEntity } from 'src/engine/core-modules/api-key/api-key.entity';
import { type ApplicationEntity } from 'src/engine/core-modules/application/application.entity';
import { type AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { type UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { type UserEntity } from 'src/engine/core-modules/user/user.entity';
import { type AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserEntity | null;
    apiKey?: ApiKeyEntity | null;
    application?: ApplicationEntity | null;
    userWorkspace?: UserWorkspaceEntity;
    locale: keyof typeof APP_LOCALES;
    workspace?: WorkspaceEntity;
    workspaceId?: string;
    workspaceMetadataVersion?: number;
    workspaceMemberId?: string;
    workspaceMember?: WorkspaceMemberWorkspaceEntity;
    userWorkspaceId?: string;
    authProvider?: AuthProviderEnum | null;
    impersonationContext?: AuthContext['impersonationContext'];
  }
}
