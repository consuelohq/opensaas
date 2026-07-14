import { Trans } from '@lingui/react';
import { Img } from '@react-email/components';
import { emailTheme } from 'src/engine/core-modules/email/templates/common-style';

import { BaseEmail } from 'src/engine/core-modules/email/templates/components/BaseEmail';
import { CallToAction } from 'src/engine/core-modules/email/templates/components/CallToAction';
import { HighlightedContainer } from 'src/engine/core-modules/email/templates/components/HighlightedContainer';
import { HighlightedText } from 'src/engine/core-modules/email/templates/components/HighlightedText';
import { Link } from 'src/engine/core-modules/email/templates/components/Link';
import { MainText } from 'src/engine/core-modules/email/templates/components/MainText';
import { Title } from 'src/engine/core-modules/email/templates/components/Title';
import { WhatIsTwenty } from 'src/engine/core-modules/email/templates/components/WhatIsTwenty';
import { capitalize } from 'src/engine/core-modules/email/templates/utils/capitalize';
import { createI18nInstance } from 'src/engine/core-modules/email/templates/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';
import { getImageAbsoluteURI } from 'twenty-shared/utils';

type SendInviteLinkEmailProps = {
  link: string;
  workspace: { name: string | undefined; logo: string | undefined };
  sender: {
    email: string;
    firstName: string;
    lastName: string;
  };
  serverUrl: string;
  locale: keyof typeof APP_LOCALES;
};

export const SendInviteLinkEmail = ({
  link,
  workspace,
  sender,
  serverUrl,
  locale,
}: SendInviteLinkEmailProps) => {
  const i18n = createI18nInstance(locale);
  const workspaceLogo = workspace.logo
    ? getImageAbsoluteURI({ imageUrl: workspace.logo, baseUrl: serverUrl })
    : null;

  const senderName = capitalize(sender.firstName);
  const senderEmail = sender.email;
  const workspaceName = workspace.name;

  return (
    <BaseEmail width={333} locale={locale}>
      <Title value={i18n._('Join your team on Consuelo')} />
      <MainText>
        <Trans
          id="{senderName} (<0>{senderEmail}</0>) has invited you to join a workspace called <1>{workspaceName}</1>."
          values={{ senderName, senderEmail, workspaceName }}
          components={{
            0: (
              <Link
                href={`mailto:${senderEmail}`}
                value={senderEmail}
                color={emailTheme.font.colors.blue}
              />
            ),
            1: <b />,
          }}
        />
        <br />
      </MainText>
      <HighlightedContainer>
        {workspaceLogo ? (
          <Img
            src={workspaceLogo}
            width={40}
            height={40}
            alt="Workspace logo"
          />
        ) : (
          <></>
        )}
        {workspace.name ? <HighlightedText value={workspace.name} /> : <></>}
        <CallToAction href={link} value={i18n._('Accept invite')} />
      </HighlightedContainer>
      <WhatIsTwenty i18n={i18n} />
    </BaseEmail>
  );
};

SendInviteLinkEmail.PreviewProps = {
  link: 'https://app.consuelo.com/invite/123',
  workspace: {
    name: 'Acme Inc.',
    logo: 'https://fakeimg.pl/200x200/?text=ACME&font=lobster',
  },
  sender: { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe' },
  serverUrl: 'https://app.consuelo.com',
  locale: 'en',
} as SendInviteLinkEmailProps;

export default SendInviteLinkEmail;
