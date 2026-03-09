// pi-agent-core extensions — tools, context injection, session management

export { DatabaseSessionManager } from './database-session-manager.js';
export type {
  AgentSessionData,
  DatabaseConnection,
  SessionManager,
} from './database-session-manager.js';

export { createPiCrmTools } from './crm-tools.js';
export { createContextInjection } from './context-injection.js';
export { createDialerTools } from './dialer-tools.js';
export type { DialerService } from './dialer-tools.js';
export { createKbTools } from './kb-tools.js';
export type { KbService } from './kb-tools.js';
