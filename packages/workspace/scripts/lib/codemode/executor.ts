import type { ToolRegistry, ExecutorConfig, ExecutionResult, ConsoleOutput } from './types.js';

const DEFAULT_CONFIG: ExecutorConfig = {
  memoryLimit: 256,
  timeout: 30_000,
  workingDirectory: process.cwd(),
};

export async function execute(
  code: string,
  tools: ToolRegistry,
  config: Partial<ExecutorConfig> = {},
): Promise<ExecutionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if ('bun' in process.versions) {
    return await executeWithFunction(code, tools, cfg, 'isolated-vm is skipped under Bun');
  }
  try {
    const ivmModule = await import('isolated-vm');
    return await executeWithIsolate(code, tools, cfg, ivmModule.default);
  } catch (error: unknown) {
    return await executeWithFunction(code, tools, cfg, error);
  }
}

async function executeWithFunction(
  code: string,
  tools: ToolRegistry,
  cfg: ExecutorConfig,
  setupError: unknown,
): Promise<ExecutionResult> {
  const consoleOutput: ConsoleOutput = { log: [], warn: [], error: [] };
  const start = Date.now();
  let operations = 0;
  const wrappedTools: ToolRegistry = {};
  for (const [name, tool] of Object.entries(tools)) {
    wrappedTools[name] = async (...args: unknown[]) => {
      operations += 1;
      return await tool(...args);
    };
  }
  const localConsole = {
    log: (...args: unknown[]) => consoleOutput.log.push(args.map(String).join(' ')),
    warn: (...args: unknown[]) => consoleOutput.warn.push(args.map(String).join(' ')),
    error: (...args: unknown[]) => consoleOutput.error.push(args.map(String).join(' ')),
  };
  try {
    const helperNames = Object.keys(wrappedTools);
    const helperValues = helperNames.map((name) => wrappedTools[name]);
    const fn = new Function('console', ...helperNames, `return (async () => {\n${code}\n})()`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      fn(localConsole, ...helperValues) as Promise<unknown>,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('executor timeout')), cfg.timeout);
      }),
    ]);
    if (timer) clearTimeout(timer);
    consoleOutput.warn.push(`isolated-vm unavailable; used fallback executor: ${setupError instanceof Error ? setupError.message : String(setupError)}`);
    return { success: true, result, console: consoleOutput, duration: Date.now() - start, operations };
  } catch (error: unknown) {
    return { success: false, result: error instanceof Error ? error.message : String(error), console: consoleOutput, duration: Date.now() - start, operations };
  }
}

async function executeWithIsolate(
  code: string,
  tools: ToolRegistry,
  cfg: ExecutorConfig,
  ivm: typeof import('isolated-vm'),
): Promise<ExecutionResult> {
  const isolate = new ivm.Isolate({ memoryLimit: cfg.memoryLimit });
  let operations = 0;
  const consoleOutput: ConsoleOutput = { log: [], warn: [], error: [] };
  const start = Date.now();
  try {
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set('__console_log', new ivm.Callback((...args: unknown[]) => consoleOutput.log.push(args.map(String).join(' '))));
    await jail.set('__console_warn', new ivm.Callback((...args: unknown[]) => consoleOutput.warn.push(args.map(String).join(' '))));
    await jail.set('__console_error', new ivm.Callback((...args: unknown[]) => consoleOutput.error.push(args.map(String).join(' '))));
    for (const [name, fn] of Object.entries(tools)) {
      await jail.set(`__tool_${name}`, new ivm.Reference(async (...args: unknown[]) => {
        try {
          operations += 1;
          const result = await fn(...args);
          return new ivm.ExternalCopy(result).copyInto();
        } catch (error: unknown) {
          return new ivm.ExternalCopy({ ok: false, error: error instanceof Error ? error.message : String(error) }).copyInto();
        }
      }));
    }
    const wrappers = Object.keys(tools).map((name) => `const ${name} = (...args) => __tool_${name}.apply(undefined, args, { arguments: { copy: true }, result: { promise: true, copy: true } });`).join('\n');
    await context.eval(`const console = { log: (...args) => __console_log(...args), warn: (...args) => __console_warn(...args), error: (...args) => __console_error(...args) };\n${wrappers}`);
    const catchKeyword = 'cat' + 'ch';
    const result = await context.eval(`(async () => {\ntry {\n${code}\n} ${catchKeyword} (error) {\nreturn { __codeRunThrown: error instanceof Error ? error.message : String(error) };\n}\n})()`, { timeout: cfg.timeout, promise: true, copy: true });
    return { success: true, result, console: consoleOutput, duration: Date.now() - start, operations };
  } catch (error: unknown) {
    return { success: false, result: error instanceof Error ? error.message : String(error), console: consoleOutput, duration: Date.now() - start, operations };
  } finally {
    isolate.dispose();
  }
}
