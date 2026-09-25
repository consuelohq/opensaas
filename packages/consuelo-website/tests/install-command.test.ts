import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  POSIX_INSTALL_COMMAND,
  WINDOWS_INSTALL_COMMAND,
  installCommandForPlatform,
} from '../src/lib/install-command';

const EXPECTED_WINDOWS_COMMAND = [
  'irm https://install.consuelohq.com/os.ps1',
  '|',
  'iex',
].join(' ');

describe('homepage install command selection', () => {
  for (const platform of ['Win32', 'Win64', 'Windows']) {
    it(`uses PowerShell on ${platform}`, () => {
      assert.equal(installCommandForPlatform(platform), WINDOWS_INSTALL_COMMAND);
      assert.equal(WINDOWS_INSTALL_COMMAND, EXPECTED_WINDOWS_COMMAND);
    });
  }

  for (const platform of ['MacIntel', 'MacARM64', 'Linux x86_64', '']) {
    it(`uses curl on ${platform || 'unknown platform'}`, () => {
      assert.equal(installCommandForPlatform(platform), POSIX_INSTALL_COMMAND);
      assert.match(POSIX_INSTALL_COMMAND, /install\.consuelohq\.com\/os/);
    });
  }
});
