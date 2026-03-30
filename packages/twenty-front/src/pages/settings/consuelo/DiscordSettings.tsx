import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { IconCheck, IconCopy, IconLink } from '@tabler/icons-react';
import { H2Title } from 'twenty-ui/display';
import { getDocumentationUrl } from '@/support/utils/getDocumentationUrl';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

const StyledTitleRow = styled.div`
  align-items: baseline;
  display: flex;
  justify-content: space-between;
`;

const StyledDocLink = styled.a`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

// -- types --

type BotConfig = {
  id?: string;
  publicKey: string;
  applicationId: string;
  botToken?: string;
  clientSecret?: string;
  interactionsEndpointUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

type InviteUrl = {
  inviteUrl: string;
  requiredPermissions: string[];
};

type ConnectionStatus = {
  linked: boolean;
  discordUserId?: string;
  discordUsername?: string;
  discordAvatar?: string;
  linkedAt?: string;
};

// -- styled --

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(8)};
`;

const StyledFieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledLabel = styled.label`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledInput = styled.input`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  padding: ${({ theme }) => theme.spacing(2)};
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledCopyRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledUrl = styled.code`
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  word-break: break-all;
  flex: 1;
`;

const StyledStatusRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledStatusDot = styled.span<{ connected: boolean }>`
  background: ${({ connected, theme }) =>
    connected ? theme.color.green : theme.font.color.tertiary};
  border-radius: 50%;
  display: inline-block;
  height: 8px;
  width: 8px;
`;

const StyledStatusText = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledSubText = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledPermissionList = styled.ul`
  margin: ${({ theme }) => theme.spacing(2)} 0;
  padding-left: ${({ theme }) => theme.spacing(4)};
`;

const StyledPermissionItem = styled.li`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledAvatar = styled.img`
  border-radius: 50%;
  height: 32px;
  width: 32px;
`;

// -- helpers --

const fetchJson = async <TData,>(
  path: string,
  options?: RequestInit,
): Promise<TData> => {
  const res = await authenticatedFetch(`${REACT_APP_SERVER_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Request failed: ${res.status}`);
  }
  return data;
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// -- component --

export const DiscordSettings = () => {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [requiredPermissions, setRequiredPermissions] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);
  const [copied, setCopied] = useState(false);

  // form state
  const [botToken, setBotToken] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{ discordBotConfig: BotConfig | null }>(
        '/graphql',
        {
          method: 'POST',
          body: JSON.stringify({
            query: `query { discordBotConfig { id publicKey applicationId botToken clientSecret interactionsEndpointUrl createdAt updatedAt } }`,
          }),
        },
      );
      if (result.discordBotConfig) {
        setConfig(result.discordBotConfig);
        setPublicKey(result.discordBotConfig.publicKey);
        setApplicationId(result.discordBotConfig.applicationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConnectionStatus = useCallback(async () => {
    try {
      const result = await fetchJson<{
        discordConnectionStatus: ConnectionStatus;
      }>('/graphql', {
        method: 'POST',
        body: JSON.stringify({
          query: `query { discordConnectionStatus { linked discordUserId discordUsername discordAvatar linkedAt } }`,
        }),
      });
      setConnectionStatus(result.discordConnectionStatus);
    } catch {
      // Connection status is optional, don't show error
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadConnectionStatus();
  }, [loadConfig, loadConnectionStatus]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fetchJson<{ updateDiscordBotConfig: BotConfig }>(
        '/graphql',
        {
          method: 'POST',
          body: JSON.stringify({
            query: `mutation($input: UpdateDiscordBotConfigInput!) { updateDiscordBotConfig(input: $input) { id publicKey applicationId createdAt updatedAt } }`,
            variables: {
              input: {
                botToken: botToken || undefined,
                publicKey,
                applicationId,
                clientSecret: clientSecret || undefined,
              },
            },
          }),
        },
      );
      setConfig(result.updateDiscordBotConfig);
      setSuccess('Configuration saved successfully');
      setBotToken('');
      setClientSecret('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInviteUrl = async () => {
    if (!applicationId) {
      setError('Application ID is required to generate invite URL');
      return;
    }
    setError(null);
    try {
      const result = await fetchJson<{ generateDiscordInviteUrl: InviteUrl }>(
        '/graphql',
        {
          method: 'POST',
          body: JSON.stringify({
            query: `query($applicationId: String!) { generateDiscordInviteUrl(applicationId: $applicationId) { inviteUrl requiredPermissions } }`,
            variables: { applicationId },
          }),
        },
      );
      setInviteUrl(result.generateDiscordInviteUrl.inviteUrl);
      setRequiredPermissions(
        result.generateDiscordInviteUrl.requiredPermissions,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate invite URL',
      );
    }
  };

  const handleCopyUrl = async () => {
    if (!inviteUrl) return;
    const success = await copyToClipboard(inviteUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLinkAccount = () => {
    const discordAuthUrl = `${REACT_APP_SERVER_BASE_URL}/v1/auth/discord`;
    window.open(discordAuthUrl, '_blank', 'width=600,height=800');
  };

  const interactionsEndpoint =
    config?.interactionsEndpointUrl ||
    `${REACT_APP_SERVER_BASE_URL}/v1/webhooks/discord`;

  return (
    <StyledContainer>
      {/* Bot Configuration */}
      <Section>
        <StyledTitleRow>
          <H2Title
            title="Bot Configuration"
            description="Configure your Discord bot credentials from the Discord Developer Portal"
          />
          <StyledDocLink
            href={getDocumentationUrl({
              path: '/user-guide/discord-bot/overview',
            })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </StyledDocLink>
        </StyledTitleRow>
        <Card rounded>
          <StyledFieldRow>
            <StyledLabel htmlFor="applicationId">Application ID *</StyledLabel>
            <StyledInput
              id="applicationId"
              type="text"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              placeholder="Discord Application ID"
            />
          </StyledFieldRow>

          <StyledFieldRow>
            <StyledLabel htmlFor="publicKey">Public Key *</StyledLabel>
            <StyledInput
              id="publicKey"
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="Discord Public Key"
            />
          </StyledFieldRow>

          <StyledFieldRow>
            <StyledLabel htmlFor="botToken">Bot Token</StyledLabel>
            <StyledInput
              id="botToken"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={
                config?.botToken ? '••••••••••••' : 'Enter bot token to update'
              }
            />
            {config?.botToken && !botToken && (
              <StyledSubText>
                Token already configured (enter to update)
              </StyledSubText>
            )}
          </StyledFieldRow>

          <StyledFieldRow>
            <StyledLabel htmlFor="clientSecret">Client Secret</StyledLabel>
            <StyledInput
              id="clientSecret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={
                config?.clientSecret
                  ? '••••••••••••'
                  : 'Enter client secret to update'
              }
            />
            {config?.clientSecret && !clientSecret && (
              <StyledSubText>
                Secret already configured (enter to update)
              </StyledSubText>
            )}
          </StyledFieldRow>

          <StyledButtonRow>
            <Button
              title={saving ? 'Saving...' : 'Save Configuration'}
              variant="primary"
              onClick={handleSave}
              disabled={saving || !applicationId || !publicKey}
            />
          </StyledButtonRow>

          {error && (
            <StyledStatusRow style={{ color: 'red' }}>{error}</StyledStatusRow>
          )}
          {success && (
            <StyledStatusRow style={{ color: 'green' }}>
              <IconCheck size={16} />
              {success}
            </StyledStatusRow>
          )}
        </Card>
      </Section>

      {/* Invite Link Generator */}
      <Section>
        <H2Title
          title="Bot Invite Link"
          description="Generate a link to invite your Discord bot to a server"
        />
        <Card rounded>
          {!inviteUrl ? (
            <StyledButtonRow>
              <Button
                title="Generate Invite Link"
                variant="secondary"
                Icon={IconLink}
                onClick={handleGenerateInviteUrl}
                disabled={!applicationId}
              />
            </StyledButtonRow>
          ) : (
            <>
              <StyledCopyRow>
                <StyledUrl>{inviteUrl}</StyledUrl>
                <Button
                  title={copied ? 'Copied!' : 'Copy'}
                  variant="secondary"
                  Icon={copied ? IconCheck : IconCopy}
                  onClick={handleCopyUrl}
                />
              </StyledCopyRow>

              <H2Title
                title="Required Permissions"
                description="The bot needs these permissions to function properly"
              />
              <StyledPermissionList>
                {requiredPermissions.map((perm) => (
                  <StyledPermissionItem key={perm}>{perm}</StyledPermissionItem>
                ))}
              </StyledPermissionList>
            </>
          )}
        </Card>
      </Section>

      {/* Webhook Configuration */}
      <Section>
        <H2Title
          title="Webhook Configuration"
          description="Configure your Discord application to send interactions to this endpoint"
        />
        <Card rounded>
          <StyledCopyRow>
            <StyledUrl>{interactionsEndpoint}</StyledUrl>
            <Button
              title={copied ? 'Copied!' : 'Copy'}
              variant="secondary"
              Icon={copied ? IconCheck : IconCopy}
              onClick={() => copyToClipboard(interactionsEndpoint)}
            />
          </StyledCopyRow>
          <StyledSubText>
            Go to Discord Developer Portal → Your Application → Interactions
            Endpoint URL and paste this URL
          </StyledSubText>
        </Card>
      </Section>

      {/* Discord Connection */}
      <Section>
        <H2Title
          title="Discord Connection"
          description="Link your Discord account to use the bot from Discord"
        />
        <Card rounded>
          {loading ? (
            <StyledStatusRow>
              <StyledSubText>Loading...</StyledSubText>
            </StyledStatusRow>
          ) : connectionStatus?.linked ? (
            <StyledStatusRow>
              {connectionStatus.discordAvatar && (
                <StyledAvatar
                  src={`https://cdn.discordapp.com/avatars/${connectionStatus.discordUserId}/${connectionStatus.discordAvatar}.png`}
                  alt="Discord avatar"
                />
              )}
              <StyledStatusText>
                Connected as <strong>{connectionStatus.discordUsername}</strong>
              </StyledStatusText>
              <StyledStatusDot connected={true} />
            </StyledStatusRow>
          ) : (
            <StyledStatusRow>
              <StyledStatusText>Not connected</StyledStatusText>
              <StyledStatusDot connected={false} />
            </StyledStatusRow>
          )}

          <StyledButtonRow>
            <Button
              title={
                connectionStatus?.linked
                  ? 'Reconnect Account'
                  : 'Link Discord Account'
              }
              variant="secondary"
              Icon={IconLink}
              onClick={handleLinkAccount}
            />
          </StyledButtonRow>
        </Card>
      </Section>
    </StyledContainer>
  );
};
