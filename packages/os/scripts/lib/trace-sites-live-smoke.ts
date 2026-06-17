
type SmokeStep = { name: string };

type SmokePlanInput = {
  workspaceHost: string;
  workspaceId: string;
  requireSse?: boolean;
};

type SmokeOk = { ok: true; [key: string]: unknown };
type SmokeFailure = { ok: false; error?: { code?: string; message?: string }; [key: string]: unknown };
type SmokeResult = SmokeOk | SmokeFailure;

type SmokeRunner = {
  workspaceId: string;
  discoverTraceStore: () => Promise<SmokeResult>;
  verifyLocalGateway: () => Promise<SmokeResult>;
  readStartingCursor: () => Promise<SmokeResult & { cursor?: string }>;
  generateHarmlessTrace: () => Promise<SmokeResult & { trace?: { id: string; idempotencyKey?: string } }>;
  pollGatewayRecentUntilVisible: () => Promise<SmokeResult & { cursor?: string; trace?: { id: string; idempotencyKey?: string } }>;
  checkSse: () => Promise<SmokeResult & { skipped?: boolean; reason?: string }>;
  printResult: (value: unknown) => Promise<void>;
};

function gatewayError(workspaceId: string, error: SmokeFailure['error']): SmokeFailure {
  return {
    ok: false,
    publicBoundary: 'consuelo-gateway',
    workspaceId,
    error: {
      code: error?.code ?? 'TRACE_SITES_SMOKE_FAILED',
      message: error?.message ?? 'Trace Sites smoke failed.',
    },
  };
}

export function createTraceSitesLiveSmokePlan(input: SmokePlanInput) {
  const productBase = `https://${input.workspaceHost}/gateway/traces`;
  return {
    workspaceId: input.workspaceId,
    requireSse: input.requireSse ?? false,
    steps: [
      { name: 'discover-trace-store' },
      { name: 'verify-local-bun-gateway' },
      { name: 'read-starting-cursor' },
      { name: 'generate-harmless-trace' },
      { name: 'poll-gateway-recent-until-visible' },
      { name: 'check-sse-optional' },
      { name: 'print-json-result' },
    ] satisfies SmokeStep[],
    productRoutes: [`${productBase}/recent`, `${productBase}/events`],
    forbiddenRoutes: [
      'http://127.0.0.1:8960/gateway/traces/recent',
      'http://localhost:8960/gateway/traces/recent',
    ],
    browserVisibleOutputShape: {
      ok: true,
      publicBoundary: 'consuelo-gateway',
      workspaceId: input.workspaceId,
      traceVisible: true,
      cursor: 'cur_public',
    },
  };
}

export async function runTraceSitesLiveSmokeForTest(runner: SmokeRunner) {
  try {
    const store = await runner.discoverTraceStore();
  if (!store.ok) return gatewayError(runner.workspaceId, store.error);

  const gateway = await runner.verifyLocalGateway();
  if (!gateway.ok) return gatewayError(runner.workspaceId, gateway.error);

  const starting = await runner.readStartingCursor();
  if (!starting.ok) return gatewayError(runner.workspaceId, starting.error);

  const generated = await runner.generateHarmlessTrace();
  if (!generated.ok) return gatewayError(runner.workspaceId, generated.error);

  const visible = await runner.pollGatewayRecentUntilVisible();
  if (!visible.ok) return gatewayError(runner.workspaceId, visible.error);

  const sse = await runner.checkSse();
  const result = {
    ok: true as const,
    publicBoundary: 'consuelo-gateway' as const,
    workspaceId: runner.workspaceId,
    cursor: visible.cursor ?? starting.cursor ?? 'cur_000',
    traceVisible: true,
    trace: visible.trace ?? generated.trace,
    sse: {
      checked: sse.ok,
      skipped: sse.ok ? false : Boolean(sse.skipped),
      reason: sse.ok ? undefined : sse.reason,
    },
  };
  await runner.printResult(result);
  return result;
  } catch (_error: unknown) {
    return gatewayError(runner.workspaceId, { code: 'TRACE_SITES_SMOKE_EXCEPTION', message: 'Trace Sites smoke failed.' });
  }
}
