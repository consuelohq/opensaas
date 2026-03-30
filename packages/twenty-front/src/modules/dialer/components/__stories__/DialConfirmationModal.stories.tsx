import { type Meta, type StoryObj } from '@storybook/react-vite';
import { RecoilRoot } from 'recoil';

import { DialConfirmationModal } from '@/dialer/components/DialConfirmationModal';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { phoneNumberState } from '@/dialer/states/phoneNumberState';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { type DialerContact, type CallerIdOption } from '@/dialer/types/dialer';

const Wrapper = ({
  children,
  selectedContact,
  phoneNumber,
  availableCallerIds,
  selectedCallerId,
}: {
  children: React.ReactNode;
  selectedContact: DialerContact | null;
  phoneNumber: string;
  availableCallerIds: CallerIdOption[];
  selectedCallerId: string | null;
}) => (
  <RecoilRoot
    initializeState={({ set }) => {
      set(selectedContactState, selectedContact);
      set(phoneNumberState, phoneNumber);
      set(availableCallerIdsState, availableCallerIds);
      set(selectedCallerIdState, selectedCallerId);
    }}
  >
    {children}
  </RecoilRoot>
);

const mockContact: DialerContact = {
  id: 'selectedContact-1',
  name: 'Jane Smith',
  firstName: 'Jane',
  lastName: 'Smith',
  company: 'Acme Corp',
  phone: '+14155551234',
  email: 'jane@acme.com',
  avatarUrl: null,
};

const mockCallerIds: CallerIdOption[] = [
  {
    sid: 'caller-id-1',
    phoneNumber: '+14155559876',
    friendlyName: 'SF Office',
    areaCode: '415',
    isPrimary: true,
  },
  {
    sid: 'caller-id-2',
    phoneNumber: '+15551234567',
    friendlyName: 'NY Office',
    areaCode: '555',
    isPrimary: false,
  },
];

const meta: Meta<typeof DialConfirmationModal> = {
  title: 'Modules/Dialer/DialConfirmationModal',
  component: DialConfirmationModal,
  decorators: [
    (Story, context) => {
      const {
        selectedContact = mockContact,
        phoneNumber = '+14155551234',
        availableCallerIds = mockCallerIds,
        selectedCallerId = null,
      } = context.args as unknown as {
        selectedContact?: DialerContact | null;
        phoneNumber?: string;
        availableCallerIds?: CallerIdOption[];
        selectedCallerId?: string | null;
      };
      return (
        <Wrapper
          selectedContact={selectedContact}
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
    onClose: () => undefined,
    onConfirm: () => undefined,
  },
};

export default meta;
type StoryArgs = {
  onClose: () => void;
  onConfirm: (callerId: string) => void;
  selectedContact?: DialerContact | null;
  phoneNumber?: string;
  availableCallerIds?: CallerIdOption[];
  selectedCallerId?: string | null;
};

type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const UnknownContact: Story = {
  args: {
    selectedContact: null,
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
    selectedContact: {
      ...mockContact,
      name: 'Christopher Alexander Rodriguez-Montgomery',
      firstName: 'Christopher',
      lastName: 'Alexander Rodriguez-Montgomery',
    },
  },
};

export const WithCompany: Story = {
  args: {
    selectedContact: {
      ...mockContact,
      company: 'Very Long Company Name Inc.',
    },
  },
};
