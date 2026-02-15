import { useState } from 'react';
import styled from '@emotion/styled';
import { Section } from '@/ui/layout/section/components/Section';
import { H2Title } from 'twenty-ui/display';
import { Button, TextInput } from 'twenty-ui/input';
import type { TeamMember, TeamRole, UsageMetric } from '@/settings/types/workspace';
import { ROLE_DESCRIPTIONS } from '@/settings/types/workspace';

const StyledSeatBar = styled.div`
  height: 8px;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 4px;
  overflow: hidden;
`;

const StyledSeatFill = styled.div<{ percent: number }>`
  height: 100%;
  width: ${({ percent }) => percent}%;
  background: ${({ theme }) => theme.color.blue};
  border-radius: 4px;
`;

const StyledSeatLabel = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledInviteRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  align-items: flex-end;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledTh = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledTd = styled.td`
  padding: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledBadge = styled.span<{ status: string }>`
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  background: ${({ status, theme }) =>
    status === 'active' ? theme.color.green + '20' :
    status === 'pending' ? theme.color.yellow + '20' : theme.color.red + '20'};
  color: ${({ status, theme }) =>
    status === 'active' ? theme.color.green :
    status === 'pending' ? theme.color.yellow : theme.color.red};
`;

const StyledRoleInfo = styled.div`
  margin-top: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledRoleRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledRoleName = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  min-width: 60px;
`;

type Props = {
  team: TeamMember[];
  seats: UsageMetric;
  onInvite: (email: string, role: TeamRole) => Promise<void>;
  onUpdateRole: (memberId: string, role: TeamRole) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
};

const ROLES: TeamRole[] = ['owner', 'admin', 'member', 'viewer'];

export const TeamTab = ({ team, seats, onInvite, onUpdateRole, onRemove }: Props) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [inviting, setInviting] = useState(false);

  const seatPercent = seats.limit > 0 ? (seats.used / seats.limit) * 100 : 0;

  const handleInvite = async () => {
    if (!email.trim()) return;
    try {
      setInviting(true);
      await onInvite(email.trim(), role);
      setEmail('');
    } catch {
      // api error
    } finally {
      setInviting(false);
    }
  };

  return (
    <>
      <Section>
        <H2Title title="Seats" description={`${seats.used} of ${seats.limit} seats used`} />
        <StyledSeatLabel>{seats.used} / {seats.limit}</StyledSeatLabel>
        <StyledSeatBar>
          <StyledSeatFill percent={Math.min(seatPercent, 100)} />
        </StyledSeatBar>
      </Section>
      <Section>
        <H2Title title="Invite member" description="Send an invitation by email" />
        <StyledInviteRow>
          <div style={{ flex: 1 }}>
            <TextInput
              value={email}
              onChange={setEmail}
              placeholder="colleague@company.com"
              fullWidth
            />
          </div>
          <StyledSelect value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </StyledSelect>
          <Button
            title={inviting ? 'Sending...' : 'Invite'}
            onClick={handleInvite}
            disabled={inviting || !email.trim()}
            variant="primary"
          />
        </StyledInviteRow>
      </Section>
      <Section>
        <H2Title title="Members" description="Manage team members and roles" />
        <StyledTable>
          <thead>
            <tr>
              <StyledTh>Name</StyledTh>
              <StyledTh>Email</StyledTh>
              <StyledTh>Role</StyledTh>
              <StyledTh>Status</StyledTh>
              <StyledTh />
            </tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id}>
                <StyledTd>{m.name}</StyledTd>
                <StyledTd>{m.email}</StyledTd>
                <StyledTd>
                  <StyledSelect
                    value={m.role}
                    onChange={(e) => onUpdateRole(m.id, e.target.value as TeamRole)}
                    disabled={m.role === 'owner'}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </StyledSelect>
                </StyledTd>
                <StyledTd>
                  <StyledBadge status={m.status}>{m.status}</StyledBadge>
                </StyledTd>
                <StyledTd>
                  {m.role !== 'owner' && (
                    <Button
                      title="Remove"
                      variant="secondary"
                      accent="danger"
                      onClick={() => onRemove(m.id)}
                    />
                  )}
                </StyledTd>
              </tr>
            ))}
          </tbody>
        </StyledTable>
      </Section>
      <Section>
        <H2Title title="Role descriptions" />
        <StyledRoleInfo>
          {Object.entries(ROLE_DESCRIPTIONS).map(([r, desc]) => (
            <StyledRoleRow key={r}>
              <StyledRoleName>{r}</StyledRoleName>
              <span>{desc}</span>
            </StyledRoleRow>
          ))}
        </StyledRoleInfo>
      </Section>
    </>
  );
};
