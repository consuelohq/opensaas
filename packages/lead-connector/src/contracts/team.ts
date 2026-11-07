import type { LeadConnectorTeamMember } from './index.js';
export type DialerTeamView = {
  revision: number;
  directoryVersion: string;
  paidSeats: number;
  assignedSeats: number;
  plan: string | null;
  members: Array<
    LeadConnectorTeamMember & {
      assigned: boolean;
      queueIds: string[];
      capacityState: string;
      starter: boolean;
    }
  >;
  queues: Array<{ id: string; name: string }>;
};
export type DialerTeamChange = {
  revision: number;
  directoryVersion: string;
  userId: string;
  enabled: boolean;
  queueIds: string[];
};
