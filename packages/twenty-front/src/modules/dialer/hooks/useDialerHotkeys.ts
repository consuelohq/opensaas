import { useGlobalHotkeys } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeys';

// registers dialer keyboard shortcuts using twenty's hotkey system.
// mount in InCallControls or DialerSidebar — pass callbacks for each action.
// shortcuts only fire outside text inputs (useGlobalHotkeys default).

type UseDialerHotkeysProps = {
  onToggleSidebar?: () => void;
  onMuteToggle?: () => void;
  onHoldToggle?: () => void;
  onTransferToggle?: () => void;
  onEndCall?: () => void;
};

export const useDialerHotkeys = ({
  onToggleSidebar,
  onMuteToggle,
  onHoldToggle,
  onTransferToggle,
  onEndCall,
}: UseDialerHotkeysProps) => {
  useGlobalHotkeys({
    keys: ['mod+d'],
    callback: () => onToggleSidebar?.(),
    containsModifier: true,
    dependencies: [onToggleSidebar],
    options: { enableOnFormTags: true, enableOnContentEditable: true },
  });

  useGlobalHotkeys({
    keys: ['m'],
    callback: () => onMuteToggle?.(),
    containsModifier: false,
    dependencies: [onMuteToggle],
    options: { enableOnFormTags: false, enableOnContentEditable: false },
  });

  useGlobalHotkeys({
    keys: ['h'],
    callback: () => onHoldToggle?.(),
    containsModifier: false,
    dependencies: [onHoldToggle],
    options: { enableOnFormTags: false, enableOnContentEditable: false },
  });

  useGlobalHotkeys({
    keys: ['t'],
    callback: () => onTransferToggle?.(),
    containsModifier: false,
    dependencies: [onTransferToggle],
    options: { enableOnFormTags: false, enableOnContentEditable: false },
  });

  useGlobalHotkeys({
    keys: ['Escape'],
    callback: () => onEndCall?.(),
    containsModifier: false,
    dependencies: [onEndCall],
    options: { enableOnFormTags: false, enableOnContentEditable: false },
  });
};
