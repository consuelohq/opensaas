/**
 * Public, deterministic simulation of the production GHL calling workspace.
 *
 * Deliberately imports ONLY the pure production renderer and reducer.
 * Does not instantiate the authenticated controller, browser voice SDK,
 * GHL client, Twilio, or any network transport.
 */
import {
  createInitialEmbedState,
  reduceEmbedState,
  type EmbedCallSession,
  type EmbedAdminCall,
  type LeadConnectorEmbedState,
} from '../../../../lead-connector/src/embed/state-machine.ts';
import { renderLeadConnectorEmbed } from '../../../../lead-connector/src/embed/view.ts';
import {
  createCallingWorkspace,
  type CallingWorkspace,
} from '../../../../lead-connector/src/embed/calling-workspace.ts';
import {
  normalizeClickToCallTarget,
  type LeadConnectorClickToCallTarget,
} from '../../../../lead-connector/src/embed/protocol.ts';
import { targetChoices } from '../../../../lead-connector/src/embed/target-picker.ts';

type DemoFlow = 'outbound' | 'inbound' | 'mercury';
type DemoState = { flow: DemoFlow; stage: string; label: string };
const CONTACT_SEEDS = [
  { id: 'demo-avery', firstName: 'Avery', lastName: 'Morgan', name: 'Avery Morgan', phone: '+12025550101', email: 'avery@example.test' },
  { id: 'demo-riley', firstName: 'Riley', lastName: 'Chen', name: 'Riley Chen', phone: '+12025550102', email: 'riley@example.test' },
  { id: 'demo-jordan', firstName: 'Jordan', lastName: 'Blake', name: 'Jordan Blake', phone: '+12025550103', email: 'jordan@example.test' },
  { id: 'demo-casey', firstName: 'Casey', lastName: 'Ellis', name: 'Casey Ellis', phone: '+12025550104', email: 'casey@example.test' },
  { id: 'demo-alex', firstName: 'Alex', lastName: 'Rivera', name: 'Alex Rivera', phone: '+12025550105', email: 'alex@example.test' },
] as const;
const CONTACTS = CONTACT_SEEDS as unknown as LeadConnectorEmbedState['contacts'];
const TARGETS = CONTACT_SEEDS.slice(0, 3).map((contact) =>
  normalizeClickToCallTarget({ contactId: contact.id, name: contact.name, phone: contact.phone }),
).filter((target): target is NonNullable<typeof target> => target !== null);
const QUEUE: NonNullable<LeadConnectorEmbedState['selectedQueue']> = {
  pipelineId: 'demo-pipeline',
  pipelineName: 'Insurance pipeline',
  stageId: 'demo-stage',
  stageName: 'New inquiries',
  opportunityTotal: 18,
  callableTotal: 13,
};
const SCRIPT = {
  id: 'demo-script',
  title: 'First conversation',
  content: 'Hi Avery, this is Alex calling from Northstar Insurance. Is now a good time?\nWhat coverage are you currently considering?\nThat helps. Let me walk you through your options and find a time to follow up.',
  revision: 1,
  updatedAt: '2026-11-08T09:00:00.000Z',
  canEdit: false,
};
const PRIOR_HISTORY: EmbedAdminCall = {
  id: 'demo-history-prior',
  contactId: 'demo-alex',
  contactName: 'Alex Rivera',
  representative: 'demo-rep',
  status: 'completed',
  disposition: 'follow-up',
  note: 'Requested a policy comparison.',
  durationSeconds: 84,
  startedAt: '2026-11-07T14:30:00.000Z',
  crmSyncStatus: 'synced',
  calls: [],
};

export const createSyntheticDialerState = (): LeadConnectorEmbedState => {
  let state = createInitialEmbedState();
  state = reduceEmbedState(state, {
    type: 'AUTHENTICATED',
    token: 'simulation-not-a-real-auth-token',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
  state = reduceEmbedState(state, {
    type: 'RESOURCES_LOADED',
    contacts: CONTACTS,
    contactTotal: CONTACTS.length,
    opportunities: [],
    opportunityTotal: 18,
    pipelines: [{
      id: QUEUE.pipelineId,
      name: QUEUE.pipelineName,
      stages: [{ id: QUEUE.stageId, name: QUEUE.stageName }],
    }] as LeadConnectorEmbedState['pipelines'],
  });
  state = reduceEmbedState(state, {
    type: 'COMMERCIAL_CALLER_LOADED',
    caller: {
      planCode: 'standard',
      trial: false,
      callerIds: ['+12025550111'],
      connectedMinutes: 120,
      remainingMinutes: 680,
      lineOptions: [1, 2, 3],
      predictive: true,
      recordings: false,
      transcripts: false,
      canStartCall: true,
      denialCode: null,
      billing: { state: 'active', graceEndsAt: null },
    },
  });
  state = reduceEmbedState(state, { type: 'SETUP_CHANGED', setup: { requestedFanout: 3, mode: 'queue', callingMode: 'predictive' } });
  state = reduceEmbedState(state, { type: 'QUEUE_SELECTED', queue: QUEUE, targets: TARGETS });
  const baseInbound = state.inboundOperator;
  return {
    ...state,
    callHistory: [PRIOR_HISTORY],
    callerIds: ['+12025550111'],
    inboundOperator: {
      ...baseInbound,
      phase: 'ready',
      lastSyncAt: '2026-11-08T09:00:00.000Z',
      rep: {
        ...baseInbound.rep,
        repId: 'demo-rep',
        ready: false,
        presence: 'online',
        endpoints: [{ endpointId: 'demo-browser', kind: 'browser', healthy: true, active: true, label: 'Web browser' }],
      },
      queue: {
        ...baseInbound.queue,
        queueId: 'demo-inbound',
        queueName: 'New inquiries',
        waitingCount: 0,
        oldestWaitSeconds: 0,
        serviceableCount: 1,
        businessHours: 'open',
        overflow: 'callback',
      },
      configuration: {
        numberLabel: 'Main sales line',
        maskedNumber: '••• ••• 0110',
        teamName: 'Northstar Insurance',
        hoursLabel: 'Monday–Friday, 9–5',
        overflowLabel: 'Callback',
      },
    },
  };
};

const session = (
  status: string,
  targets: LeadConnectorClickToCallTarget[],
  withWinner = false,
): EmbedCallSession => ({
  groupId: 'SIMULATED-GROUP-1',
  status,
  winnerSid: withWinner ? 'SIMULATED-LEG-1' : null,
  winner: withWinner ? { callSid: 'SIMULATED-LEG-1', contactId: targets[0]?.contactId } : null,
  calls: targets.map((target, position) => ({
    callSid: 'SIMULATED-LEG-' + (position + 1),
    customerNumber: target.phone,
    contactId: target.contactId ?? undefined,
    position,
    status: withWinner ? (position === 0 ? 'in-progress' : 'canceled') : status,
  })),
});

export const mountDialerSimulation = (document: Document): void => {
  const app = document.querySelector<HTMLElement>('[data-demo-dialer]');
  if (!app) return;
  const host = document.defaultView;
  if (!host) return;

  let state = createSyntheticDialerState();
  let workspace: CallingWorkspace = createCallingWorkspace('overlay');
  workspace = {
    ...workspace,
    mode: 'outbound',
    screen: 'calling',
    nativeFloating: false,
    coachingLibrary: { scripts: [SCRIPT] },
    coachingMode: 'script',
    activeScriptId: SCRIPT.id,
    scriptStep: 0,
  };
  let flow: DemoFlow = 'outbound';
  let timerIds: number[] = [];
  let toastId = 0;
  let completed = 0;

  const clearTimers = () => {
    timerIds.forEach((id) => host.clearTimeout(id));
    timerIds = [];
  };
  const later = (fn: () => void, delay: number) => {
    timerIds.push(host.setTimeout(fn, delay));
  };
  const notify = (stage: string, label: string) => {
    const data: DemoState = { flow, stage, label };
    if (host.parent !== host) host.parent.postMessage({ channel: 'consuelo-demo-v1', ...data }, host.location.origin);
  };
  const toast = (message: string) => {
    const el = document.querySelector<HTMLElement>('[data-demo-toast]');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    const ticket = ++toastId;
    later(() => { if (ticket === toastId) el.hidden = true; }, 3500);
  };
  const render = () => {
    app.innerHTML = renderLeadConnectorEmbed(state, { surface: 'overlay', workspace });
  };
  const setFlow = (next: DemoFlow) => {
    clearTimers();
    completed = 0;
    ++toastId;
    const crmCard = document.querySelector<HTMLElement>('[data-demo-crm-card]');
    const cardName = crmCard?.querySelector('strong');
    if (cardName) cardName.textContent = 'Alex Rivera';
    const count = document.querySelector<HTMLElement>('[data-demo-contacted-count]');
    if (count) count.textContent = '7';
    const status = document.querySelector<HTMLElement>('[data-demo-crm-outcome]');
    if (status) status.textContent = 'Call logged';
    const notice = document.querySelector<HTMLElement>('[data-demo-toast]');
    if (notice) {
      notice.hidden = true;
      notice.textContent = '';
    }
    document.documentElement.dataset.theme = 'light';
    flow = next;
    state = createSyntheticDialerState();
    workspace = {
      ...createCallingWorkspace('overlay'),
      screen: next === 'mercury' ? 'mercury' : 'calling',
      nativeFloating: false,
      mode: next === 'inbound' ? 'inbound' : 'outbound',
      coachingLibrary: { scripts: [SCRIPT] },
      coachingMode: 'script',
      activeScriptId: SCRIPT.id,
      scriptStep: 0,
    };
    render();
    notify('ready', next === 'inbound' ? 'Choose where inbound calls ring.' : next === 'mercury' ? 'Browse the real Mercury script workspace.' : 'Choose a list and start calling.');
  };

  const updateCrm = (contactName: string, outcome: string) => {
    const card = document.querySelector<HTMLElement>('[data-demo-crm-card]');
    const count = document.querySelector<HTMLElement>('[data-demo-contacted-count]');
    if (card) {
      const name = card.querySelector('strong');
      if (name) name.textContent = contactName;
    }
    const status = document.querySelector<HTMLElement>('[data-demo-crm-outcome]');
    if (status) status.textContent = outcome + ' · saved in demo';
    if (count) count.textContent = String(7 + completed);
  };
  const appendCall = (contactId: string, name: string, outcome: string, note = '') => {
    completed++;
    const call: EmbedAdminCall = {
      id: 'demo-call-' + completed,
      contactId,
      contactName: name,
      representative: 'demo-rep',
      status: 'completed',
      disposition: outcome,
      durationSeconds: 72,
      startedAt: '2026-11-08T09:34:00.000Z',
      crmSyncStatus: 'synced',
      note: note.slice(0, 500),
      calls: [],
    };
    state = { ...state, callHistory: [call, ...state.callHistory] };
    updateCrm(name, outcome);
    toast('Outcome saved to the simulated CRM');
    notify('saved', 'The outcome and note appear in call history.');
  };

  const beginOutbound = () => {
    if (state.phase !== 'ready' && state.phase !== 'target-selected') return;
    clearTimers();
    const lineCount = state.setup.callingMode === 'single'
      ? 1
      : Math.min(state.setup.requestedFanout, state.selectedTargets.length);
    const selected = state.selectedTargets.slice(0, lineCount);
    state = { ...state, selectedTargets: selected };
    state = reduceEmbedState(state, { type: 'START_REQUESTED', strategy: state.setup.callingMode === 'predictive' ? 'predictive' : 'single' });
    render();
    notify('dialing', lineCount + (lineCount === 1 ? ' line is' : ' lines are') + ' being prepared. Watch for a live answer.');
    later(() => {
      if (state.phase !== 'starting') return;
      state = reduceEmbedState(state, { type: 'SESSION_UPDATED', session: session('dialing', selected) });
      render();
      notify('dialing', 'Multiple prospects are ringing at once.');
    }, 650);
    later(() => {
      if (!['starting', 'dialing', 'ringing'].includes(state.phase)) return;
      state = reduceEmbedState(state, { type: 'SESSION_UPDATED', session: session('connected', selected, true) });
      render();
      notify('connected', (selected[0]?.name ?? 'The prospect') + ' answers. Other simulated lines end automatically.');
    }, 2300);
  };

  const hangUpOutbound = () => {
    if (state.phase !== 'connected') return;
    clearTimers();
    state = reduceEmbedState(state, { type: 'SESSION_UPDATED', session: session('completed', state.selectedTargets, true) });
    render();
    notify('wrap-up', 'Choose the outcome and write a follow-up note.');
  };

  const makeInboundOffer = () => {
    if (!state.inboundOperator.rep.ready || flow !== 'inbound') return;
    state = {
      ...state,
      inboundOperator: {
        ...state.inboundOperator,
        offers: [{
          assignmentId: 'demo-inbound-offer',
          requestId: 'demo-request',
          generation: 1,
          queueId: 'demo-inbound',
          queueName: 'New inquiries',
          callerLabel: 'Jordan Blake',
          waitingSeconds: 4,
          offerExpiresAt: '2099-01-01T00:00:00.000Z',
          ownerRepId: 'demo-rep',
          eligibleEndpoints: ['demo-browser'],
        }],
        queue: { ...state.inboundOperator.queue, waitingCount: 1, oldestWaitSeconds: 4 },
      },
    };
    render();
    notify('offering', 'A new inbound call is routed to your browser.');
  };
  const answerInbound = () => {
    const incoming = state.inboundOperator.offers[0];
    if (!incoming) return;
    const assignment = {
      assignmentId: incoming.assignmentId,
      requestId: incoming.requestId,
      generation: incoming.generation,
      phase: 'connected' as const,
      offerExpiresAt: null,
      endpointId: 'demo-browser',
      externalStarted: true,
      connectedAt: '2026-11-08T09:32:00.000Z',
      unknownSince: null,
      wrapUpUntil: null,
    };
    state = {
      ...state,
      inboundOperator: {
        ...state.inboundOperator,
        rep: { ...state.inboundOperator.rep, assignment },
        offers: [],
        queue: { ...state.inboundOperator.queue, waitingCount: 0, oldestWaitSeconds: 0 },
      },
    };
    render();
    notify('connected', 'The call is connected in your browser. Work from your script.');
  };

  app.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (anchor) {
      event.preventDefault();
      toast('The demo runs offline. Use Get started on the page to try the real product.');
      return;
    }
    const option = target.closest<HTMLButtonElement>('.combobox__option');
    if (option) {
      const field = option.closest<HTMLElement>('[data-combobox-field]')?.dataset.comboboxField ?? '';
      const value = option.dataset.comboboxValue ?? '';
      if (field === 'queue') {
        state = reduceEmbedState(state, { type: 'QUEUE_SELECTED', queue: QUEUE, targets: TARGETS });
        notify('ready', 'Insurance pipeline, New inquiries selected.');
      } else if (field === 'line-count') {
        const requestedFanout = Math.max(1, Math.min(3, Number(value))) as 1 | 2 | 3;
        state = reduceEmbedState(state, { type: 'SETUP_CHANGED', setup: { requestedFanout } });
      } else if (field === 'calling-mode') {
        state = reduceEmbedState(state, { type: 'SETUP_CHANGED', setup: { callingMode: value === 'single' ? 'single' : 'predictive' } });
      } else if (field === 'caller-id') {
        state = reduceEmbedState(state, { type: 'SETUP_CHANGED', setup: { callerIdNumber: value || null } });
      }
      render();
      return;
    }
    const trigger = target.closest<HTMLButtonElement>('.combobox__trigger');
    if (trigger) {
      const dropdown = trigger.parentElement?.querySelector<HTMLElement>('.combobox__listbox');
      if (dropdown) {
        dropdown.hidden = !dropdown.hidden;
        trigger.setAttribute('aria-expanded', String(!dropdown.hidden));
        if (!dropdown.hidden) dropdown.querySelector<HTMLButtonElement>('button')?.focus();
      }
      return;
    }
    const button = target.closest<HTMLButtonElement>('[data-action]');
    if (!button) return;
    if (button.disabled) return;
    const action = button.dataset.action || '';
    switch (action) {
      case 'setup-queue':
        state = reduceEmbedState(state, { type: 'SETUP_CHANGED', setup: { mode: 'queue', callingMode: 'predictive', requestedFanout: 3 } });
        state = reduceEmbedState(state, { type: 'QUEUE_SELECTED', queue: QUEUE, targets: TARGETS });
        break;
      case 'setup-single':
        state = reduceEmbedState(state, { type: 'SETUP_CHANGED', setup: { mode: 'single' } });
        state = { ...state, phase: 'target-selected', selectedTargets: TARGETS.slice(0, 1) };
        break;
      case 'choose-target': {
        const index = Number(button.dataset.choiceIndex ?? 0);
        const picked = targetChoices(state.contacts, workspace.contactQuery ?? '')[index];
        if (picked) {
          state = { ...state, selectedTargets: [picked], phase: 'target-selected' };
          workspace = { ...workspace, contactPickerOpen: false, contactQuery: '' };
        }
        break;
      }
      case 'workspace-inbound': setFlow('inbound'); return;
      case 'workspace-outbound': setFlow('outbound'); return;
      case 'start-configured': beginOutbound(); return;
      case 'stop':
        clearTimers();
        state = reduceEmbedState(state, { type: 'STOP_REQUESTED' });
        notify('wrap-up', 'Calls stopped. No real calls were made.');
        break;
      case 'hang-up': hangUpOutbound(); return;
      case 'return-home':
        state = reduceEmbedState(state, { type: 'RETURN_HOME' });
        notify('ready', 'You can dial another list or browse call history.');
        break;
      case 'workspace-call-options': workspace = { ...workspace, screen: 'call-options' }; break;
      case 'workspace-queue-details': workspace = { ...workspace, screen: 'queue-details' }; break;
      case 'workspace-calling': workspace = { ...workspace, screen: 'calling' }; break;
      case 'workspace-settings': workspace = { ...workspace, screen: 'settings' }; break;
      case 'workspace-history': workspace = { ...workspace, screen: 'history' }; break;
      case 'workspace-mercury': workspace = { ...workspace, screen: 'mercury' }; break;
      case 'workspace-numbers': workspace = { ...workspace, screen: 'numbers', numberTab: 'receive' }; break;
      case 'numbers-receive': workspace = { ...workspace, numberTab: 'receive' }; break;
      case 'numbers-call-from': workspace = { ...workspace, numberTab: 'call-from' }; break;
      case 'workspace-appearance': workspace = { ...workspace, screen: 'appearance' }; break;
      case 'workspace-theme': {
        const choice = button.dataset.themeValue;
        if (choice !== 'system' && choice !== 'light' && choice !== 'dark') return;
        workspace = { ...workspace, theme: choice };
        document.documentElement.dataset.theme = choice === 'dark' ? 'dark' : 'light';
        break;
      }
      case 'workspace-minimize':
      case 'workspace-expand':
        toast('The live calling window can minimize over your CRM.');
        return;
      case 'inbound-readiness': {
        const ready = button.dataset.ready === 'true';
        clearTimers();
        state = {
          ...state,
          inboundOperator: {
            ...state.inboundOperator,
            rep: { ...state.inboundOperator.rep, ready, presence: ready ? 'online' : 'offline' },
            offers: [],
          },
        };
        if (ready) {
          notify('available', 'You are receiving calls in your browser.');
          later(makeInboundOffer, 1200);
        } else notify('ready', 'Incoming call receiving stopped.');
        break;
      }
      case 'inbound-accept': answerInbound(); return;
      case 'inbound-decline':
        state = {
          ...state,
          inboundOperator: { ...state.inboundOperator, offers: [], queue: { ...state.inboundOperator.queue, waitingCount: 0 } },
        };
        notify('available', 'The offer was declined. Your queue remains available.');
        break;
      case 'inbound-hang-up': {
        const assignment = state.inboundOperator.rep.assignment;
        if (assignment) {
          state = {
            ...state,
            inboundOperator: {
              ...state.inboundOperator,
              rep: { ...state.inboundOperator.rep, assignment: { ...assignment, phase: 'wrap_up' } },
            },
          };
        }
        notify('wrap-up', 'Record the inbound call outcome before receiving again.');
        break;
      }
      case 'script-next': workspace = { ...workspace, scriptStep: (workspace.scriptStep ?? 0) + 1 }; break;
      case 'script-previous': workspace = { ...workspace, scriptStep: Math.max(0, (workspace.scriptStep ?? 0) - 1) }; break;
      case 'script-open': workspace = { ...workspace, scriptId: button.dataset.scriptId }; break;
      case 'script-cancel': workspace = { ...workspace, scriptId: undefined, scriptDraft: undefined }; break;
      case 'coaching-mode': workspace = { ...workspace, coachingMode: button.dataset.mode === 'script' ? 'script' : 'off' }; break;
      case 'select-call': {
        const c = state.callHistory.find((call) => call.id === button.dataset.callId);
        if (c) {
          state = { ...state, selectedCallDetail: c, selectedCallTranscript: [] };
          workspace = { ...workspace, screen: 'call-detail' };
        }
        break;
      }
      case 'workspace-billing':
      case 'manage-billing':
      case 'workspace-team':
      case 'script-new':
      case 'script-edit':
        toast('This setup action is disabled in the simulated demo.');
        return;
      default:
        toast('This control needs a connected GoHighLevel account and is not available in the offline demo.');
        return;
    }
    render();
  });

  app.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.dataset.field !== 'target-query') return;
    workspace = { ...workspace, contactQuery: input.value, contactPickerOpen: true, contactActiveIndex: 0 };
    const index = input.selectionStart ?? input.value.length;
    render();
    const next = app.querySelector<HTMLInputElement>('[data-field="target-query"]');
    next?.focus();
    next?.setSelectionRange(index, index);
  });

  app.addEventListener('change', (event) => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) return;
    if (element.dataset.field === 'local-presence' && element instanceof HTMLInputElement) {
      state = reduceEmbedState(state, { type: 'SETUP_CHANGED', setup: { preferLocalPresence: element.checked } });
      render();
    } else if (element.dataset.field === 'active-script') {
      workspace = { ...workspace, activeScriptId: element.value || undefined, scriptStep: 0 };
      render();
    } else if (element.dataset.field === 'inbound-endpoint') {
      workspace = { ...workspace, answeringEndpointIds: ['demo-browser'] };
      render();
    }
  });

  app.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    const data = new FormData(form);
    const disposition = String(data.get('disposition') || 'connected');
    const note = String(data.get('note') || '');
    if (form.dataset.form === 'transfer') {
      toast('Transferring a call requires a real connection. Transfers are disabled in this simulated demo.');
      return;
    }
    if (form.dataset.form === 'disposition' && state.phase === 'wrapping-up') {
      const winner = state.selectedTargets[0];
      appendCall(winner?.contactId ?? 'demo-avery', winner?.name ?? 'Avery Morgan', disposition, note);
      state = reduceEmbedState(state, { type: 'DISPOSITION_SUBMITTED' });
      workspace = { ...workspace, screen: 'history' };
      render();
    } else if (form.dataset.form === 'inbound-wrap-up') {
      appendCall('demo-jordan', 'Jordan Blake', disposition, note);
      state = {
        ...state,
        inboundOperator: {
          ...state.inboundOperator,
          rep: { ...state.inboundOperator.rep, assignment: null },
        },
      };
      workspace = { ...workspace, screen: 'history' };
      render();
    }
  });

  host.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== host.location.origin || event.source !== host.parent) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || message.channel !== 'consuelo-demo-control') return;
    if (message.action === 'reset') setFlow(flow);
    else if (message.action === 'flow' && ['outbound', 'inbound', 'mercury'].includes(message.flow)) setFlow(message.flow as DemoFlow);
  });

  host.addEventListener('pagehide', clearTimers);
  render();
  notify('ready', 'Choose a list and start calling.');
};
