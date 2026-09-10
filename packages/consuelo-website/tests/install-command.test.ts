import { describe, expect, it } from 'bun:test';

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
  it.each(['Win32', 'Win64', 'Windows'])('uses PowerShell on %s', (platform) => {
    expect(installCommandForPlatform(platform)).toBe(WINDOWS_INSTALL_COMMAND);
    expect(WINDOWS_INSTALL_COMMAND).toBe(EXPECTED_WINDOWS_COMMAND);
  });

  it.each(['MacIntel', 'MacARM64', 'Linux x86_64', ''])('uses curl on %s', (platform) => {
    expect(installCommandForPlatform(platform)).toBe(POSIX_INSTALL_COMMAND);
    expect(POSIX_INSTALL_COMMAND).toContain('install.consuelohq.com/os');
  });
});
