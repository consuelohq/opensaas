export const POSIX_INSTALL_COMMAND = [
  'curl -fsSL https://install.consuelohq.com/os',
  '|',
  'bash',
].join(' ');

export const WINDOWS_INSTALL_COMMAND = [
  'irm https://install.consuelohq.com/os.ps1',
  '|',
  'iex',
].join(' ');

export function installCommandForPlatform(platform: string | null | undefined): string {
  const normalized = platform?.trim().toLowerCase() ?? '';
  return normalized.startsWith('win') || normalized.includes('windows')
    ? WINDOWS_INSTALL_COMMAND
    : POSIX_INSTALL_COMMAND;
}
