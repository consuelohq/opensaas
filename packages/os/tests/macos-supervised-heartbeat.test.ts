import { describe, expect, it } from 'vitest';

import { shouldRunMacosSupervisedHeartbeat } from '../scripts/lib/macos-supervised-heartbeat';

describe('macOS supervised heartbeat ownership', () => {
  it('should preserve explicit heartbeat ownership when the new supervisor provides it', () => {
    expect(shouldRunMacosSupervisedHeartbeat({
      platform: 'darwin',
      supervisedWorker: true,
      heartbeatOwner: '1',
      workerId: 'worker-1',
    })).toBe(true);
    expect(shouldRunMacosSupervisedHeartbeat({
      platform: 'darwin',
      supervisedWorker: true,
      heartbeatOwner: '0',
      workerId: 'worker-0',
    })).toBe(false);
  });

  it('should derive heartbeat ownership from worker-0 when an older supervisor omits the owner flag', () => {
    expect(shouldRunMacosSupervisedHeartbeat({
      platform: 'darwin',
      supervisedWorker: true,
      workerId: 'worker-0',
    })).toBe(true);
    expect(shouldRunMacosSupervisedHeartbeat({
      platform: 'darwin',
      supervisedWorker: true,
      workerId: 'worker-1',
    })).toBe(false);
  });

  it('should reject heartbeat ownership when the process is not a supervised macOS worker', () => {
    expect(shouldRunMacosSupervisedHeartbeat({
      platform: 'linux',
      supervisedWorker: true,
      workerId: 'worker-0',
    })).toBe(false);
    expect(shouldRunMacosSupervisedHeartbeat({
      platform: 'darwin',
      supervisedWorker: false,
      workerId: 'worker-0',
    })).toBe(false);
  });
});
