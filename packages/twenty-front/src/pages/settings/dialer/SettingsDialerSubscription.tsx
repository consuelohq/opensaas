import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { SubscriptionSettings } from '~/pages/settings/consuelo/SubscriptionSettings';

export const SettingsDialerSubscription = () => {
  return (
    <SubMenuTopBarContainer
      title="Subscription"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Dialer',
          href: getSettingsPath(SettingsPath.Dialer),
        },
        { children: 'Subscription' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <SubscriptionSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
