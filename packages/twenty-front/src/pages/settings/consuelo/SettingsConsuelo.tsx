import { SettingsCard } from '@/settings/components/SettingsCard';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import {
  IconHeadphones,
  IconPhone,
  IconRobot,
  IconToggleRight,
  IconCreditCard,
  IconBell,
  IconBuildingSkyscraper,
  IconUserCircle,
} from '@tabler/icons-react';
import { Section } from 'twenty-ui/layout';
import { UndecoratedLink } from 'twenty-ui/navigation';

type MercurySection = {
  path: SettingsPath;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
};

const MERCURY_SECTIONS: MercurySection[] = [
  { path: SettingsPath.MercuryProfile, label: 'Profile', Icon: IconUserCircle },
  {
    path: SettingsPath.MercuryPhoneNumbers,
    label: 'Phone Numbers',
    Icon: IconPhone,
  },
  {
    path: SettingsPath.MercuryCalling,
    label: 'Calling & Presence',
    Icon: IconToggleRight,
  },
  {
    path: SettingsPath.MercuryAudio,
    label: 'Audio Devices',
    Icon: IconHeadphones,
  },
  { path: SettingsPath.MercuryAI, label: 'AI Provider', Icon: IconRobot },
  {
    path: SettingsPath.MercurySubscription,
    label: 'Subscription',
    Icon: IconCreditCard,
  },
  {
    path: SettingsPath.MercuryNotifications,
    label: 'Notifications',
    Icon: IconBell,
  },
  {
    path: SettingsPath.MercuryWorkspace,
    label: 'Workspace',
    Icon: IconBuildingSkyscraper,
  },
];

export const SettingsConsuelo = () => {
  return (
    <SubMenuTopBarContainer
      title="Mercury"
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: 'Mercury' },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          {MERCURY_SECTIONS.map((section) => (
            <UndecoratedLink
              key={section.path}
              to={getSettingsPath(section.path)}
            >
              <SettingsCard
                title={section.label}
                Icon={<section.Icon size={16} />}
              />
            </UndecoratedLink>
          ))}
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
