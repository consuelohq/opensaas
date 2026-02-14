import { useAudioDevices } from '@/dialer/hooks/useAudioDevices';
import { SettingsOptionCardContentSelect } from '@/settings/components/SettingsOptions/SettingsOptionCardContentSelect';
import { Select } from '@/ui/input/components/Select';
import styled from '@emotion/styled';
import { useCallback, useRef, useState } from 'react';
import { H2Title, IconHeadphones, IconMicrophone } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';

const StyledTestRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledLevelBar = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  flex: 1;
  height: 8px;
  overflow: hidden;
`;

const StyledLevelFill = styled.div<{ level: number }>`
  background: ${({ theme }) => theme.color.blue};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  height: 100%;
  transition: width 50ms linear;
  width: ${({ level }) => Math.min(level, 100)}%;
`;

const StyledPermissionNotice = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
`;

export const AudioDeviceSettings = () => {
  const {
    microphones,
    speakers,
    selectedMic,
    selectedSpeaker,
    setSelectedMic,
    setSelectedSpeaker,
    hasPermission,
    requestPermission,
  } = useAudioDevices();

  const [micLevel, setMicLevel] = useState(0);
  const [testingMic, setTestingMic] = useState(false);
  const [testingSpeaker, setTestingSpeaker] = useState(false);
  const micCleanupRef = useRef<(() => void) | null>(null);

  const micOptions = microphones.map((d) => ({
    value: d.deviceId,
    label: d.label,
  }));

  const speakerOptions = speakers.map((d) => ({
    value: d.deviceId,
    label: d.label,
  }));

  const handleTestMic = useCallback(async () => {
    if (testingMic && micCleanupRef.current) {
      micCleanupRef.current();
      return;
    }

    setTestingMic(true);
    setMicLevel(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let animId = 0;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel((avg / 128) * 100);
        animId = requestAnimationFrame(tick);
      };
      tick();

      const cleanup = () => {
        cancelAnimationFrame(animId);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        setTestingMic(false);
        setMicLevel(0);
        micCleanupRef.current = null;
      };

      micCleanupRef.current = cleanup;

      // auto-stop after 5s
      setTimeout(() => {
        if (micCleanupRef.current === cleanup) {
          cleanup();
        }
      }, 5000);
    } catch {
      setTestingMic(false);
    }
  }, [testingMic, selectedMic]);

  const handleTestSpeaker = useCallback(async () => {
    if (testingSpeaker) return;
    setTestingSpeaker(true);

    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 440;
      gain.gain.value = 0.3;
      osc.connect(gain).connect(ctx.destination);
      osc.start();

      // if browser supports setSinkId, route to selected speaker
      const dest = ctx.destination as AudioNode & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (selectedSpeaker && dest.setSinkId) {
        try {
          await dest.setSinkId(selectedSpeaker);
        } catch {
          // setSinkId not supported for this context — play through default
        }
      }

      setTimeout(() => {
        osc.stop();
        ctx.close();
        setTestingSpeaker(false);
      }, 1500);
    } catch {
      setTestingSpeaker(false);
    }
  }, [testingSpeaker, selectedSpeaker]);

  if (!hasPermission) {
    return (
      <Section>
        <H2Title
          title="Audio Devices"
          description="Microphone and speaker selection"
        />
        <Card rounded>
          <StyledPermissionNotice>
            Microphone permission is required to manage audio devices.
            <div style={{ marginTop: 12 }}>
              <Button
                title="Grant Permission"
                variant="secondary"
                size="small"
                onClick={requestPermission}
              />
            </div>
          </StyledPermissionNotice>
        </Card>
      </Section>
    );
  }

  return (
    <>
      <Section>
        <H2Title
          title="Microphone"
          description="Select input device for calls"
        />
        <Card rounded>
          <SettingsOptionCardContentSelect
            Icon={IconMicrophone}
            title="Input Device"
            description="Used for outbound and inbound calls"
          >
            <Select
              dropdownId="audio-mic-select"
              value={selectedMic ?? ''}
              onChange={(value) => setSelectedMic(value)}
              options={micOptions}
              selectSizeVariant="small"
              dropdownWidth={200}
            />
          </SettingsOptionCardContentSelect>
          <StyledTestRow>
            <Button
              title={testingMic ? 'Stop' : 'Test Mic'}
              variant="secondary"
              size="small"
              onClick={handleTestMic}
            />
            <StyledLevelBar>
              <StyledLevelFill level={micLevel} />
            </StyledLevelBar>
          </StyledTestRow>
        </Card>
      </Section>

      <Section>
        <H2Title
          title="Speaker"
          description="Select output device for calls"
        />
        <Card rounded>
          <SettingsOptionCardContentSelect
            Icon={IconHeadphones}
            title="Output Device"
            description="Used for call audio playback"
          >
            <Select
              dropdownId="audio-speaker-select"
              value={selectedSpeaker ?? ''}
              onChange={(value) => setSelectedSpeaker(value)}
              options={speakerOptions}
              selectSizeVariant="small"
              dropdownWidth={200}
            />
          </SettingsOptionCardContentSelect>
          <StyledTestRow>
            <Button
              title={testingSpeaker ? 'Playing...' : 'Test Speaker'}
              variant="secondary"
              size="small"
              onClick={handleTestSpeaker}
              disabled={testingSpeaker}
            />
          </StyledTestRow>
        </Card>
      </Section>
    </>
  );
};
