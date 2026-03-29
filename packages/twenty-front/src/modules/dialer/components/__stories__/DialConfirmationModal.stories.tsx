import { type Meta, type StoryObj } from '@storybook/react-vite';
import { RecoilRoot } from 'recoil';
import { fn, userEvent, within, expect } from '@storybook/test';

import { DialConfirmationModal } from '@/dialer/components/DialConfirmationModal';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { type DialerContact, type CallerIdOption } from '@/dialer/types/dialer';

const Wrapper = ({
  children,
  contact,
  phoneNumber,
  availableCallerIds,
  selectedCallerId,
}: {
  children: React.ReactNode;
  contact: DialerContact | null;
  phoneNumber: string;
  availableCallerIds: CallerIdOption[];
  selectedCallerId: string | null;
}) => (
  <RecoilRoot
    initializeState={({ set }) => {
      set(selectedContactState, contact);
      set(phoneNumberState, phoneNumber);
      set(availableCallerIdsState, availableCallerIds);
      set(selectedCallerIdState, selectedCallerId);
    }}
  >
    {children}
  </RecoilRoot>
);

const mockContact: DialerContact = {
  id: 'contact-1',
  name: 'Jane Smith',
  firstName: 'Jane',
  lastName: 'Smith',
  company: 'Acme Corp',
  phone: '+14155551234',
  email: 'jane@acme.com',
  avatarUrl: null,
};

const mockCallerIds: CallerIdOption[] = [
  { phoneNumber: '+14155559876', friendlyName: 'SF Office', areaCode: '415' },
  { phoneNumber: '+15551234567', friendlyName: 'NY Office', areaCode: '555' },
];

const meta: Meta<typeof DialConfirmationModal> = {
  title: 'Modules/Dialer/DialConfirmationModal',
  component: DialConfirmationModal,
  decorators: [
    (Story, context) => {
      const {
        contact = mockContact,
        phoneNumber = '+14155551234',
        availableCallerIds = mockCallerIds,
        selectedCallerId = null,
      } = context.args as unknown as {
        contact?: DialerContact | null;
        phoneNumber?: string;
        availableCallerIds?: CallerIdOption[];
        selectedCallerId?: string | null;
      };
      return (
        <Wrapper
          contact={contact}
          phoneNumber={phoneNumber}
          availableCallerIds={availableCallerIds}
          selectedCallerId={selectedCallerId}
        >
          <Story />
        </Wrapper>
      );
    },
  ],
  parameters: {
    layout: 'centered',
  },
  args: {
    onClose: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type StoryArgs = {
  onClose: () => void;
  onConfirm: (callerId: string) => void;
  contact?: DialerContact | null;
  phoneNumber?: string;
  availableCallerIds?: CallerIdOption[];
  selectedCallerId?: string | null;
};

type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const UnknownContact: Story = {
  args: {
    contact: null,
    phoneNumber: '+19998887777',
  },
};

export const SingleCallerId: Story = {
  args: {
    availableCallerIds: [mockCallerIds[0]],
  },
};

export const NoCallerIds: Story = {
  args: {
    availableCallerIds: [],
  },
};

export const LongName: Story = {
  args: {
    contact: {
      ...mockContact,
      name: 'Christopher Alexander Rodriguez-Montgomery',
      firstName: 'Christopher',
      lastName: 'Alexander Rodriguez-Montgomery',
    },
  },
};

export const WithCompany: Story = {
  args: {
    contact: {
      ...mockContact,
      company: 'Very Long Company Name Inc.',
    },
  },
};

export const ConfirmCall: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const confirmButton = canvas.getByRole('button', { name: /call now/i });
    await userEvent.click(confirmButton);

    await expect(args.onConfirm).toHaveBeenCalledWith(
      mockCallerIds[0].phoneNumber,
    );
  },
};

export const CloseWithEscape: Story = {
  play: async ({ args }) => {
    await userEvent.keyboard('{Escape}');

    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const ConfirmWithEnter: Story = {
  play: async ({ args }) => {
    await userEvent.keyboard('{Enter}');

    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const ChangeCallerId: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('combobox');
    await userEvent.selectOptions(select, mockCallerIds[1].phoneNumber);

    const confirmButton = canvas.getByRole('button', { name: /call now/i });
    await userEvent.click(confirmButton);

    await expect(args.onConfirm).toHaveBeenCalledWith(
      mockCallerIds[1].phoneNumber,
    );
  },
};
