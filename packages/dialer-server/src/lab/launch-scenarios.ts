/**
 * Human-driven acceptance catalog for Consuelo Dialer.
 *
 * A passing component regression is NOT evidence of PSTN or two-way audio.
 * This module has no network, telephony, payment, or production mutation code.
 */
export type LaunchCategory =
  | 'outbound' | 'predictive' | 'inbound' | 'concurrency'
  | 'recovery' | 'crm' | 'security' | 'commercial';

export type AutomationConfidence = 'component-only' | 'simulated-system';
export type EvidenceLane = 'automated' | 'manual';
export type EvidenceOutcome = 'passed' | 'failed' | 'blocked';

export interface LaunchScenario {
  id: string;
  title: string;
  category: LaunchCategory;
  requiresCarrier: boolean;
  preconditions: readonly string[];
  actions: readonly string[];
  expected: readonly string[];
  invariants: readonly string[];
  diagnostics: readonly string[];
  automation: readonly string[];
  automationConfidence: AutomationConfidence;
}

/** Paths are existing deterministic Bun tests; none initiates a carrier call. */
const tests = {
  outbound: 'packages/dialer/src/application/dialer-call-start-application.test.ts',
  outcomes: 'packages/dialer/src/infrastructure/twilio/create-outcome.test.ts',
  parallel: 'packages/dialer/src/infrastructure/memory/parallel-state-store-layer.test.ts',
  inbound: 'packages/dialer/src/inbound/lifecycle.test.ts',
  routing: 'packages/dialer/src/inbound/routing-policy.test.ts',
  capacity: 'packages/dialer/src/inbound/rep-capacity.test.ts',
  recovery: 'packages/dialer-server/src/lab/inbound-simulator.test.ts',
  control: 'packages/lead-connector/src/embed/controller.test.ts',
  workspace: 'packages/lead-connector/src/embed/calling-workspace.test.ts',
  voice: 'packages/lead-connector/src/embed/agent-voice.test.ts',
  operator: 'packages/lead-connector/src/embed/inbound-operator.test.ts',
  renew: 'packages/lead-connector/src/embed/session-renewal.test.ts',
  refresh: 'packages/lead-connector/src/embed/idle-refresh.test.ts',
  crm: 'packages/lead-connector/src/embed/click-to-call-runtime.test.ts',
  security: 'packages/lead-connector/src/embed/protocol.test.ts',
  billing: 'packages/lead-connector/src/commercial-webhook.acceptance.test.ts',
  commerce: 'packages/lead-connector/src/embed/commercial-ui.acceptance.test.ts',
  landing: 'packages/lead-connector/src/embed/workspace-launch.test.ts',
  numbers: 'packages/lead-connector/src/embed/rep-workflows.test.ts',
} as const;

const baseDiagnostics = [
  'scenario run ID, timestamp and signed workspace/location (masked)',
  'session/assignment/correlation IDs, generations and provider events (masked)',
  'UI phase, observed action, API response status and elapsed time',
  'server journal, provider effect, rep capacity and caller-id-lock:* state',
];

const define = (
  id: string, title: string, category: LaunchCategory, requiresCarrier: boolean,
  preconditions: string[], actions: string[], expected: string[],
  invariants: string[], automation: string[], extraDiagnostics: string[] = [],
  automationConfidence: AutomationConfidence = 'component-only',
): LaunchScenario => ({
  id, title, category, requiresCarrier, preconditions, actions, expected,
  invariants, diagnostics: [...baseDiagnostics, ...extraDiagnostics],
  automation, automationConfidence,
});

export const launchScenarios: readonly LaunchScenario[] = [
  define('S01','Single outbound: select, connect, hang up, dispose','outbound',true,
    ['Signed-in Wet Stone test rep, eligible owned caller ID, consented destination, no active call'],
    ['Open CRM Contacts, select known test contact, open Dialer, verify Call from and Single mode',
     'Start once, speak on both ends, hang up, select disposition and reopen History'],
    ['Exactly one call connects with two-way audio; accurate duration and disposition in History'],
    ['One provider effect and one customer call; all agent legs, session capacity and caller-ID locks released'],[tests.outbound,tests.workspace]),
  define('S02','No-answer, busy, rejection and terminal cleanup','outbound',true,
    ['Two authorized test endpoints; caller ID idle and attempts ledger reset for fixture'],
    ['Start a single call, let the destination ring without answering; repeat separately with busy/decline',
     'Return Home and inspect history, availability, retries and provider terminal states'],
    ['No false human connection; each terminal reason represented without an endless spinner'],
    ['No orphan legs; no duplicate provider initiation; attempts and locks reconciled'],[tests.outcomes,tests.outbound]),
  define('S03','Machine answer and voicemail classification','outbound',true,
    ['Controlled voicemail test destination and AMD policy; recording separately authorized if used'],
    ['Place one approved call to voicemail and let greeting start',
     'Observe machine classification and next disposition or queue behavior'],
    ['Machine-only call does not steal human winner or leave representative connected'],
    ['AMD callbacks idempotent, browser-agent leg closed, caller-ID lock released'],[tests.outcomes,tests.parallel]),
  define('S04','Predictive two-line fanout with human and no-answer','predictive',true,
    ['Two consented destinations, one test rep, two-line entitlement and correct attempt windows'],
    ['Select predictive queue and 2 lines; start one approved batch',
     'Answer one destination, ignore the other; finish connected leg and dispose'],
    ['Exactly one human winner becomes audible; losing leg terminated and attributed correctly'],
    ['Requested fanout <= 2; winner chosen by backend; no lingering losing conference leg'],[tests.parallel,tests.outcomes]),
  define('S05','Predictive three-line simultaneous human answers','predictive',true,
    ['Three consented destinations, enabled three-line entitlement and multiple responders'],
    ['Prepare all three test recipients to answer nearly simultaneously',
     'Start one authorized 3-line batch, answer together; disconnect and inspect outcomes'],
    ['At most one winner audible to rep; losing humans terminated safely'],
    ['One committed winner; losing conferences, agent legs and locks closed'],[tests.parallel,tests.outcomes]),
  define('S06','Rapid double-click and unknown call-creation outcome','outbound',false,
    ['Intercepted provider/transport fixture; no live call enabled'],
    ['Submit two immediate equivalent Start intents in a test browser',
     'Simulate Twilio accepting effect but dropping HTTP response; refresh to reconcile'],
    ['UI reports uncertain or existing call instead of offering unbounded retry'],
    ['One idempotent provider effect; no blind redispatch of unknown external result'],[tests.outbound,tests.control]),
  define('S07','Inbound: idle rep receives and answers','inbound',true,
    ['Enabled test DID, signed tenant, healthy browser media and rep explicitly Ready'],
    ['Call test DID from approved outside test phone',
     'Accept once in browser, verify both speakers, hang up and finish wrap-up'],
    ['One inbound offer rings; browser acceptance followed by real media connection'],
    ['One owner, no duplicate bridge, capacity released only after authoritative completion'],[tests.inbound,tests.operator]),
  define('S08','Inbound while tab is backgrounded or muted','inbound',true,
    ['Ready test rep with controlled audio/Notification permissions, active native CRM tab'],
    ['Send approved inbound call with browser in background',
     'Observe notification, ringtone and foreground return; separately deny permission'],
    ['Truthful alert health and accessible fallback; never promise blocked OS notification'],
    ['Only eligible current offer rings; accepting notification never creates second Voice bridge'],[tests.voice,tests.operator]),
  define('S09','Inbound decline, expiry and caller abandonment','inbound',true,
    ['Test DID, known max-offer/reoffer settings; two consenting test devices'],
    ['Decline one offer; allow another to expire; for separate attempt hang up while queued',
     'Inspect queue, agent capacity and any policy-selected fallback'],
    ['No stale re-ring and no late accepted call after customer departure'],
    ['Fenced generations, terminal cleanup and bounded offer attempts'],[tests.inbound,tests.routing]),
  define('S10','Inbound arrives during outbound dialing or talking','concurrency',true,
    ['Test rep owns outbound call; independent consented caller and DID'],
    ['While outbound dialing and separately connected, place inbound call',
     'Observe available rep pool, exclusion/overflow and post-call wrap-up state'],
    ['Busy rep not double-connected; inbound caller follows team/fallback policy'],
    ['One active capacity owner per rep; no inbound/outbound ownership race'],[tests.capacity,tests.inbound]),
  define('S11','Two reps and two tabs compete for a single offer','concurrency',true,
    ['Two authorized test reps/devices; one test inbound DID; same live offer'],
    ['Have both reps attempt acceptance nearly simultaneously',
     'Reload one tab mid-offer; inspect who won and loser messaging'],
    ['One acceptance succeeds, loser sees stale/answered status'],
    ['One generation-fenced owner; losing device never starts another bridge'],[tests.capacity,tests.operator]),
  define('S12','Shared caller ID and parallel queue contention','concurrency',false,
    ['Synthetic two-rep workspace with one shared caller ID and isolated Redis'],
    ['Start overlapping requests in deterministic fixture',
     'Terminate winner, duplicate end callback and inspect lock ownership'],
    ['Caller ID protected while active, available after proven release'],
    ['Exact caller-id-lock:* keys have owner/expiry; no force release of unknown active calls'],[tests.parallel,tests.capacity]),
  define('S13','Session token expiry and CRM route navigation mid-call','recovery',true,
    ['Active consented test call and short-lived signed iframe session; no full CRM logout'],
    ['Navigate Contacts to Opportunities and back, let signed embed token expire',
     'Request safe session renewal; inspect connected call before and after'],
    ['Real call stays connected without duplicate dial; new session authenticates correctly'],
    ['Single media owner; never accept untrusted parent origin or expose tokens'],[tests.renew,tests.landing]),
  define('S14','Tab reload, lost network, laptop sleep/wake','recovery',true,
    ['Connected authorized test call; defined recovery window and diagnostic trace'],
    ['Reload during ringing and connected state in separate calls',
     'Disable network briefly or sleep/wake; restore and reconcile authoritative state'],
    ['Truthful reconnect/failure state; no invented reconnected audio or phantom call'],
    ['Never initiate new provider call based only on missing browser state'],[tests.control,tests.voice]),
  define('S15','Process, Redis or Postgres outage during pending effect','recovery',false,
    ['Isolated local lab only, disposable Postgres/Redis; no production restarts'],
    ['Inject crash before/after provider dispatch and journal commit',
     'Restart workers and reconcile pending/unknown effects'],
    ['Recovery resumes or reports uncertainty; no silent starvation'],
    ['Exactly-once externally visible effects; no orphaned capacity or blind retries'],[tests.recovery,tests.inbound],[], 'simulated-system'),
  define('S16','Duplicate, reversed and delayed provider webhooks','recovery',false,
    ['Synthetic signed-callback fixtures, clock and known session generation'],
    ['Replay ringing/answered/completed in reversed order and duplicate completion',
     'Interleave cancellation, reconciliation and worker callback processing'],
    ['Final authoritative state terminal; no regression from newer to older state'],
    ['Idempotent event journal; stale callbacks cannot steal capacity'],[tests.recovery,tests.outcomes],[], 'simulated-system'),
  define('S17','CRM contact removed or stale search result arrives late','crm',false,
    ['Intercepted CRM fixture with two locations and slow contact lookup'],
    ['Type phone, change target while old lookup in flight, resolve old response late',
     'Move/deactivate opportunity while queue being prepared'],
    ['No wrong-person selection; active batch frozen and next refresh uses current CRM state'],
    ['Location and contact identity validated; stale async response cannot override selection'],[tests.crm,tests.refresh]),
  define('S18','Calling windows, opt-outs, retries and local presence','outbound',false,
    ['Simulated timezone transitions, DNC/suppression and attempt limits in test tenant'],
    ['Offer blocked, out-of-hours, exhausted-retry contacts to queue',
     'Turn local presence on/off and vary owned caller IDs in fixture'],
    ['Excluded contacts never dial; caller-ID selection explicit and explainable'],
    ['No carrier effect on blocked lead; normalized attempt ledger and window constraints'],[tests.routing,tests.outbound]),
  define('S19','Call end: disposition, wrap-up, next batch and history','crm',true,
    ['Completed authorized test call with linked opportunity and queue'],
    ['Submit disposition and notes once; double-click save; choose next or return Home',
     'Refresh CRM and History without reloading entire CRM'],
    ['One operator-visible session, correct attempt history and next eligible batch'],
    ['Idempotent disposition; deal stage never inferred solely from call outcome'],[tests.workspace,tests.control]),
  define('S20','Commercial: payment retries, usage cap and entitlements','commercial',false,
    ['Stripe test-mode fixtures only; no live checkout or paid item mutations'],
    ['Replay success webhook and delayed/out-of-order invoice, cancel and upgrade',
     'Simulate depleted minute quota and unassigned seat during attempted call'],
    ['One paid entitlement grant, truthful denial and unchanged service on failure'],
    ['Paid-only generation fencing; billing/provider mutations at most once'],[tests.billing,tests.commerce]),
  define('S21','Install, rep seat, number and forwarding-device setup','commercial',false,
    ['Existing CRM test installation and mocked paid/trial inventory; no number purchase'],
    ['Reopen admin settings, choose eligible rep, inspect number and device',
     'Verify seat/number constraints, missing permission, edit while rep busy'],
    ['Human-readable choices; no raw provider ID; blocked changes explained'],
    ['Tenant/seat enforced server-side; uncertain active assignment not released'],[tests.numbers,tests.commerce]),
  define('S22','Cross-tenant, revoked session, webhook and iframe origin','security',false,
    ['Two isolated synthetic tenants, signed webhook fixtures and revoked access'],
    ['Swap tenant IDs, role, origin and token expiry; replay signed event twice',
     'Attempt to read other tenant number/call and write seat settings'],
    ['All untrusted reads/writes rejected without secret leakage'],
    ['Server tenant ownership; webhook replay idempotent'],[tests.security,tests.renew]),
  define('S23','Queue endurance with repeated batch and cleanup','predictive',false,
    ['Bounded synthetic lead pool, seeded clock, fake provider and isolated Redis'],
    ['Process repeated answered/busy/abandoned/unknown outcomes',
     'Change ready reps and simulate stop/resume/exhaustion'],
    ['Queue finishes or pauses deterministically; responsive stop with no blocked rep'],
    ['Fanout <= entitled lines; no orphan lock/leg; bounded pending effects'],[tests.parallel,tests.outbound]),
  define('S24','Coaching, transcription and recording boundaries','security',false,
    ['Synthetic connected state and consent/entitlement combinations; no actual audio'],
    ['Attempt manual script with AI disabled; revoke AI entitlement mid-simulation',
     'Try unauthorized transcript access and stop/cleanup'],
    ['Manual script not mislabeled AI; disabled features collect no unapproved media'],
    ['Explicit consent/entitlement; bounded retention; no raw media in QA evidence'],[tests.voice,tests.workspace]),
] as const;

export function resolveScenarioSelection(selection: string): LaunchScenario[] {
  const value = selection.trim();
  if (value === 'all') return [...launchScenarios];
  if (!value) throw new Error('Provide scenario IDs (e.g. S01,S04) or all');
  const requested = value.split(',').map((id) => id.trim().toUpperCase());
  const seen = new Set<string>();
  for (const id of requested) {
    if (seen.has(id)) throw new Error('Duplicate scenario: ' + id);
    seen.add(id);
    if (!launchScenarios.some((scenario) => scenario.id === id)) {
      throw new Error('Unknown scenario: ' + id);
    }
  }
  return launchScenarios.filter((scenario) => seen.has(scenario.id));
}

const secretField = /(^|[_-])(authorization|password|passwd|passphrase|cookie|secret|access.?token|refresh.?token|api.?key|private.?key|client.?secret|credential|session.?token|raw.?audio)($|[_-])/i;
const secretAsCamel = /(authorization|password|cookie|secret|accessToken|refreshToken|apiKey|privateKey|clientSecret|credential|sessionToken|rawAudio)/i;

export function sanitizeDiagnosticValue(value: unknown, key = ''): unknown {
  if (secretField.test(key) || secretAsCamel.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeDiagnosticValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, sanitizeDiagnosticValue(item, name)]),
    );
  }
  if (typeof value !== 'string') return value;
  return value
    .replace(/\b(?:AC|CA|CF|PN|RE|MM|SM|CH|AP)[a-f0-9]{32}\b/gi, '[REDACTED SID]')
    .replace(/Bearer\s+[^\s"',;]+/gi, 'Bearer [REDACTED]')
    .replace(/\+\d[\d\s().-]{7,20}\d\b/g, '[REDACTED PHONE]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[REDACTED EMAIL]')
    .replace(/([?&][\w.-]+=)[^&\s#]+/g, '$1[REDACTED]')
    .replace(/\b(?:password|token|api[_-]?key|secret)\s*[:=]\s*[^\s&,;]+/gi, '[REDACTED]');
}

export interface LiveCallScope {
  scenarioId: string; source: string; destination: string; fanout: number;
  approvalRef: string; recording: boolean; transcription: boolean; maxInitiations: number;
  recordingConsentRef?: string; transcriptionConsentRef?: string;
}

/** Structural gate only. This neither authorizes nor performs a call. */
export function validateLiveCallScope(scope: LiveCallScope): LiveCallScope {
  const scenario = resolveScenarioSelection(scope.scenarioId)[0];
  if (!scenario.requiresCarrier) throw new Error('Scenario does not require a live carrier call');
  if (!/^\+[1-9]\d{7,14}$/.test(scope.source) || !/^\+[1-9]\d{7,14}$/.test(scope.destination)) {
    throw new Error('Source and destination must be exact E.164 phone numbers');
  }
  if (!Number.isInteger(scope.fanout) || scope.fanout < 1 || scope.fanout > 3) {
    throw new Error('Live fanout must be one, two or three');
  }
  if (scope.maxInitiations !== 1) throw new Error('Each approval permits exactly one initiation');
  if (!scope.approvalRef.trim()) throw new Error('Specific one-shot approval is required');
  if (scope.recording && !scope.recordingConsentRef?.trim()) {
    throw new Error('Recording requires separate consent and approval');
  }
  if (scope.transcription && !scope.transcriptionConsentRef?.trim()) {
    throw new Error('Transcription requires separate consent and approval');
  }
  return scope;
}

export interface LaunchEvidence {
  scenarioId: string; lane: EvidenceLane; outcome: EvidenceOutcome;
  liveStatus: 'not-tested' | 'unverified'; timestamp: string; runId: string;
  observation: string; observer?: string; seed?: number; testExitCode?: number;
  diagnostics?: unknown;
}

export function createLaunchEvidence(input: {
  scenarioId: string; lane: EvidenceLane; outcome: EvidenceOutcome; observation: string;
  observer?: string; seed?: number; testExitCode?: number;
  diagnostics?: unknown; runId?: string; timestamp?: string;
}): LaunchEvidence {
  resolveScenarioSelection(input.scenarioId);
  if (!input.observation.trim()) throw new Error('An observed result is required');
  if (input.lane === 'automated') {
    if (input.testExitCode === undefined || !Number.isInteger(input.testExitCode)) {
      throw new Error('An automated outcome requires a test exit code');
    }
    if (input.outcome === 'passed' && input.testExitCode !== 0) {
      throw new Error('Automated pass requires a zero test exit code');
    }
    if (input.outcome === 'failed' && input.testExitCode === 0) {
      throw new Error('Automated failure requires a nonzero test exit code');
    }
  } else if (!input.observer?.trim()) {
    throw new Error('Manual evidence requires an observer');
  }
  return {
    scenarioId: input.scenarioId, lane: input.lane, outcome: input.outcome,
    liveStatus: input.lane === 'automated' ? 'not-tested' : 'unverified',
    timestamp: input.timestamp ?? new Date().toISOString(),
    runId: input.runId ?? crypto.randomUUID(),
    observation: String(sanitizeDiagnosticValue(input.observation)),
    ...(input.observer ? { observer: String(sanitizeDiagnosticValue(input.observer)) } : {}),
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    ...(input.testExitCode !== undefined ? { testExitCode: input.testExitCode } : {}),
    ...(input.diagnostics !== undefined ? { diagnostics: sanitizeDiagnosticValue(input.diagnostics) } : {}),
  };
}

export function formatLaunchReport(records: readonly LaunchEvidence[]): string {
  const lines = [
    '# Consuelo Dialer acceptance campaign', '',
    'Automated component tests do not certify actual PSTN delivery, two-way audio or live billing.',
    'Manual observations are unverified until corroborated by carrier, server and cleanup diagnostics.',
    '', '| ID | Scenario | Automated | Human / live |',
    '| --- | --- | --- | --- |',
  ];
  for (const scenario of launchScenarios) {
    const relevant = records.filter((r) => r.scenarioId === scenario.id);
    const automated = relevant.filter((r) => r.lane === 'automated').at(-1);
    const manual = relevant.filter((r) => r.lane === 'manual').at(-1);
    const summary = (record: LaunchEvidence | undefined) =>
      record ? record.outcome + ' (' + record.timestamp.slice(0, 10) + ')' : 'Not yet executed';
    lines.push('| ' + scenario.id + ' | ' + scenario.title + ' | ' + summary(automated) + ' | ' + summary(manual) + ' |');
  }
  return lines.join('\n') + '\n';
}
