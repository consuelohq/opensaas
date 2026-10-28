import { Cause, Effect, Exit, Option } from 'effect';

export type EffectResult<A> =
  | { ok: true; value: A }
  | { ok: false; error: unknown };

export async function runApplicationEffect<A, E>(
  program: Effect.Effect<A, E>,
): Promise<EffectResult<A>> {
  try {
    const exit = await Effect.runPromiseExit(program);
    if (Exit.isSuccess(exit)) return { ok: true, value: exit.value };
    const failure = Cause.failureOption(exit.cause);
    if (Option.isSome(failure)) return { ok: false, error: failure.value };
    return { ok: false, error: new Error('Dialer application defect') };
  } catch (error: unknown) {
    return { ok: false, error };
  }
}
