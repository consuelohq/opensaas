import { Locator, Page } from '@playwright/test';

export class TransferModal {
  readonly overlay: Locator;
  readonly phoneInput: Locator;
  readonly coldOption: Locator;
  readonly warmOption: Locator;
  readonly transferButton: Locator;
  readonly closeButton: Locator;
  readonly errorMessage: Locator;
  readonly consultBar: Locator;
  readonly completeButton: Locator;
  readonly cancelButton: Locator;

  constructor(public readonly page: Page) {
    this.overlay = page.getByText('Transfer Call');
    this.phoneInput = page.getByPlaceholder('Enter phone number');
    this.coldOption = page.getByRole('button', { name: 'Cold' });
    this.warmOption = page.getByRole('button', { name: 'Warm' });
    this.transferButton = page.getByLabel('Start transfer');
    this.closeButton = page.getByLabel('Close transfer');
    this.errorMessage = page.locator('[role="alert"]');
    this.consultBar = page.getByText('Consulting with');
    this.completeButton = page.getByRole('button', { name: 'Complete' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  async selectCold() {
    await this.coldOption.click();
  }

  async selectWarm() {
    await this.warmOption.click();
  }

  async enterNumber(num: string) {
    await this.phoneInput.fill(num);
  }

  async startTransfer() {
    await this.transferButton.click();
  }

  async completeTransfer() {
    await this.completeButton.click();
  }

  async cancelTransfer() {
    await this.cancelButton.click();
  }

  async close() {
    await this.closeButton.click();
  }
}
