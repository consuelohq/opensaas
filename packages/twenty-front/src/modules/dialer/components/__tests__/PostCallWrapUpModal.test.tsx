import '@testing-library/jest-dom';
import { fireEvent, screen } from '@testing-library/react';
import { type ComponentProps } from 'react';

import {
  PostCallWrapUpModal,
  type PostCallWrapUpMode,
} from '@/dialer/components/PostCallWrapUpModal';
import { renderWithRecoil } from '@/dialer/testing/renderWithRecoil';

jest.mock('@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack', () => ({
  usePushFocusItemToFocusStack: () => ({
    pushFocusItemToFocusStack: jest.fn(),
  }),
}));

jest.mock(
  '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById',
  () => ({
    useRemoveFocusItemFromFocusStackById: () => ({
      removeFocusItemFromFocusStackById: jest.fn(),
    }),
  }),
);

const defaultProps = {
  isOpen: true,
  contactName: 'Ada Lovelace',
  durationSeconds: 83,
  disposition: 'follow-up',
  countdownSeconds: 3,
  autoAdvanceEnabled: true,
  onAdvance: jest.fn(),
  onCancelAutoAdvance: jest.fn(),
  onAutoAdvanceChange: jest.fn(),
  onSelectDisposition: jest.fn(),
};

const renderModal = (
  mode: PostCallWrapUpMode,
  overrides: Partial<ComponentProps<typeof PostCallWrapUpModal>> = {},
) => {
  const props = { ...defaultProps, ...overrides };

  return renderWithRecoil(
    <PostCallWrapUpModal
      isOpen={props.isOpen}
      mode={mode}
      contactName={props.contactName}
      durationSeconds={props.durationSeconds}
      disposition={props.disposition}
      countdownSeconds={props.countdownSeconds}
      autoAdvanceEnabled={props.autoAdvanceEnabled}
      selectedDisposition={props.selectedDisposition}
      onAdvance={props.onAdvance}
      onCancelAutoAdvance={props.onCancelAutoAdvance}
      onAutoAdvanceChange={props.onAutoAdvanceChange}
      onSelectDisposition={props.onSelectDisposition}
    />,
  );
};

describe('PostCallWrapUpModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the call summary and auto-advance countdown with an off checkbox', async () => {
    renderModal('auto-advance');

    expect(await screen.findByText('Call complete')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
    expect(screen.getByText('follow-up')).toBeInTheDocument();
    expect(screen.getByText('Starting next call in 3')).toBeInTheDocument();
    expect(
      screen.getByText('Turn off auto advance next call'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Turn off auto advance next call'));
    expect(defaultProps.onAutoAdvanceChange).toHaveBeenCalledWith(false);
  });

  it('cancels only the pending auto advance', async () => {
    renderModal('auto-advance');

    fireEvent.click(await screen.findByText('Cancel'));

    expect(defaultProps.onCancelAutoAdvance).toHaveBeenCalledTimes(1);
    expect(defaultProps.onAdvance).not.toHaveBeenCalled();
  });

  it('renders manual advance with an on checkbox', async () => {
    renderModal('manual-advance', { autoAdvanceEnabled: false });

    fireEvent.click(await screen.findByText('Advance to Next Call'));

    expect(defaultProps.onAdvance).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('Turn on auto advance next call'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Turn on auto advance next call'));
    expect(defaultProps.onAutoAdvanceChange).toHaveBeenCalledWith(true);
  });

  it('requires a manual disposition before advancing', async () => {
    renderModal('manual-disposition', {
      disposition: null,
      selectedDisposition: null,
    });

    const advanceButton = (
      await screen.findByText('Advance to Next Call')
    ).closest('button');
    expect(advanceButton).toBeDisabled();

    fireEvent.click(screen.getByText('Voicemail'));
    expect(defaultProps.onSelectDisposition).toHaveBeenCalledWith('voicemail');
  });
});
