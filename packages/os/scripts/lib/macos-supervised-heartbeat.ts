export const MACOS_SUPERVISED_HEARTBEAT_VERSION = 1;

export function shouldRunMacosSupervisedHeartbeat(input: {
  platform?: NodeJS.Platform;
  supervisedWorker: boolean;
  heartbeatOwner?: string;
  workerId?: string;
}): boolean {
  if ((input.platform ?? process.platform) !== 'darwin' || !input.supervisedWorker) {
    return false;
  }
  if (input.heartbeatOwner === '1') return true;
  if (input.heartbeatOwner === '0') return false;
  return input.workerId === 'worker-0';
}
