import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { captureException } from '@sentry/react';

import { audioDevicesState } from '@/dialer/states/audioDevicesState';
import { selectedMicState } from '@/dialer/states/selectedMicState';
import { selectedSpeakerState } from '@/dialer/states/selectedSpeakerState';
import type { AudioDeviceInfo } from '@/dialer/types/dialer';

const MIC_KEY = 'dialer_mic';
const SPEAKER_KEY = 'dialer_speaker';
const MIC_PERMISSION_KEY = 'dialer_mic_permission_granted';

interface UseAudioDevicesReturn {
  microphones: AudioDeviceInfo[];
  speakers: AudioDeviceInfo[];
  selectedMic: string | null;
  selectedSpeaker: string | null;
  setSelectedMic: (deviceId: string) => void;
  setSelectedSpeaker: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

const toDeviceInfo = (device: MediaDeviceInfo): AudioDeviceInfo => ({
  deviceId: device.deviceId,
  label:
    device.label ||
    `${device.kind === 'audioinput' ? 'Microphone' : 'Speaker'} ${device.deviceId.slice(0, 4)}`,
  kind: device.kind as 'audioinput' | 'audiooutput',
});

export const useAudioDevices = (): UseAudioDevicesReturn => {
  const [audioDevices, setAudioDevices] = useRecoilState(audioDevicesState);
  const [selectedMic, setSelectedMicAtom] = useRecoilState(selectedMicState);
  const [selectedSpeaker, setSelectedSpeakerAtom] =
    useRecoilState(selectedSpeakerState);
  const initializedRef = useRef(false);

  const microphones = audioDevices
    .filter((d) => d.kind === 'audioinput')
    .map(toDeviceInfo);

  const speakers = audioDevices
    .filter((d) => d.kind === 'audiooutput')
    .map(toDeviceInfo);

  // labels are empty strings until permission is granted
  const hasPermission =
    audioDevices.some((d) => d.label.length > 0) ||
    localStorage.getItem(MIC_PERMISSION_KEY) === 'true';

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(
        (d) => d.kind === 'audioinput' || d.kind === 'audiooutput',
      );
      setAudioDevices(audioDevices);
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'refreshDevices' } });
    }
  }, [setAudioDevices]);

  const restoreOrDefault = useCallback(
    (devices: MediaDeviceInfo[]) => {
      const mics = devices.filter((d) => d.kind === 'audioinput');
      const spkrs = devices.filter((d) => d.kind === 'audiooutput');

      const savedMic = localStorage.getItem(MIC_KEY);
      const micExists = mics.some((d) => d.deviceId === savedMic);
      if (savedMic && micExists) {
        setSelectedMicAtom(savedMic);
      } else if (mics.length > 0 && !selectedMic) {
        setSelectedMicAtom(mics[0].deviceId);
      }

      const savedSpeaker = localStorage.getItem(SPEAKER_KEY);
      const speakerExists = spkrs.some((d) => d.deviceId === savedSpeaker);
      if (savedSpeaker && speakerExists) {
        setSelectedSpeakerAtom(savedSpeaker);
      } else if (spkrs.length > 0 && !selectedSpeaker) {
        setSelectedSpeakerAtom(spkrs[0].deviceId);
      }
    },
    [selectedMic, selectedSpeaker, setSelectedMicAtom, setSelectedSpeakerAtom],
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      localStorage.setItem(MIC_PERMISSION_KEY, 'true');
      await refreshDevices();
      return true;
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'requestPermission' } });
      return false;
    }
  }, [refreshDevices]);

  const setSelectedMic = useCallback(
    (deviceId: string) => {
      setSelectedMicAtom(deviceId);
      localStorage.setItem(MIC_KEY, deviceId);
    },
    [setSelectedMicAtom],
  );

  const setSelectedSpeaker = useCallback(
    (deviceId: string) => {
      setSelectedSpeakerAtom(deviceId);
      localStorage.setItem(SPEAKER_KEY, deviceId);
    },
    [setSelectedSpeakerAtom],
  );

  // enumerate on mount + listen for device changes
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(
          (d) => d.kind === 'audioinput' || d.kind === 'audiooutput',
        );
        setAudioDevices(audioDevices);
        restoreOrDefault(audioDevices);
      } catch (err: unknown) {
        captureException(err, { extra: { context: 'initAudioDevices' } });
      }
    };

    init();
  }, [setAudioDevices, restoreOrDefault]);

  // devicechange listener
  useEffect(() => {
    const handler = () => {
      refreshDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handler);
    };
  }, [refreshDevices]);

  return {
    microphones,
    speakers,
    selectedMic,
    selectedSpeaker,
    setSelectedMic,
    setSelectedSpeaker,
    refreshDevices,
    hasPermission,
    requestPermission,
  };
};
