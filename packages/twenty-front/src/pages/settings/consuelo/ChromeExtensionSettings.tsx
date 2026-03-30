import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { t } from '@lingui/core/macro';
import { IconBrandChrome } from '@tabler/icons-react';
import { H2Title } from 'twenty-ui/display';
import { getDocumentationUrl } from '@/support/utils/getDocumentationUrl';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/consuelo-dialer';

const StyledStatusRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};
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

const StyledButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) =>
    `${theme.spacing(2)} ${theme.spacing(4)} ${theme.spacing(3)}`};
`;

export const ChromeExtensionSettings = () => {
  const [connected, setConnected] = useState(false);

  const detectExtension = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      setConnected(false);
      return;
    }
    // extension detection would use chrome.runtime.sendMessage with extension ID
    setConnected(false);
  }, []);

  useEffect(() => {
    detectExtension();
  }, [detectExtension]);

  const handleInstall = useCallback(() => {
    window.open(CHROME_EXTENSION_URL, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <Section>
      <StyledTitleRow>
        <H2Title
          title={t`Chrome Extension`}
          description={t`Install the Consuelo Chrome Extension to use the dialer from any browser tab`}
        />
        <StyledDocLink
          href={getDocumentationUrl({
            path: '/user-guide/chrome-extension/overview',
          })}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t`Documentation`}
        </StyledDocLink>
      </StyledTitleRow>
      <Card rounded>
        <StyledStatusRow>
          <StyledStatusDot connected={connected} />
          <StyledStatusText>
            {connected ? t`Connected` : t`Not installed`}
          </StyledStatusText>
        </StyledStatusRow>
        <StyledButtonRow>
          <Button
            title={
              connected ? t`View in Chrome Web Store` : t`Install Extension`
            }
            Icon={IconBrandChrome}
            size="small"
            onClick={handleInstall}
          />
        </StyledButtonRow>
      </Card>
    </Section>
  );
};
