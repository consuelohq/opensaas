import { fileURLToPath } from 'node:url';
import {
  decodeWorkerInput,
  decodeWorkerMessage,
  readLabLines,
  type LabCheckpoint,
  type LabWorkerInput,
  type LabWorkerMessage,
} from './inbound-worker-protocol';
import {
  type SimulatedCarrierMode,
  createSimulatedCarrier,
} from './inbound-simulator';

export type LabWorkerTrace = {
  messages: LabWorkerMessage[];
  crashedAt: LabCheckpoint | null;
  exited: boolean;
};

export const runLabWorker = async (options: {
  input: LabWorkerInput;
  carrier: ReturnType<typeof createSimulatedCarrier>;
  mode?: SimulatedCarrierMode;
  crashAt?: LabCheckpoint;
  onReady?: () => Promise<void>;
}): Promise<LabWorkerTrace> => {
  const input = decodeWorkerInput(options.input);
  const worker = Bun.spawn(
    [
      process.execPath,
      fileURLToPath(new URL('./inbound-lab-worker.ts', import.meta.url)),
    ],
    {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'ignore',
      env: {
        CONSUELO_RD2_ISOLATED_WORKER: '1',
        PATH: process.env.PATH ?? '',
        LC_ALL: 'C',
      },
    },
  );
  let timedOut = false;
  let crashedAt: LabCheckpoint | null = null;
  const messages: LabWorkerMessage[] = [];
  const timer = setTimeout(() => {
    timedOut = true;
    worker.kill('SIGKILL');
  }, 10_000);
  const send = (value: unknown) => {
    worker.stdin.write(JSON.stringify(value) + '\n');
  };
  try {
    send(input);
    for await (const raw of readLabLines(worker.stdout)) {
      const message = decodeWorkerMessage(raw);
      messages.push(message);
      if (message.type === 'ready') {
        await options.onReady?.();
        send('go');
      } else if (message.type === 'checkpoint') {
        if (message.checkpoint === options.crashAt) {
          crashedAt = message.checkpoint;
          worker.kill('SIGKILL');
        } else send('go');
      } else if (message.type === 'provider') {
        if (message.commandId !== input.commandId)
          throw new Error('Worker attempted an unscoped simulator command');
        const result =
          message.operation === 'execute'
            ? options.carrier.execute(
                message.commandId,
                options.mode ?? 'succeed',
              )
            : options.carrier.inspect(message.commandId);
        send(result.outcome);
      } else if (message.type === 'error') {
        throw new Error('Isolated lab worker failed');
      } else {
        worker.stdin.end();
      }
    }
    const exitCode = await worker.exited;
    if (timedOut) throw new Error('Isolated lab worker exceeded deadline');
    if (
      options.crashAt
        ? crashedAt !== options.crashAt || exitCode === 0
        : exitCode !== 0 ||
          !messages.some((message) => message.type === 'result')
    )
      throw new Error('Unexpected lab worker termination');
    return { messages, crashedAt, exited: true };
  } catch (cause: unknown) {
    throw new Error('Inbound process scenario failed', { cause });
  } finally {
    clearTimeout(timer);
    worker.stdin.end();
    if (worker.exitCode === null) worker.kill('SIGKILL');
    await worker.exited;
  }
};

export const runLabRace = async (
  inputs: readonly LabWorkerInput[],
  carrier: ReturnType<typeof createSimulatedCarrier>,
) => {
  if (inputs.length < 2 || inputs.length > 8)
    throw new Error('Lab race requires 2–8 workers');
  let ready = 0;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Release a broken barrier too, so all children can be awaited and cleaned up.
  const barrierDeadline = setTimeout(release, 8_000);
  try {
    const results = await Promise.allSettled(
      inputs.map((input) =>
        runLabWorker({
          input,
          carrier,
          onReady: async () => {
            try {
              ready += 1;
              if (ready === inputs.length) release();
              await gate;
            } catch (cause: unknown) {
              throw new Error('Lab race barrier failed', { cause });
            }
          },
        }),
      ),
    );
    if (
      ready !== inputs.length ||
      results.some((result) => result.status === 'rejected')
    )
      throw new Error(
        'Not all isolated workers reached and completed the race barrier',
      );
    return results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
  } finally {
    clearTimeout(barrierDeadline);
  }
};
