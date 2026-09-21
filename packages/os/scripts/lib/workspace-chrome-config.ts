import fs from 'node:fs';
import path from 'node:path';

import { loadGlobalYamlConfig } from './consuelo-home';
import type { WorkspaceChromeOptions } from './workspace-chrome';

export function loadWorkspaceChromeOptions(home: string): WorkspaceChromeOptions {
  const configPath = path.join(home, 'consuelo.yaml');
  if (!fs.existsSync(configPath)) return {};
  const config = loadGlobalYamlConfig(configPath);
  const extraSections = config.launcher?.extraSections ?? [];
  return extraSections.length > 0 ? { extraSections } : {};
}
