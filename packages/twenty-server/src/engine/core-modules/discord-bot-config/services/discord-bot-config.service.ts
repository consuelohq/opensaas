import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DiscordBotConfigEntity } from 'src/engine/core-modules/discord-bot-config/discord-bot-config.entity';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { EnvironmentConfigDriver } from 'src/engine/core-modules/twenty-config/drivers/environment-config.driver';

const DISCORD_OAUTH_SCOPES = ['bot', 'applications.commands'];

const DISCORD_PERMISSIONS = 268435456;

@Injectable()
export class DiscordBotConfigService {
  constructor(
    @InjectRepository(DiscordBotConfigEntity)
    private readonly discordBotConfigRepository: Repository<DiscordBotConfigEntity>,
    private readonly secretEncryptionService: SecretEncryptionService,
    private readonly environmentConfigDriver: EnvironmentConfigDriver,
  ) {}

  async findByWorkspaceId(
    workspaceId: string,
  ): Promise<DiscordBotConfigEntity | null> {
    return await this.discordBotConfigRepository.findOne({
      where: { workspaceId },
    });
  }

  async upsert(
    workspaceId: string,
    input: {
      botToken?: string;
      publicKey: string;
      applicationId: string;
      clientSecret?: string;
    },
  ): Promise<DiscordBotConfigEntity> {
    let config = await this.findByWorkspaceId(workspaceId);

    const encryptedBotToken = input.botToken
      ? this.secretEncryptionService.encrypt(input.botToken)
      : undefined;

    const encryptedClientSecret = input.clientSecret
      ? this.secretEncryptionService.encrypt(input.clientSecret)
      : undefined;

    if (config) {
      if (encryptedBotToken !== undefined) {
        config.botToken = encryptedBotToken;
      }
      config.publicKey = input.publicKey;
      config.applicationId = input.applicationId;
      if (encryptedClientSecret !== undefined) {
        config.clientSecret = encryptedClientSecret;
      }
      return await this.discordBotConfigRepository.save(config);
    }

    config = this.discordBotConfigRepository.create({
      workspaceId,
      botToken: encryptedBotToken || '',
      publicKey: input.publicKey,
      applicationId: input.applicationId,
      clientSecret: encryptedClientSecret || '',
    });

    return await this.discordBotConfigRepository.save(config);
  }

  async getMaskedConfig(
    workspaceId: string,
  ): Promise<Partial<DiscordBotConfigEntity> | null> {
    const config = await this.findByWorkspaceId(workspaceId);

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      publicKey: config.publicKey,
      applicationId: config.applicationId,
      interactionsEndpointUrl: config.interactionsEndpointUrl,
      botToken: config.botToken
        ? this.secretEncryptionService.decryptAndMask({
            value: config.botToken,
            mask: '***',
          })
        : undefined,
      clientSecret: config.clientSecret
        ? this.secretEncryptionService.decryptAndMask({
            value: config.clientSecret,
            mask: '***',
          })
        : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    } as Partial<DiscordBotConfigEntity>;
  }

  generateInviteUrl(applicationId: string): string {
    const baseUrl = this.environmentConfigDriver.get('SERVER_URL') || '';
    const redirectUri = `${baseUrl}/v1/webhooks/discord/oauth/callback`;

    const params = new URLSearchParams({
      client_id: applicationId,
      scope: DISCORD_OAUTH_SCOPES.join(' '),
      permissions: DISCORD_PERMISSIONS.toString(),
      response_type: 'code',
      redirect_uri: redirectUri,
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  getInteractionsEndpointUrl(): string {
    const baseUrl = this.environmentConfigDriver.get('SERVER_URL') || '';
    return `${baseUrl}/v1/webhooks/discord`;
  }

  decryptBotToken(workspaceId: string): Promise<string | null> {
    return this.getDecryptedField(workspaceId, 'botToken');
  }

  decryptClientSecret(workspaceId: string): Promise<string | null> {
    return this.getDecryptedField(workspaceId, 'clientSecret');
  }

  private async getDecryptedField(
    workspaceId: string,
    field: 'botToken' | 'clientSecret',
  ): Promise<string | null> {
    const config = await this.findByWorkspaceId(workspaceId);
    if (!config) {
      return null;
    }

    const value = config[field];
    if (!value) {
      return null;
    }

    try {
      return this.secretEncryptionService.decrypt(value);
    } catch {
      return null;
    }
  }

  getBotConfig(workspaceId: string): Promise<DiscordBotConfigEntity | null> {
    return this.findByWorkspaceId(workspaceId);
  }
}
