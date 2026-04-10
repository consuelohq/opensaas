export const NAVIGATION_DRAWER_SUPPORT_DROPDOWN_ID =
  'navigation-drawer-support-dropdown';

export const NAVIGATION_DRAWER_UPGRADE_MODAL_ID =
  'navigation-drawer-upgrade-modal';

export const CONSUELO_CHANGELOG_URL = 'https://www.consuelohq.com/changelog';
export const CONSUELO_DOCS_URL = 'https://docs.consuelohq.com';
export const CONSUELO_GOHIGHLEVEL_URL = 'https://www.consuelohq.com/ghl';
export const CONSUELO_DISCORD_COMMUNITY_URL = 'https://discord.gg/87YtkVUBvc';
export const CONSUELO_CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/consuelo-dialer';
export const CONSUELO_CLI_INSTALL_COMMAND = 'npm install -g @consuelo/cli';
export const CONSUELO_DISCORD_DOCS_URL =
  'https://docs.consuelohq.com/user-guide/discord-bot/overview';

export type DownloadAppItemId =
  | 'gohighlevel'
  | 'chatgpt'
  | 'claude'
  | 'discord'
  | 'slack'
  | 'chrome'
  | 'cli';

export type DownloadAppItem =
  | {
      id: DownloadAppItemId;
      type: 'link';
      href: string;
    }
  | {
      id: DownloadAppItemId;
      type: 'command';
      value: string;
    };

export const DOWNLOAD_APP_ITEMS: DownloadAppItem[] = [
  {
    id: 'gohighlevel',
    type: 'link',
    href: CONSUELO_GOHIGHLEVEL_URL,
  },
  {
    id: 'chatgpt',
    type: 'command',
    value: CONSUELO_CLI_INSTALL_COMMAND,
  },
  {
    id: 'claude',
    type: 'command',
    value: CONSUELO_CLI_INSTALL_COMMAND,
  },
  {
    id: 'discord',
    type: 'link',
    href: CONSUELO_DISCORD_DOCS_URL,
  },
  {
    id: 'slack',
    type: 'link',
    href: CONSUELO_DOCS_URL,
  },
  {
    id: 'chrome',
    type: 'link',
    href: CONSUELO_CHROME_EXTENSION_URL,
  },
  {
    id: 'cli',
    type: 'command',
    value: CONSUELO_CLI_INSTALL_COMMAND,
  },
];
