export const MACOS_SUPERVISED_HEARTBEAT_VERSION = 1;

export function shouldRunMacosSupervisedHeartbeat(input: {
  platform?: NodeJS.Platform;
  supervisedWorker: boolean;
  heartbeatOwner?: string;
}): boolean {
  return (input.platform ?? process.platform) === 'darwin'
    && input.supervisedWorker
    && input.heartbeatOwner === '1';
}
