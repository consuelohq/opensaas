import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn, userEvent, within, expect } from '@storybook/test';

import { TransferModal } from '@/dialer/components/TransferModal';

const meta: Meta<typeof TransferModal> = {
  title: 'Modules/Dialer/TransferModal',
  component: TransferModal,
  parameters: {
    layout: 'centered',
  },
  args: {
    onTransfer: fn(),
    onClose: fn(),
    isTransferring: false,
  },
};

export default meta;
type Story = StoryObj<typeof TransferModal>;

export const Default: Story = {};

export const WithPhoneNumber: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Enter phone number');

    await userEvent.type(input, '5551234567');

    await expect(input).toHaveValue('(555) 123-4567');
  },
};

export const WithLongPhoneNumber: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Enter phone number');

    await userEvent.type(input, '15551234567');

    await expect(input).toHaveValue('+1 (555) 123-4567');
  },
};

export const Transferring: Story = {
  args: {
    isTransferring: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Enter phone number');

    await userEvent.type(input, '5551234567');

    const transferButton = canvas.getByRole('button', { name: /transfer/i });
    await expect(transferButton).toBeDisabled();
  },
};

export const ColdTransfer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const coldButton = canvas.getByRole('button', { name: 'Cold' });
    await userEvent.click(coldButton);

    const input = canvas.getByPlaceholderText('Enter phone number');
    await userEvent.type(input, '5551234567');

    const transferButton = canvas.getByRole('button', { name: /transfer/i });
    await userEvent.click(transferButton);

    // The modal should show cold transfer description
    await expect(
      canvas.getByText(/immediately connects the customer/i),
    ).toBeInTheDocument();
  },
};

export const WarmTransfer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const warmButton = canvas.getByRole('button', { name: 'Warm' });
    await userEvent.click(warmButton);

    const input = canvas.getByPlaceholderText('Enter phone number');
    await userEvent.type(input, '5551234567');

    const transferButton = canvas.getByRole('button', { name: /transfer/i });
    await userEvent.click(transferButton);

    // The modal should show warm transfer description
    await expect(
      canvas.getByText(/puts the customer on hold while you speak/i),
    ).toBeInTheDocument();
  },
};

export const CloseWithEscape: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Enter phone number');

    await userEvent.type(input, '5551234567');
    await userEvent.keyboard('{Escape}');

    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const TransferWithEnter: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Enter phone number');

    await userEvent.type(input, '5551234567');
    await userEvent.keyboard('{Enter}');

    await expect(args.onTransfer).toHaveBeenCalledWith('+15551234567', 'warm');
  },
};
