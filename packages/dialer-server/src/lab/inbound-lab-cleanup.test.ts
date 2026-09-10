import { expect, it } from 'bun:test';
import { stopLabResources } from './inbound-lab-cleanup';

it('attempts every service stop and preserves live resources when one stop fails', async () => {
  const stopped: string[] = [];
  let removed = false;
  await expect(
    stopLabResources({
      stops: [
        async () => {
          stopped.push('redis');
          throw new Error('stop failure');
        },
        async () => {
          stopped.push('postgres');
        },
      ],
      closed: async () => ({ postgresClosed: true, redisClosed: false }),
      remove: async () => {
        removed = true;
      },
    }),
  ).rejects.toThrow();
  expect(stopped.sort()).toEqual(['postgres', 'redis']);
  expect(removed).toBe(false);
});

it('removes temporary data only after both service ports close', async () => {
  let removed = false;
  expect(
    await stopLabResources({
      stops: [async () => undefined, async () => undefined],
      closed: async () => ({ postgresClosed: true, redisClosed: true }),
      remove: async () => {
        removed = true;
      },
    }),
  ).toEqual({
    postgresClosed: true,
    redisClosed: true,
    tempDirectoryRemoved: true,
  });
  expect(removed).toBe(true);
});
