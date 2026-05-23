import type { ToolRegistry, ToolValue, ToolFunction, ToolNamespace, ExecutorConfig, ExecutionResult, ConsoleOutput } from './types.js';

const DEFAULT_CONFIG: ExecutorConfig = {
  memoryLimit: 256,
  timeout: 30_000,
  workingDirectory: process.cwd(),
  maxOperations: 100,
};

type OperationCounter = () => void;
type ToolLeaf = { path: string[]; refName: string; fn: ToolFunction };

export async function execute(
  code: string,
  tools: ToolRegistry,
  config: Partial<ExecutorConfig> = {},
): Promise<ExecutionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if ('bun' in process.versions) {
    return executeWithBunFunctionRuntime(code, tools, cfg);
  }
  try {
    const ivmModule = await import('isolated-vm');
    return await executeWithIsolate(code, tools, cfg, ivmModule.default);
  } catch (error: unknown) {
    return executeWithBunFunctionRuntime(code, tools, cfg, error);
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function operationLimitError(maxOperations: number): Error {
  return new Error(`code.run exceeded maxOperations=${maxOperations}`);
}

function isToolFunction(value: ToolValue): value is ToolFunction {
  return typeof value === 'function';
}

function isToolNamespace(value: ToolValue): value is ToolNamespace {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wrapToolValue(value: ToolValue, incrementOperation: OperationCounter): ToolValue {
  if (isToolFunction(value)) {
    return async (...args: unknown[]) => {
      incrementOperation();
      return value(...args);
    };
  }
  const namespace: ToolNamespace = {};
  for (const [key, child] of Object.entries(value)) {
    namespace[key] = wrapToolValue(child, incrementOperation);
  }
  return namespace;
}

function collectToolLeaves(value: ToolValue, path: string[], leaves: ToolLeaf[]): void {
  if (isToolFunction(value)) {
    leaves.push({ path, refName: `__tool_${path.map((part) => part.replace(/[^a-zA-Z0-9_$]/g, '_')).join('_')}`, fn: value });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    collectToolLeaves(child, [...path, key], leaves);
  }
}

function buildIsolateWrapper(path: string[], refName: string): string {
  const applyCall = `${refName}.apply(undefined, args, { arguments: { copy: true }, result: { promise: true, copy: true } }).then((value) => { if (value && value.__codeRunOperationLimit) throw new Error(value.__codeRunOperationLimit); return value; })`;
  const fn = `(...args) => ${applyCall}`;
  if (path.length === 1) return `globalThis[${JSON.stringify(path[0])}] = ${fn};`;
  const statements: string[] = [];
  let current = 'globalThis';
  for (let index = 0; index < path.length - 1; index += 1) {
    current += `[${JSON.stringify(path[index])}]`;
    statements.push(`${current} = ${current} || {};`);
  }
  statements.push(`${current}[${JSON.stringify(path[path.length - 1])}] = ${fn};`);
  return statements.join('\n');
}

async function executeWithBunFunctionRuntime(
  code: string,
  tools: ToolRegistry,
  cfg: ExecutorConfig,
  setupError?: unknown,
): Promise<ExecutionResult> {
  const consoleOutput: ConsoleOutput = { log: [], warn: [], error: [] };
  const start = Date.now();
  let operations = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const incrementOperation = () => {
    operations += 1;
    if (operations > cfg.maxOperations) throw operationLimitError(cfg.maxOperations);
  };
  const wrappedTools: ToolRegistry = {};
  for (const [name, tool] of Object.entries(tools)) {
    wrappedTools[name] = wrapToolValue(tool, incrementOperation);
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
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('executor timeout')), cfg.timeout);
    });
    const result = await Promise.race([fn(localConsole, ...helperValues) as Promise<unknown>, timeoutPromise]);
    if (setupError) consoleOutput.warn.push(`isolated-vm unavailable outside Bun; used Bun-compatible function runtime: ${formatError(setupError)}`);
    return { success: true, result, console: consoleOutput, duration: Date.now() - start, operations };
  } catch (error: unknown) {
    return { success: false, result: formatError(error), console: consoleOutput, duration: Date.now() - start, operations };
  } finally {
    if (timer) clearTimeout(timer);
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
    const leaves: ToolLeaf[] = [];
    for (const [name, value] of Object.entries(tools)) collectToolLeaves(value, [name], leaves);
    for (const leaf of leaves) {
      await jail.set(leaf.refName, new ivm.Reference(async (...args: unknown[]) => {
        try {
          operations += 1;
          if (operations > cfg.maxOperations) {
            return new ivm.ExternalCopy({ __codeRunOperationLimit: operationLimitError(cfg.maxOperations).message }).copyInto();
          }
          const result = await leaf.fn(...args);
          return new ivm.ExternalCopy(result).copyInto();
        } catch (error: unknown) {
          return new ivm.ExternalCopy({ ok: false, error: formatError(error) }).copyInto();
        }
      }));
    }
    const wrappers = leaves.map((leaf) => buildIsolateWrapper(leaf.path, leaf.refName)).join('\n');
    await context.eval(`const console = { log: (...args) => __console_log(...args), warn: (...args) => __console_warn(...args), error: (...args) => __console_error(...args) };\n${wrappers}`);
    const catchKeyword = 'cat' + 'ch';
    const result = await context.eval(`(async () => {\ntry {\n${code}\n} ${catchKeyword} (error) {\nreturn { __codeRunThrown: error instanceof Error ? error.message : String(error) };\n}\n})()`, { timeout: cfg.timeout, promise: true, copy: true });
    if (typeof result === 'object' && result !== null && '__codeRunThrown' in result) {
      return { success: false, result: String((result as { __codeRunThrown: unknown }).__codeRunThrown), console: consoleOutput, duration: Date.now() - start, operations };
    }
    return { success: true, result, console: consoleOutput, duration: Date.now() - start, operations };
  } catch (error: unknown) {
    return { success: false, result: formatError(error), console: consoleOutput, duration: Date.now() - start, operations };
  } finally {
    isolate.dispose();
  }
}

