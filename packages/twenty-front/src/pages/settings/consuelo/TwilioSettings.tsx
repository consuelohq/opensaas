import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import {
  IconCheck,
  IconCloud,
  IconKey,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { useLingui } from '@lingui/react/macro';
import { H2Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { TextInput } from '@/ui/input/components/TextInput';
import { Card, Section } from 'twenty-ui/layout';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

type TwilioConfig = {
  configured: boolean;
  mode: 'hosted' | 'byok' | null;
  hostedAvailable: boolean;
  accountSid?: string;
  twimlAppSid?: string;
  apiKey?: string;
};

const fetchJson = async <TData,>(
  path: string,
  options?: RequestInit,
): Promise<TData> => {
  const res = await authenticatedFetch(`${REACT_APP_SERVER_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 204) {
    return {} as TData;
  }

  const data = (await res.json()) as TData;
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Request failed: ${res.status}`);
  }
  return data;
};

const StyledStatusRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};
`;

const StyledStatusDot = styled.span<{ active: boolean }>`
  background: ${({ active, theme }) =>
    active ? theme.color.green : theme.font.color.tertiary};
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

const StyledButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) =>
    `${theme.spacing(2)} ${theme.spacing(4)} ${theme.spacing(3)}`};
`;

const StyledFormRow = styled.div`
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
`;

const StyledError = styled.div`
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `0 ${theme.spacing(4)} ${theme.spacing(2)}`};
`;

const StyledSuccess = styled.div`
  color: ${({ theme }) => theme.color.green};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `0 ${theme.spacing(4)} ${theme.spacing(2)}`};
`;

export const TwilioSettings = () => {
  const { t } = useLingui();
  const [config, setConfig] = useState<TwilioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showByokForm, setShowByokForm] = useState(false);

  // byok form fields
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchJson<TwilioConfig>('/v1/settings/twilio');
      setConfig(data);
      setShowByokForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t`Failed to load config`);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSaveByok = useCallback(async () => {
    if (!accountSid || !authToken) {
      setError(t`Account SID and Auth Token are required`);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await fetchJson('/v1/settings/twilio', {
        method: 'PUT',
        body: JSON.stringify({
          accountSid,
          authToken,
          ...(apiKey ? { apiKey } : {}),
          ...(apiSecret ? { apiSecret } : {}),
        }),
      });
      setSuccess(t`Twilio credentials saved and verified`);
      setAccountSid('');
      setAuthToken('');
      setApiKey('');
      setApiSecret('');
      await loadConfig();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t`Failed to save`);
    } finally {
      setSaving(false);
    }
  }, [accountSid, authToken, apiKey, apiSecret, loadConfig, t]);

  const handleDelete = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await fetchJson('/v1/settings/twilio', { method: 'DELETE' });
      setSuccess(t`Twilio configuration reset`);
      await loadConfig();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t`Failed to reset`);
    } finally {
      setSaving(false);
    }
  }, [loadConfig, t]);

  if (loading) {
    return (
      <Section>
        <H2Title
          title={t`Twilio`}
          description={t`Phone system configuration`}
        />
        <Card>
          <StyledStatusRow>
            <StyledSubText>{t`Loading...`}</StyledSubText>
          </StyledStatusRow>
        </Card>
      </Section>
    );
  }

  const isHosted = config?.mode === 'hosted';
  const isByok = config?.mode === 'byok';
  const isConfigured = config?.configured === true;

  return (
    <Section>
      <H2Title
        title={t`Twilio`}
        description={t`Phone system configuration for calling`}
      />
      <Card>
        <StyledStatusRow>
          <StyledStatusDot active={isConfigured} />
          <StyledStatusText>
            {isHosted && t`Hosted by Consuelo`}
            {isByok && t`Your Own Twilio Account`}
            {!isConfigured &&
              config?.hostedAvailable &&
              t`Not configured — will auto-provision on first call`}
            {!isConfigured && !config?.hostedAvailable && t`Not configured`}
          </StyledStatusText>
        </StyledStatusRow>

        {isConfigured && (
          <StyledStatusRow>
            <StyledSubText>
              {t`Account`}: {config?.accountSid ?? '—'}
              {config?.twimlAppSid &&
                ` · ${t`TwiML App`}: ${config.twimlAppSid}`}
            </StyledSubText>
          </StyledStatusRow>
        )}

        {isHosted && (
          <StyledStatusRow>
            <IconCloud size={16} />
            <StyledSubText>
              {t`Your phone system is managed by Consuelo. No configuration needed.`}
            </StyledSubText>
          </StyledStatusRow>
        )}

        {error && <StyledError>{error}</StyledError>}
        {success && <StyledSuccess>{success}</StyledSuccess>}

        {showByokForm && (
          <>
            <StyledFormRow>
              <TextInput
                label={t`Account SID`}
                value={accountSid}
                onChange={setAccountSid}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                fullWidth
              />
            </StyledFormRow>
            <StyledFormRow>
              <TextInput
                label={t`Auth Token`}
                value={authToken}
                onChange={setAuthToken}
                placeholder={t`Your Twilio auth token`}
                type="password"
                autoComplete="new-password"
                fullWidth
              />
            </StyledFormRow>
            <StyledFormRow>
              <TextInput
                label={t`API Key (optional)`}
                value={apiKey}
                onChange={setApiKey}
                placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                fullWidth
              />
            </StyledFormRow>
            <StyledFormRow>
              <TextInput
                label={t`API Secret (optional)`}
                value={apiSecret}
                onChange={setApiSecret}
                placeholder={t`Your API secret`}
                type="password"
                autoComplete="new-password"
                fullWidth
              />
            </StyledFormRow>
          </>
        )}

        <StyledButtonRow>
          {!showByokForm && (
            <Button
              title={t`Use Own Twilio Account`}
              Icon={IconKey}
              variant="secondary"
              onClick={() => {
                setShowByokForm(true);
                setError(null);
                setSuccess(null);
              }}
            />
          )}
          {showByokForm && (
            <>
              <Button
                title={
                  saving ? t`Testing & Saving...` : t`Test Connection & Save`
                }
                Icon={saving ? IconRefresh : IconCheck}
                onClick={() => void handleSaveByok()}
                disabled={saving || !accountSid || !authToken}
              />
              <Button
                title={t`Cancel`}
                Icon={IconX}
                variant="secondary"
                onClick={() => {
                  setShowByokForm(false);
                  setError(null);
                }}
              />
            </>
          )}
          {isConfigured && !showByokForm && (
            <Button
              title={saving ? t`Resetting...` : t`Reset Configuration`}
              Icon={IconX}
              variant="secondary"
              onClick={() => void handleDelete()}
              disabled={saving}
            />
          )}
          {!showByokForm && (
            <Button
              title={t`Refresh`}
              Icon={IconRefresh}
              variant="tertiary"
              onClick={() => void loadConfig()}
            />
          )}
        </StyledButtonRow>
      </Card>
    </Section>
  );
};
