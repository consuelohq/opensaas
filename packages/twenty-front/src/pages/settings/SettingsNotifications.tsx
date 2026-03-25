import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/layout';
import { PreferencesSettings } from '~/pages/settings/consuelo/PreferencesSettings';

export const SettingsNotifications = () => {
  const { t } = useLingui();

  return (
    <SubMenuTopBarContainer
      title={t`Notifications`}
      links={[
        {
          children: t`Other`,
          href: getSettingsPath(SettingsPath.Notifications),
        },
        { children: t`Notifications` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <PreferencesSettings />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
