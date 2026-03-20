// batch_linear — execute multiple operations in one tool call
import * as reads from './reads.js';
import * as writes from './writes.js';

type OpName = 'get_issue' | 'list_issues' | 'list_comments' | 'get_project' |
  'list_teams' | 'list_labels' | 'list_cycles' |
  'create_issue' | 'update_issue' | 'create_comment' | 'update_comment';

interface BatchOp {
  op: OpName;
  params: Record<string, unknown>;
}

interface BatchResult {
  index: number;
  op: string;
  success: boolean;
  data?: unknown;
  warnings?: unknown[];
  error?: string;
}

const handlers: Record<OpName, (params: Record<string, unknown>) => Promise<unknown>> = {
  get_issue: (p) => reads.getIssue(p as Parameters<typeof reads.getIssue>[0]),
  list_issues: (p) => reads.listIssues(p as Parameters<typeof reads.listIssues>[0]),
  list_comments: (p) => reads.listComments(p as Parameters<typeof reads.listComments>[0]),
  get_project: (p) => reads.getProject(p as Parameters<typeof reads.getProject>[0]),
  list_teams: () => reads.listTeams(),
  list_labels: (p) => reads.listLabels(p as Parameters<typeof reads.listLabels>[0]),
  list_cycles: (p) => reads.listCycles(p as Parameters<typeof reads.listCycles>[0]),
  create_issue: (p) => writes.createIssue(p as Parameters<typeof writes.createIssue>[0]),
  update_issue: (p) => writes.updateIssue(p as Parameters<typeof writes.updateIssue>[0]),
  create_comment: (p) => writes.createComment(p as Parameters<typeof writes.createComment>[0]),
  update_comment: (p) => writes.updateComment(p as Parameters<typeof writes.updateComment>[0]),
};

export async function batchLinear(params: { operations: BatchOp[] }): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for (let i = 0; i < params.operations.length; i++) {
    const { op, params: opParams } = params.operations[i];
    const handler = handlers[op];
    if (!handler) {
      results.push({ index: i, op, success: false, error: `unknown operation: ${op}` });
      continue;
    }
    try {
      const data = await handler(opParams);
      const writeResult = data as { success?: boolean; warnings?: unknown[]; data?: unknown; error?: string };
      if (writeResult && typeof writeResult.success === 'boolean') {
        results.push({ index: i, op, success: writeResult.success, data: writeResult.data, warnings: writeResult.warnings, error: writeResult.error });
      } else {
        results.push({ index: i, op, success: true, data });
      }
    } catch (err: unknown) {
      results.push({ index: i, op, success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
