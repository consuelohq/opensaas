import { runBatch } from './batch';
import { executeTool, manifestEntries } from './executor';
import type { BatchStep, BatchResult, ExecuteToolOptions, ToolInput, ToolResult } from './types';

export type WorkspaceFunction = (input?: ToolInput) => Promise<ToolResult<unknown>>;
export type WorkspaceTree = {
  [key: string]: WorkspaceFunction | WorkspaceTree;
};

export type WorkspaceClient = WorkspaceTree & {
  batch: (steps: BatchStep[]) => Promise<BatchResult>;
};

export function createWorkspaceClient(options: ExecuteToolOptions = {}): WorkspaceClient {
  const root: WorkspaceTree = {};

  for (const entry of manifestEntries) {
    attach(root, entry.methodPath, async (input: ToolInput = {}) => executeTool(entry.name, input, options));
  }

  return {
    ...root,
    batch: (steps: BatchStep[]) => runBatch(steps, options),
  } as WorkspaceClient;
}

function attach(root: WorkspaceTree, path: string[], fn: WorkspaceFunction): void {
  let cursor = root;

  for (const segment of path.slice(0, -1)) {
    const current = cursor[segment];
    if (!isWorkspaceTree(current)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as WorkspaceTree;
  }

  cursor[path[path.length - 1]] = fn;
}

function isWorkspaceTree(value: WorkspaceFunction | WorkspaceTree | undefined): value is WorkspaceTree {
  return typeof value === 'object' && value !== null;
}

export const workspace = createWorkspaceClient();
