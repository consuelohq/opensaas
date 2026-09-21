export type TraceSessionIdentityInput = {
  workPath?: unknown;
  branch?: unknown;
  taskSession?: unknown;
  workSession?: unknown;
};

export function resolveTraceSessionIdentity(
  input: TraceSessionIdentityInput,
  fallback = 'no-branch',
): string {
  const sessionValue = (value: unknown): string => {
    const candidate = String(value ?? '').trim();
    if (!candidate || candidate === 'no-branch' || candidate === '(no branch)') return '';
    return candidate;
  };

  const taskSession = sessionValue(input.taskSession);
  const workSession = sessionValue(input.workSession);
  if (taskSession && workSession) return `${taskSession} + ${workSession}`;

  const workPath = sessionValue(input.workPath);
  if (workPath) return workPath;

  const branch = sessionValue(input.branch);
  if (branch) return branch;

  return taskSession || workSession || fallback;
}
