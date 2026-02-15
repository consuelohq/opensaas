import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import {
  H2Title,
  IconCheck,
  IconLink,
  IconLinkOff,
  IconRefresh,
  IconX,
} from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { ghlConnectionState } from '@/settings/integrations/states/ghlConnectionState';

// -- types --

type ConnectionStatus = {
  connected: boolean;
  locationId?: string;
  locationName?: string;
  connectedAt?: string;
  lastSync?: string;
  syncedContacts?: number;
};

type SyncDirection = 'ghl-to-twenty' | 'twenty-to-ghl' | 'bidirectional';

type SyncConfig = {
  direction: SyncDirection;
  autoSyncMinutes: number;
};

type FieldMapping = {
  ghlField: string;
  twentyField: string;
  auto: boolean;
};

type SyncLogEntry = {
  timestamp: string;
  type: 'import' | 'sync' | 'webhook' | 'push';
  success: boolean;
  added: number;
  updated: number;
  errors: number;
};

const DEFAULT_MAPPINGS: FieldMapping[] = [
  { ghlField: 'firstName', twentyField: 'name.firstName', auto: true },
  { ghlField: 'lastName', twentyField: 'name.lastName', auto: true },
  { ghlField: 'email', twentyField: 'emails[0]', auto: true },
  { ghlField: 'phone', twentyField: 'phones[0]', auto: true },
  { ghlField: 'tags', twentyField: 'tags', auto: true },
];

const SYNC_INTERVALS = [5, 15, 30, 60];

const STORAGE_KEY = 'consuelo_ghl_sync_config';

// -- api helpers --

const fetchJson = async <TData,>(
  path: string,
  options?: RequestInit,
): Promise<TData> => {
  const res = await fetch(`${REACT_APP_SERVER_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = (await res.json()) as TData;
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Request failed: ${res.status}`);
  }
  return data;
}

// -- styled --

const StyledStatusRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};
`;

const StyledStatusDot = styled.span<{ connected: boolean }>`
  background: ${({ connected, theme }) =>
    connected ? theme.color.green : theme.font.color.tertiary};
  border-radius: 50%;
  display: inline-block;
  height: 8px;
  width: 8px;
`;

const StyledStatusText = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledSubText = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)} ${theme.spacing(3)}`};
`;

const StyledRadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};
`;

const StyledRadioLabel = styled.label`
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledIntervalRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)} ${theme.spacing(3)}`};
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
`;

const StyledMappingTable = styled.table`
  border-collapse: collapse;
  width: 100%;
`;

const StyledMappingTh = styled.th`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  text-align: left;
`;

const StyledMappingTd = styled.td`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
`;

const StyledBadge = styled.span`
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(1)}`};
`;

const StyledHistoryRow = styled.tr`
  &:last-child td {
    border-bottom: none;
  }
`;

const StyledSuccessIcon = styled.span<{ success: boolean }>`
  color: ${({ success, theme }) =>
    success ? theme.color.green : theme.color.red};
`;

const StyledError = styled.div`
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
`;

// -- helpers --

const loadSyncConfig = (): SyncConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? (JSON.parse(raw) as SyncConfig)
      : { direction: 'bidirectional', autoSyncMinutes: 15 };
  } catch {
    return { direction: 'bidirectional', autoSyncMinutes: 15 };
  }
};

const saveSyncConfig = (config: SyncConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

const formatTimeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// -- mock sync history (replaced by real API in DEV-782) --
const MOCK_HISTORY: SyncLogEntry[] = [];

// -- component --

export const GHLSettings = () => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(loadSyncConfig);
  const [mappings] = useState<FieldMapping[]>(DEFAULT_MAPPINGS);
  const [history] = useState<SyncLogEntry[]>(MOCK_HISTORY);
  const setGhlConnection = useSetRecoilState(ghlConnectionState);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchJson<ConnectionStatus>(
        '/v1/integrations/ghl/status',
      );
      setStatus(data);
      setGhlConnection({
        connected: data.connected,
        locationId: data.locationId ?? null,
        locationName: data.locationName ?? null,
        connectedAt: data.connectedAt ?? null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, [setGhlConnection]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleConnect = useCallback(async () => {
    try {
      setConnecting(true);
      setError(null);
      const data = await fetchJson<{ url: string }>('/v1/integrations/ghl/auth');
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth');
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!window.confirm('Disconnect GHL integration? Sync will stop.')) return;
    try {
      setDisconnecting(true);
      setError(null);
      await fetchJson('/v1/integrations/ghl/connection', { method: 'DELETE' });
      setStatus({ connected: false });
      setGhlConnection({
        connected: false,
        locationId: null,
        locationName: null,
        connectedAt: null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }, [setGhlConnection]);

  const handleSyncConfigChange = useCallback(
    (patch: Partial<SyncConfig>) => {
      const next = { ...syncConfig, ...patch };
      setSyncConfig(next);
      saveSyncConfig(next);
    },
    [syncConfig],
  );

  if (loading) {
    return <StyledSubText>Loading GHL status...</StyledSubText>;
  }

  return (
    <>
      {/* connection status */}
      <Section>
        <H2Title
          title="Go High Level"
          description="Connect your GHL account to sync contacts and push call outcomes"
        />
        <Card rounded>
          <StyledStatusRow>
            <StyledStatusDot connected={status?.connected ?? false} />
            <StyledStatusText>
              {status?.connected
                ? `Connected${status.locationName ? ` — ${status.locationName}` : ''}`
                : 'Not connected'}
            </StyledStatusText>
            {status?.connected && status.lastSync && (
              <StyledSubText>
                Last sync: {formatTimeAgo(status.lastSync)}
                {status.syncedContacts !== undefined &&
                  ` (${status.syncedContacts} contacts)`}
              </StyledSubText>
            )}
          </StyledStatusRow>
          {error && <StyledError>{error}</StyledError>}
          <StyledButtonRow>
            {status?.connected ? (
              <>
                <Button
                  title="Sync Now"
                  Icon={IconRefresh}
                  size="small"
                  variant="secondary"
                  disabled
                />
                <Button
                  title={disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  Icon={IconLinkOff}
                  size="small"
                  variant="secondary"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                />
              </>
            ) : (
              <Button
                title={connecting ? 'Connecting...' : 'Connect GHL'}
                Icon={IconLink}
                size="small"
                onClick={handleConnect}
                disabled={connecting}
              />
            )}
          </StyledButtonRow>
        </Card>
      </Section>

      {/* sync config — only show when connected */}
      {status?.connected && (
        <>
          <Section>
            <H2Title
              title="Sync Settings"
              description="Configure how contacts sync between GHL and Twenty"
            />
            <Card rounded>
              <StyledRadioGroup>
                {(
                  [
                    ['ghl-to-twenty', 'GHL → Twenty (one-way import)'],
                    ['twenty-to-ghl', 'Twenty → GHL (one-way push)'],
                    ['bidirectional', 'Bidirectional (recommended)'],
                  ] as const
                ).map(([value, label]) => (
                  <StyledRadioLabel key={value}>
                    <input
                      type="radio"
                      name="sync-direction"
                      checked={syncConfig.direction === value}
                      onChange={() =>
                        handleSyncConfigChange({ direction: value })
                      }
                    />
                    {label}
                  </StyledRadioLabel>
                ))}
              </StyledRadioGroup>
              <StyledIntervalRow>
                <StyledSubText>Auto-sync every</StyledSubText>
                <StyledSelect
                  value={syncConfig.autoSyncMinutes}
                  onChange={(e) =>
                    handleSyncConfigChange({
                      autoSyncMinutes: parseInt(e.target.value, 10),
                    })
                  }
                >
                  {SYNC_INTERVALS.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </StyledSelect>
              </StyledIntervalRow>
            </Card>
          </Section>

          {/* field mappings */}
          <Section>
            <H2Title
              title="Field Mapping"
              description="Map GHL contact fields to Twenty person fields"
            />
            <Card rounded>
              <StyledMappingTable>
                <thead>
                  <tr>
                    <StyledMappingTh>GHL Field</StyledMappingTh>
                    <StyledMappingTh />
                    <StyledMappingTh>Twenty Field</StyledMappingTh>
                    <StyledMappingTh />
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.ghlField}>
                      <StyledMappingTd>{m.ghlField}</StyledMappingTd>
                      <StyledMappingTd>→</StyledMappingTd>
                      <StyledMappingTd>{m.twentyField}</StyledMappingTd>
                      <StyledMappingTd>
                        {m.auto && <StyledBadge>auto</StyledBadge>}
                      </StyledMappingTd>
                    </tr>
                  ))}
                </tbody>
              </StyledMappingTable>
            </Card>
          </Section>

          {/* sync history */}
          <Section>
            <H2Title
              title="Sync History"
              description="Recent sync operations and their results"
            />
            <Card rounded>
              {history.length === 0 ? (
                <StyledStatusRow>
                  <StyledSubText>
                    No sync history yet — history will appear after the first
                    sync
                  </StyledSubText>
                </StyledStatusRow>
              ) : (
                <StyledMappingTable>
                  <thead>
                    <tr>
                      <StyledMappingTh>Time</StyledMappingTh>
                      <StyledMappingTh>Type</StyledMappingTh>
                      <StyledMappingTh>Status</StyledMappingTh>
                      <StyledMappingTh>Added</StyledMappingTh>
                      <StyledMappingTh>Updated</StyledMappingTh>
                      <StyledMappingTh>Errors</StyledMappingTh>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry, i) => (
                      <StyledHistoryRow key={i}>
                        <StyledMappingTd>
                          {formatTimeAgo(entry.timestamp)}
                        </StyledMappingTd>
                        <StyledMappingTd>{entry.type}</StyledMappingTd>
                        <StyledMappingTd>
                          <StyledSuccessIcon success={entry.success}>
                            {entry.success ? (
                              <IconCheck size={14} />
                            ) : (
                              <IconX size={14} />
                            )}
                          </StyledSuccessIcon>
                        </StyledMappingTd>
                        <StyledMappingTd>+{entry.added}</StyledMappingTd>
                        <StyledMappingTd>~{entry.updated}</StyledMappingTd>
                        <StyledMappingTd>
                          {entry.errors > 0 ? `⚠${entry.errors}` : '—'}
                        </StyledMappingTd>
                      </StyledHistoryRow>
                    ))}
                  </tbody>
                </StyledMappingTable>
              )}
            </Card>
          </Section>
        </>
      )}
    </>
  );
};
