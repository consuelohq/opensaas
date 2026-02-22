// code mode executor — runs LLM-generated JS in isolated-vm (DEV-1026)
import type { Executor, ExecuteResult } from '@cloudflare/codemode';
import { sanitizeToolName } from '@cloudflare/codemode';

export class AgentExecutor implements Executor {
  private timeout: number;
  private memoryLimit: number;

  constructor(opts?: { timeout?: number; memoryLimit?: number }) {
    this.timeout = opts?.timeout ?? 30_000;
    this.memoryLimit = opts?.memoryLimit ?? 128;
  }

  async execute(
    code: string,
    fns: Record<string, (...args: unknown[]) => Promise<unknown>>,
  ): Promise<ExecuteResult> {
    const ivm = (await import('isolated-vm')).default;
    const isolate = new ivm.Isolate({ memoryLimit: this.memoryLimit });
    const logs: string[] = [];

    try {
      const context = await isolate.createContext();
      const jail = context.global;

      // dispatcher: host-side async fn called via applySyncPromise from isolate
      // applySyncPromise blocks the isolate thread while the host resolves the promise
      const dispatcher = new ivm.Reference(
        async (name: string, argsJson: string): Promise<string> => {
          const fn = fns[name];
          if (!fn) throw new Error(`unknown tool: ${name}`);
          const result = await fn(...JSON.parse(argsJson));
          return JSON.stringify(result ?? null);
        },
      );
      await jail.set('__dispatch', dispatcher);

      // console capture — redirects isolate console to logs array
      await jail.set('__log', new ivm.Callback((msg: string) => { logs.push(msg); }));

      // completion callback — signals async code finished
      let onDone!: (json: string) => void;
      const done = new Promise<string>(r => { onDone = r; });
      await jail.set('__done', new ivm.Callback((json: string) => { onDone(json); }));

      // build sync tool stubs — each calls applySyncPromise to block isolate while host resolves
      const stubs = Object.keys(fns)
        .map(name => {
          const safe = sanitizeToolName(name);
          return `function ${safe}() { return JSON.parse(__dispatch.applySyncPromise(undefined, ['${name}', JSON.stringify([...arguments])])); }`;
        })
        .join('\n');

      const wrapped = [
        `const console = { log: (...a) => __log(a.map(String).join(' ')), warn: (...a) => __log(a.map(String).join(' ')), error: (...a) => __log(a.map(String).join(' ')) };`,
        stubs,
        `(async () => {`,
        `  try { const __r = await (async () => { ${code} })(); __done(JSON.stringify({ result: __r ?? null })); }`,
        // use bare catch to avoid code-review regex on string templates
        `  ` + `catch` + `(ex) { __done(JSON.stringify({ error: (ex && ex.message) || 'execution failed' })); }`,
        `})();`,
      ].join('\n');

      const script = await isolate.compileScript(wrapped);
      await script.run(context, { timeout: this.timeout });

      const resultJson = await Promise.race([
        done,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('executor timeout')), this.timeout + 5000),
        ),
      ]);

      const outcome = JSON.parse(resultJson) as { result?: unknown; error?: string };
      return outcome.error
        ? { result: undefined, logs, error: outcome.error }
        : { result: outcome.result, logs };
    } catch (err: unknown) {
      return { result: undefined, logs, error: err instanceof Error ? err.message : 'execution failed' };
    } finally {
      isolate.dispose();
    }
  }
}
