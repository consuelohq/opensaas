import type { PoolClient } from 'pg';
import type { TelephonyOptions } from './telephony-admission';
export const resolveRepEndpoints = async (
  options: TelephonyOptions,
  client: Pick<PoolClient, 'query'>,
  workspaceId: string,
  repId: string,
) => {
  try {
    return options.devices
      ? await options.devices.read(client, workspaceId, repId)
      : {
          revision: 0,
          endpoints: options.endpoints.filter(
            (e) => e.workspaceId === workspaceId && e.repId === repId,
          ),
        };
  } catch (cause: unknown) {
    throw new Error('Answering endpoint resolution failed', { cause });
  }
};
