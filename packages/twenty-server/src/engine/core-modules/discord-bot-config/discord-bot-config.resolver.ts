import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { DiscordBotConfigEntity } from 'src/engine/core-modules/discord-bot-config/discord-bot-config.entity';
import {
  DiscordConnectionStatusDto,
  DiscordInviteUrlDto,
  UpdateDiscordBotConfigInput,
} from 'src/engine/core-modules/discord-bot-config/dtos/discord-bot-config.dto';
import { DiscordBotConfigService } from 'src/engine/core-modules/discord-bot-config/services/discord-bot-config.service';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

@Resolver(() => DiscordBotConfigEntity)
@UseGuards(WorkspaceAuthGuard)
export class DiscordBotConfigResolver {
  constructor(
    private readonly discordBotConfigService: DiscordBotConfigService,
  ) {}

  @Query(() => DiscordBotConfigEntity, { nullable: true })
  @UseGuards(SettingsPermissionGuard(PermissionFlagType.WORKSPACE))
  async discordBotConfig(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<Partial<DiscordBotConfigEntity> | null> {
    return this.discordBotConfigService.getMaskedConfig(workspace.id);
  }

  @Mutation(() => DiscordBotConfigEntity)
  @UseGuards(SettingsPermissionGuard(PermissionFlagType.WORKSPACE))
  async updateDiscordBotConfig(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: UpdateDiscordBotConfigInput,
  ): Promise<DiscordBotConfigEntity> {
    return this.discordBotConfigService.upsert(workspace.id, {
      botToken: input.botToken,
      publicKey: input.publicKey,
      applicationId: input.applicationId,
      clientSecret: input.clientSecret,
    });
  }

  @Query(() => DiscordInviteUrlDto)
  @UseGuards(SettingsPermissionGuard(PermissionFlagType.WORKSPACE))
  async generateDiscordInviteUrl(
    @Args('applicationId') applicationId: string,
  ): Promise<DiscordInviteUrlDto> {
    const inviteUrl =
      this.discordBotConfigService.generateInviteUrl(applicationId);

    return {
      inviteUrl,
      requiredPermissions: [
        'Send Messages',
        'Read Message History',
        'Add Reactions',
        'Use Slash Commands',
        'Manage Channels (optional)',
      ],
    };
  }

  @Query(() => DiscordConnectionStatusDto)
  async discordConnectionStatus(
    @AuthUser() user: UserEntity,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<DiscordConnectionStatusDto> {
    // TODO: Implement Discord user mapping lookup from Redis
    // For now, return not linked status
    return {
      linked: false,
      discordUserId: undefined,
      discordUsername: undefined,
      discordAvatar: undefined,
      linkedAt: undefined,
    };
  }
}
