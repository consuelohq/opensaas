import { type Meta, type StoryObj } from '@storybook/react-vite';
import { RecoilRoot } from 'recoil';
import { expect, fn, userEvent, within } from 'storybook/test';

import { DialPad } from '@/dialer/components/DialPad';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { type CallState } from '@/dialer/types/dialer';

const Wrapper = ({
  children,
  callState,
  initialNumber = '',
}: {
  children: React.ReactNode;
  callState: CallState;
  initialNumber?: string;
}) => (
  <RecoilRoot
    initializeState={({ set }) => {
      set(callStateAtom, callState);
      set(phoneNumberState, initialNumber);
    }}
  >
    {children}
  </RecoilRoot>
);

const baseCallState: CallState = {
  status: 'idle',
  callSid: null,
  duration: 0,
  startedAt: null,
  contact: null,
  callingMode: 'browser',
  fromNumber: null,
  parallelGroupId: null,
  transferId: null,
};

const meta: Meta<typeof DialPad> = {
  title: 'Modules/Dialer/DialPad',
  component: DialPad,
  decorators: [
    (Story, context) => {
      const { callState = baseCallState, initialNumber = '' } =
        context.args as unknown as {
          callState?: CallState;
          initialNumber?: string;
        };
      return (
        <Wrapper callState={callState} initialNumber={initialNumber}>
          <Story />
        </Wrapper>
      );
    },
  ],
  parameters: {
    layout: 'centered',
  },
  args: {
    onCall: fn(),
  },
};

export default meta;
type StoryArgs = {
  onCall?: (phoneNumber: string) => void;
  callState?: CallState;
  initialNumber?: string;
};

type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const WithInitialNumber: Story = {
  args: {
    initialNumber: '555',
  },
};

export const DialDisabledWhileConnecting: Story = {
  args: {
    callState: { ...baseCallState, status: 'connecting' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const keys = canvas.getAllByRole('button');

    // Keys should be disabled
    for (const key of keys) {
      await expect(key).toBeDisabled();
    }
  },
};

export const InteractiveDialing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByLabelText('1'));
    await userEvent.click(canvas.getByLabelText('2, ABC'));
    await userEvent.click(canvas.getByLabelText('3, DEF'));

    const display = canvas.getByLabelText('Phone number');
    await expect(display).toHaveValue('(123) ');
  },
};

export const CompletePhoneNumber: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Dial a complete 10-digit number
    await userEvent.click(canvas.getByLabelText('5'));
    await userEvent.click(canvas.getByLabelText('5'));
    await userEvent.click(canvas.getByLabelText('5'));
    await userEvent.click(canvas.getByLabelText('1'));
    await userEvent.click(canvas.getByLabelText('2'));
    await userEvent.click(canvas.getByLabelText('3'));
    await userEvent.click(canvas.getByLabelText('4'));
    await userEvent.click(canvas.getByLabelText('5'));
    await userEvent.click(canvas.getByLabelText('6'));
    await userEvent.click(canvas.getByLabelText('7'));

    const display = canvas.getByLabelText('Phone number');
    await expect(display).toHaveValue('(555) 123-4567');

    // Press Enter to call
    await userEvent.keyboard('{Enter}');

    await expect(args.onCall).toHaveBeenCalledWith('5551234567');
  },
};

export const Backspace: Story = {
  args: {
    initialNumber: '5551234567',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const backspaceButton = canvas.getByLabelText('Delete digit');

    const display = canvas.getByLabelText('Phone number');
    await expect(display).toHaveValue('(555) 123-4567');

    await userEvent.click(backspaceButton);
    await expect(display).toHaveValue('(555) 123-456');

    await userEvent.click(backspaceButton);
    await expect(display).toHaveValue('(555) 123-45');
  },
};

export const ClearWithDoubleClick: Story = {
  args: {
    initialNumber: '5551234567',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const backspaceButton = canvas.getByLabelText('Delete digit');

    const display = canvas.getByLabelText('Phone number');
    await expect(display).toHaveValue('(555) 123-4567');

    await userEvent.dblClick(backspaceButton);
    await expect(display).toHaveValue('');
  },
};

export const ClearWithEscape: Story = {
  args: {
    initialNumber: '5551234567',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const display = canvas.getByLabelText('Phone number');
    await expect(display).toHaveValue('(555) 123-4567');

    await userEvent.keyboard('{Escape}');
    await expect(display).toHaveValue('');
  },
};

export const DTMFInActiveCall: Story = {
  args: {
    callState: { ...baseCallState, status: 'active' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // In an active call, digits are sent as DTMF tones
    await userEvent.click(canvas.getByLabelText('1'));
    await userEvent.click(canvas.getByLabelText('2, ABC'));
    await userEvent.click(canvas.getByLabelText('3, DEF'));

    // Display should not show accumulated digits in active call mode
    const display = canvas.getByLabelText('Phone number');
    await expect(display).toHaveValue('');
  },
};
