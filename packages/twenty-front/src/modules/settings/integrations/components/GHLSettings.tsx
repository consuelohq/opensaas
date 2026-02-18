/**
 * GHL (GoHighLevel) Integration Settings Page
 * Main settings component for managing GHL integration
 * DEV-785: GHL Settings UI
 */

import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {
  IconAlertCircle,
  IconCheck,
  IconExternalLink,
  IconPlugConnected,
  IconPlugX,
  IconRefresh,
  IconSettings,
  IconSync,
  IconTrash,
} from '@tabler/icons-react';
import { H1Title } from 'twenty-ui/display';
import { Button, Checkbox, Toggle } from 'twenty-ui/input';
import { Card, CardContent, Section } from 'twenty-ui/layout';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsHeaderContainer } from '@/settings/components/SettingsHeaderContainer';
import { ghlConnectionState } from '@/settings/integrations/states/ghlConnectionState';
import { ghlSyncConfigState } from '@/settings/integrations/states/ghlSyncConfigState';
import { ghlSyncHistoryState } from '@/settings/integrations/states/ghlSyncHistoryState';
import { ghlPushSettingsState } from '@/settings/integrations/states/ghlPushSettingsState';
import { ghlManualSyncProgressState } from '@/settings/integrations/states/ghlManualSyncProgressState';
import { ghlLoadingState } from '@/settings/integrations/states/ghlLoadingState';
import { ghlErrorState } from '@/settings/integrations/states/ghlErrorState';
import { ghlFieldMappingsState } from '@/settings/integrations/states/ghlFieldMappingsState';
import { ghlPipelineMappingsState } from '@/settings/integrations/states/ghlPipelineMappingsState';
import { GHLFieldMapping } from '@/settings/integrations/components/GHLFieldMapping';
import { GHLPipelineMapping } from '@/settings/integrations/components/GHLPipelineMapping';
import { useGHLSettings } from '@/settings/integrations/hooks/useGHLSettings';
import type {
  GHLSyncDirection,
  GHLConflictResolution,
  GHLSyncLogEntry,
} from '@/settings/integrations/types/ghl';

const StyledSection = styled(Section)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledCard = styled(Card)`
  overflow: hidden;
`;

const StyledCardContent = styled(CardContent)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledStatusContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledStatusIndicator = styled.div<{ connected: boolean }>`
  align-items: center;
  background: ${({ connected, theme }) =>
    connected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ connected, theme }) =>
    connected ? theme.color.green : theme.color.red};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
`;

const StyledStatusText = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledLocationInfo = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledButtonGroup = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledConfigGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
`;

const StyledConfigItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledConfigLabel = styled.label`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
  width: 100%;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue};
    outline: none;
  }
`;

const StyledProgressBar = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  height: 8px;
  overflow: hidden;
  width: 100%;
`;

const StyledProgressFill = styled.div<{ progress: number }>`
  background: ${({ theme }) => theme.color.blue};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  height: 100%;
  transition: width 300ms ease;
  width: ${({ progress }) => `${progress}%`};
`;

const StyledProgressText = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledTableContainer = styled.div`
  overflow-x: auto;
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  width: 100%;
`;

const StyledTh = styled.th`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  text-align: left;
`;

const StyledTd = styled.td`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  vertical-align: middle;
`;

const StyledRow = styled.tr`
  &:last-child td {
    border-bottom: none;
  }
`;

const StyledStatusBadge = styled.span<{ status: string }>`
  background: ${({ status, theme }) => {
    switch (status) {
      case 'completed':
        return 'rgba(34, 197, 94, 0.15)';
      case 'failed':
        return 'rgba(239, 68, 68, 0.15)';
      case 'running':
        return 'rgba(59, 130, 246, 0.15)';
      default:
        return theme.background.transparent.light;
    }
  }};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ status, theme }) => {
    switch (status) {
      case 'completed':
        return theme.color.green;
      case 'failed':
        return theme.color.red;
      case 'running':
        return theme.color.blue;
      default:
        return theme.font.color.tertiary;
    }
  }};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(1.5)}`};
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(6)};
`;

const StyledErrorContainer = styled.div`
  align-items: center;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid ${({ theme }) => theme.color.red};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.color.red};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledPushSettingsGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(3)};
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
`;

const StyledPushSettingItem = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleString();
};

const formatDirection = (direction: GHLSyncDirection): string => {
  switch (direction) {
    case 'ghl-to-twenty':
      return 'Import from GHL';
    case 'twenty-to-ghl':
      return 'Export to GHL';
    case 'bidirectional':
      return 'Bidirectional';
    default:
      return direction;
  }
};

export const GHLSettings = () => {
  const connection = useRecoilValue(ghlConnectionState);
  const syncConfig = useRecoilValue(ghlSyncConfigState);
  const syncHistory = useRecoilValue(ghlSyncHistoryState);
  const pushSettings = useRecoilValue(ghlPushSettingsState);
  const syncProgress = useRecoilValue(ghlManualSyncProgressState);
  const loading = useRecoilValue(ghlLoadingState);
  const error = useRecoilValue(ghlErrorState);
  const fieldMappings = useRecoilValue(ghlFieldMappingsState);
  const pipelineMappings = useRecoilValue(ghlPipelineMappingsState);

  const {
    fetchConnectionStatus,
    initiateOAuth,
    disconnect,
    fetchSyncConfig,
    updateSyncDirection,
    updateConflictResolution,
    toggleAutoSync,
    updateAutoSyncInterval,
    fetchSyncHistory,
    fetchPushSettings,
    savePushSettings,
    triggerManualSync,
    clearError,
  } = useGHLSettings();

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchConnectionStatus();
        await fetchSyncConfig();
        await fetchSyncHistory();
        await fetchPushSettings();
      } catch (err: unknown) {
        // Error handled by hook with Sentry
      }
    };

    void loadData();
  }, [
    fetchConnectionStatus,
    fetchSyncConfig,
    fetchSyncHistory,
    fetchPushSettings,
  ]);

  const handleConnect = useCallback(async () => {
    try {
      await initiateOAuth();
    } catch (err: unknown) {
      // Error handled by hook with Sentry
    }
  }, [initiateOAuth]);

  const handleDisconnect = useCallback(async () => {
    if (!showDisconnectConfirm) {
      setShowDisconnectConfirm(true);
      return;
    }

    try {
      await disconnect();
      setShowDisconnectConfirm(false);
    } catch (err: unknown) {
      // Error handled by hook with Sentry
    }
  }, [disconnect, showDisconnectConfirm]);

  const handleSyncNow = useCallback(async () => {
    try {
      await triggerManualSync();
    } catch (err: unknown) {
      // Error handled by hook with Sentry
    }
  }, [triggerManualSync]);

  const handleDirectionChange = useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const direction = event.target.value as GHLSyncDirection;
      try {
        await updateSyncDirection(direction);
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: {
            component: 'GHLSettings',
            operation: 'handleDirectionChange',
          },
        });
      }
    },
    [updateSyncDirection],
  );

  const handleConflictResolutionChange = useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const resolution = event.target.value as GHLConflictResolution;
      try {
        await updateConflictResolution(resolution);
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: {
            component: 'GHLSettings',
            operation: 'handleConflictResolutionChange',
          },
        });
      }
    },
    [updateConflictResolution],
  );

  const handleAutoSyncToggle = useCallback(
    async (checked: boolean) => {
      try {
        await toggleAutoSync(checked);
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: { component: 'GHLSettings', operation: 'handleAutoSyncToggle' },
        });
      }
    },
    [toggleAutoSync],
  );

  const handleAutoSyncIntervalChange = useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const minutes = parseInt(event.target.value, 10);
      try {
        await updateAutoSyncInterval(minutes);
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: {
            component: 'GHLSettings',
            operation: 'handleAutoSyncIntervalChange',
          },
        });
      }
    },
    [updateAutoSyncInterval],
  );

  const handlePushSettingToggle = useCallback(
    async (setting: keyof typeof pushSettings, checked: boolean) => {
      try {
        const newSettings = { ...pushSettings, [setting]: checked };
        await savePushSettings(newSettings);
      } catch (err: unknown) {
        Sentry.captureException(err, {
          tags: {
            component: 'GHLSettings',
            operation: 'handlePushSettingToggle',
          },
        });
      }
    },
    [pushSettings, savePushSettings],
  );

  const handleDismissError = useCallback(() => {
    clearError();
  }, [clearError]);

  const isLoading = loading !== 'idle';
  const isSyncing = loading === 'syncing' || syncProgress.status === 'running';

  return (
    <SettingsPageContainer>
      <SettingsHeaderContainer>
        <H1Title title="GoHighLevel Integration" />
      </SettingsHeaderContainer>

      {error && (
        <StyledErrorContainer>
          <IconAlertCircle size={20} />
          <span>{error}</span>
          <Button
            Icon={IconX}
            size="small"
            variant="tertiary"
            onClick={handleDismissError}
          />
        </StyledErrorContainer>
      )}

      {/* Connection Status */}
      <StyledSection>
        <StyledCard rounded>
          <StyledCardContent>
            <StyledStatusContainer>
              <StyledStatusIndicator connected={connection.connected}>
                {connection.connected ? (
                  <IconPlugConnected size={20} />
                ) : (
                  <IconPlugX size={20} />
                )}
                <StyledStatusText>
                  {connection.connected ? 'Connected' : 'Disconnected'}
                </StyledStatusText>
              </StyledStatusIndicator>

              {connection.connected && connection.locationName && (
                <StyledLocationInfo>
                  Location: {connection.locationName}
                  {connection.connectedAt && (
                    <span> (since {formatDate(connection.connectedAt)})</span>
                  )}
                </StyledLocationInfo>
              )}
            </StyledStatusContainer>

            <StyledButtonGroup>
              {!connection.connected ? (
                <Button
                  title="Connect GHL"
                  Icon={IconExternalLink}
                  variant="primary"
                  onClick={handleConnect}
                  disabled={isLoading}
                />
              ) : (
                <>
                  <Button
                    title={
                      showDisconnectConfirm
                        ? 'Confirm Disconnect'
                        : 'Disconnect'
                    }
                    Icon={showDisconnectConfirm ? IconTrash : IconPlugX}
                    variant={showDisconnectConfirm ? 'danger' : 'secondary'}
                    onClick={handleDisconnect}
                    disabled={isLoading}
                  />
                  {showDisconnectConfirm && (
                    <Button
                      title="Cancel"
                      variant="tertiary"
                      onClick={() => setShowDisconnectConfirm(false)}
                    />
                  )}
                </>
              )}
            </StyledButtonGroup>
          </StyledCardContent>
        </StyledCard>
      </StyledSection>

      {connection.connected && (
        <>
          {/* Sync Configuration */}
          <StyledSection>
            <h2>Sync Configuration</h2>
            <StyledCard rounded>
              <StyledCardContent>
                <StyledConfigGrid>
                  <StyledConfigItem>
                    <StyledConfigLabel>Sync Direction</StyledConfigLabel>
                    <StyledSelect
                      value={syncConfig.direction}
                      onChange={handleDirectionChange}
                      disabled={isLoading}
                    >
                      <option value="ghl-to-twenty">Import from GHL</option>
                      <option value="twenty-to-ghl">Export to GHL</option>
                      <option value="bidirectional">Bidirectional</option>
                    </StyledSelect>
                  </StyledConfigItem>

                  <StyledConfigItem>
                    <StyledConfigLabel>Conflict Resolution</StyledConfigLabel>
                    <StyledSelect
                      value={syncConfig.conflictResolution}
                      onChange={handleConflictResolutionChange}
                      disabled={isLoading}
                    >
                      <option value="newest">Newest record wins</option>
                      <option value="ghl-wins">GHL always wins</option>
                      <option value="twenty-wins">Twenty always wins</option>
                    </StyledSelect>
                  </StyledConfigItem>

                  <StyledConfigItem>
                    <StyledConfigLabel>Auto-Sync Interval</StyledConfigLabel>
                    <StyledSelect
                      value={syncConfig.autoSyncMinutes}
                      onChange={handleAutoSyncIntervalChange}
                      disabled={isLoading || !syncConfig.autoSyncEnabled}
                    >
                      <option value={5}>Every 5 minutes</option>
                      <option value={15}>Every 15 minutes</option>
                      <option value={30}>Every 30 minutes</option>
                      <option value={60}>Every hour</option>
                      <option value={360}>Every 6 hours</option>
                      <option value={720}>Every 12 hours</option>
                      <option value={1440}>Every 24 hours</option>
                    </StyledSelect>
                  </StyledConfigItem>
                </StyledConfigGrid>

                <StyledConfigItem>
                  <StyledPushSettingItem>
                    <Toggle
                      checked={syncConfig.autoSyncEnabled}
                      onChange={handleAutoSyncToggle}
                      disabled={isLoading}
                    />
                    <span>Enable automatic sync</span>
                  </StyledPushSettingItem>
                </StyledConfigItem>

                <StyledButtonGroup>
                  <Button
                    title={isSyncing ? 'Syncing...' : 'Sync Now'}
                    Icon={isSyncing ? IconRefresh : IconSync}
                    variant="secondary"
                    onClick={handleSyncNow}
                    disabled={isSyncing || isLoading}
                  />
                </StyledButtonGroup>

                {(isSyncing || syncProgress.status !== 'idle') && (
                  <>
                    <StyledProgressBar>
                      <StyledProgressFill progress={syncProgress.progress} />
                    </StyledProgressBar>
                    <StyledProgressText>
                      {syncProgress.message}
                    </StyledProgressText>
                  </>
                )}
              </StyledCardContent>
            </StyledCard>
          </StyledSection>

          {/* Push Settings */}
          <StyledSection>
            <h2>Push to GHL</h2>
            <StyledCard rounded>
              <StyledCardContent>
                <StyledPushSettingsGrid>
                  <StyledPushSettingItem>
                    <Checkbox
                      checked={pushSettings.callOutcomes}
                      onChange={(checked) =>
                        handlePushSettingToggle('callOutcomes', checked)
                      }
                      disabled={isLoading}
                    />
                    <span>Call outcomes</span>
                  </StyledPushSettingItem>

                  <StyledPushSettingItem>
                    <Checkbox
                      checked={pushSettings.contactUpdates}
                      onChange={(checked) =>
                        handlePushSettingToggle('contactUpdates', checked)
                      }
                      disabled={isLoading}
                    />
                    <span>Contact updates</span>
                  </StyledPushSettingItem>

                  <StyledPushSettingItem>
                    <Checkbox
                      checked={pushSettings.tags}
                      onChange={(checked) =>
                        handlePushSettingToggle('tags', checked)
                      }
                      disabled={isLoading}
                    />
                    <span>Tags</span>
                  </StyledPushSettingItem>

                  <StyledPushSettingItem>
                    <Checkbox
                      checked={pushSettings.notes}
                      onChange={(checked) =>
                        handlePushSettingToggle('notes', checked)
                      }
                      disabled={isLoading}
                    />
                    <span>Notes</span>
                  </StyledPushSettingItem>
                </StyledPushSettingsGrid>
              </StyledCardContent>
            </StyledCard>
          </StyledSection>

          {/* Field Mappings */}
          <GHLFieldMapping
            title="Field Mappings"
            description="Configure how fields map between GHL and Twenty"
          />

          {/* Pipeline Mappings */}
          <GHLPipelineMapping
            title="Pipeline Mappings"
            description="Map GHL pipeline stages to Twenty pipeline stages"
          />

          {/* Sync History */}
          <StyledSection>
            <h2>Sync History</h2>
            <StyledCard rounded>
              <StyledTableContainer>
                {syncHistory.length === 0 ? (
                  <StyledEmptyState>
                    No sync history available.
                  </StyledEmptyState>
                ) : (
                  <StyledTable>
                    <thead>
                      <tr>
                        <StyledTh>Date</StyledTh>
                        <StyledTh>Direction</StyledTh>
                        <StyledTh>Status</StyledTh>
                        <StyledTh>Records</StyledTh>
                        <StyledTh>Created</StyledTh>
                        <StyledTh>Updated</StyledTh>
                        <StyledTh>Errors</StyledTh>
                      </tr>
                    </thead>
                    <tbody>
                      {syncHistory
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.timestamp).getTime() -
                            new Date(a.timestamp).getTime(),
                        )
                        .map((entry: GHLSyncLogEntry) => (
                          <StyledRow key={entry.id}>
                            <StyledTd>{formatDate(entry.timestamp)}</StyledTd>
                            <StyledTd>
                              {formatDirection(entry.direction)}
                            </StyledTd>
                            <StyledTd>
                              <StyledStatusBadge status={entry.status}>
                                {entry.status}
                              </StyledStatusBadge>
                            </StyledTd>
                            <StyledTd>{entry.recordsSynced}</StyledTd>
                            <StyledTd>{entry.recordsCreated}</StyledTd>
                            <StyledTd>{entry.recordsUpdated}</StyledTd>
                            <StyledTd>
                              {entry.recordsFailed > 0 ? (
                                <span style={{ color: '#ef4444' }}>
                                  {entry.recordsFailed}
                                </span>
                              ) : (
                                <IconCheck size={16} color="#22c55e" />
                              )}
                            </StyledTd>
                          </StyledRow>
                        ))}
                    </tbody>
                  </StyledTable>
                )}
              </StyledTableContainer>
            </StyledCard>
          </StyledSection>
        </>
      )}
    </SettingsPageContainer>
  );
};
