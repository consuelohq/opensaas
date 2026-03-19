import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiscordBotConfigEntity } from 'src/engine/core-modules/discord-bot-config/discord-bot-config.entity';
import { DiscordBotConfigResolver } from 'src/engine/core-modules/discord-bot-config/discord-bot-config.resolver';
import { DiscordBotConfigService } from 'src/engine/core-modules/discord-bot-config/services/discord-bot-config.service';
import { SecretEncryptionModule } from 'src/engine/core-modules/secret-encryption/secret-encryption.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiscordBotConfigEntity]),
    SecretEncryptionModule,
    TwentyConfigModule,
    PermissionsModule,
  ],
  providers: [DiscordBotConfigService, DiscordBotConfigResolver],
  exports: [DiscordBotConfigService],
})
export class DiscordBotConfigModule {}
