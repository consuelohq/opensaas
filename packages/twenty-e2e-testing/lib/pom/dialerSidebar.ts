import { Locator, Page } from '@playwright/test';

export class DialerSidebar {
  readonly toggleButton: Locator;
  readonly sidebarPanel: Locator;
  readonly numberInput: Locator;
  readonly dialButton: Locator;
  readonly closeButton: Locator;
  readonly keypadDigits: Locator;

  constructor(public readonly page: Page) {
    this.toggleButton = page.getByTestId('dialer-toggle');
    this.sidebarPanel = page.getByTestId('dialer-sidebar');
    this.numberInput = page.getByTestId('dialer-number-input');
    this.dialButton = page.getByRole('button', { name: 'Dial' });
    this.closeButton = page.getByTestId('dialer-close');
    this.keypadDigits = page.locator('[data-testid="dialer-keypad"] button');
  }

  async open() {
    await this.toggleButton.click();
  }

  async close() {
    await this.closeButton.click();
  }

  async dialNumber(num: string) {
    for (const digit of num) {
      await this.page.getByTestId(`dialer-key-${digit}`).click();
    }
  }

  async clearNumber() {
    await this.page.getByTestId('dialer-key-backspace').click();
  }

  async isOpen(): Promise<boolean> {
    return await this.sidebarPanel.isVisible();
  }

  getDisplayedNumber(): Locator {
    return this.numberInput;
  }
}

export default DialerSidebar;
