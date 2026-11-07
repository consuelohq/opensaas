import type { DialerTeamView } from '../contracts/team.js';

type TeamMember = Pick<
  DialerTeamView['members'][number],
  'starter' | 'canCall' | 'role'
>;

// The server rejects revoking an eligible Starter administrator, but
// deliberately permits an administrator to retire a Starter grant whose
// original CRM owner was removed, demoted, or lost calling permission.
export const isProtectedStarterOwner = (
  member: TeamMember | null | undefined,
): boolean => Boolean(
  member?.starter && member.role === 'admin' && member.canCall,
);

export const requestedTeamEnabled = (
  member: TeamMember | null | undefined,
  checked: boolean,
): boolean => isProtectedStarterOwner(member) || checked;
