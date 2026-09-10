export const stopLabResources = async (options: {
  stops: readonly (() => Promise<unknown>)[];
  closed: () => Promise<{ postgresClosed: boolean; redisClosed: boolean }>;
  remove: () => Promise<void>;
}) => {
  try {
    const stops = await Promise.allSettled(
      options.stops.map((stop) => Promise.resolve().then(stop)),
    );
    const closed = await options.closed();
    if (!closed.postgresClosed || !closed.redisClosed)
      throw new Error(
        'Lab services are still open; preserve the temporary resource directory',
      );
    await options.remove();
    if (stops.some((result) => result.status === 'rejected'))
      throw new Error(
        'Lab service stop reported a failure despite closed ports',
      );
    return { ...closed, tempDirectoryRemoved: true };
  } catch (cause: unknown) {
    throw new Error('Isolated lab teardown failed', { cause });
  }
};
