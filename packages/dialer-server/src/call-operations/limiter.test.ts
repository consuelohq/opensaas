import { expect, it } from 'bun:test';
import { FairTranscriptionLimiter } from './limiter';

it('reserves released slots and bounds provider concurrency with fair call queues', async () => {
  const limiter = new FairTranscriptionLimiter(1, 8);
  const order: string[] = [];
  let release: () => void = () => {};
  const first = limiter.run('busy', new AbortController().signal, async () => {
    order.push('first');
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const pending = [
    limiter.run('busy', new AbortController().signal, async () => {
      order.push('busy-2');
    }),
    limiter.run('other', new AbortController().signal, async () => {
      order.push('other');
    }),
    limiter.run('busy', new AbortController().signal, async () => {
      order.push('busy-3');
    }),
  ];
  release();
  await Promise.all([first, ...pending]);
  expect(order.indexOf('other')).toBeLessThan(order.indexOf('busy-3'));
});
it('never starts a cancelled queued request', async () => {
  const limiter = new FairTranscriptionLimiter(1, 4);
  let release: () => void = () => {};
  const first = limiter.run(
    'one',
    new AbortController().signal,
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const controller = new AbortController();
  let called = false;
  const second = limiter
    .run('two', controller.signal, async () => {
      called = true;
    })
    .catch(() => undefined);
  controller.abort();
  release();
  await Promise.all([first, second]);
  expect(called).toBe(false);
});
