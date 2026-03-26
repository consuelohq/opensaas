import { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import {
  IconBrandChrome,
  IconExternalLink,
  IconPlugConnected,
  IconPlugX,
} from '@tabler/icons-react';
import { H1Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Card, CardContent, Section } from 'twenty-ui/layout';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsHeaderContainer } from '@/settings/components/SettingsHeaderContainer';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/consuelo-dialer';

const StyledCard = styled(Card)`
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledCardContent = styled(CardContent)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledStatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledStatusIndicator = styled.div<{ connected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  color: ${({ connected, theme }) =>
    connected ? theme.color.green50 : theme.font.color.tertiary};
`;

const StyledDescription = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: 0;
  line-height: 1.6;
`;

const StyledLink = styled.a`
  color: ${({ theme }) => theme.font.color.primary};
  text-decoration: underline;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

type ExtensionStatus = 'checking' | 'connected' | 'not-installed';

export const ChromeExtensionSettings = () => {
  const [status, setStatus] = useState<ExtensionStatus>('checking');
  const [extensionUrl, setExtensionUrl] = useState(CHROME_EXTENSION_URL);
  const [extensionId, setExtensionId] = useState<string | null>(null);

  // fetch chrome extension config from server
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/config/chrome-extension`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.extensionUrl) setExtensionUrl(data.extensionUrl);
          if (data.extensionId) setExtensionId(data.extensionId);
        }
      } catch {
        // use defaults
      }
    };
    fetchConfig();
  }, []);

  // detect if extension is installed
  const detectExtension = useCallback(() => {
    if (!extensionId || typeof chrome === 'undefined' || !chrome.runtime) {
      setStatus('not-installed');
      return;
    }
    try {
      chrome.runtime.sendMessage(
        extensionId,
        { type: 'ping' },
        (response: unknown) => {
          if (chrome.runtime.lastError || !response) {
            setStatus('not-installed');
          } else {
            setStatus('connected');
          }
        },
      );
    } catch {
      setStatus('not-installed');
    }
  }, [extensionId]);

  useEffect(() => {
    if (extensionId) {
      detectExtension();
    } else {
      // no extension ID configured — can't detect, show install link
      setStatus('not-installed');
    }
  }, [extensionId, detectExtension]);

  return (
    <SettingsPageContainer>
      <SettingsHeaderContainer>
        <H1Title title={t`Chrome Extension`} />
      </SettingsHeaderContainer>

      <Section>
        <StyledCard rounded>
          <StyledCardContent>
            <StyledStatusRow>
              <StyledStatusIndicator connected={status === 'connected'}>
                {status === 'connected' ? (
                  <IconPlugConnected size={20} />
                ) : (
                  <IconPlugX size={20} />
                )}
                <span>
                  {status === 'checking'
                    ? t`Checking...`
                    : status === 'connected'
                      ? t`Extension connected`
                      : t`Extension not detected`}
                </span>
              </StyledStatusIndicator>
            </StyledStatusRow>

            <StyledDescription>
              {t`The Consuelo Chrome Extension brings your dialer, contacts, and AI coaching directly into your browser. Install it to make calls from any tab.`}
            </StyledDescription>

            <StyledLink
              href={extensionUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBrandChrome size={16} />
              {status === 'connected'
                ? t`View in Chrome Web Store`
                : t`Install Chrome Extension`}
              <IconExternalLink size={14} />
            </StyledLink>

            {status === 'not-installed' && (
              <Button
                title={t`Check again`}
                variant="secondary"
                size="small"
                onClick={detectExtension}
              />
            )}
          </StyledCardContent>
        </StyledCard>
      </Section>
    </SettingsPageContainer>
  );
};
