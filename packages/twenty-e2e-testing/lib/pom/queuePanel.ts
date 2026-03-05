import { Locator, Page } from '@playwright/test';

export class QueuePanel {
  readonly panel: Locator;
  readonly title: Locator;
  readonly settingsButton: Locator;
  readonly startButton: Locator;
  readonly pauseButton: Locator;
  readonly resumeButton: Locator;
  readonly skipButton: Locator;
  readonly progressBar: Locator;
  readonly currentContact: Locator;
  readonly summarySection: Locator;

  constructor(public readonly page: Page) {
    this.panel = page.getByText('Queue');
    this.title = page.getByText('Queue');
    this.settingsButton = page.getByLabel('Queue settings');
    this.startButton = page.getByRole('button', { name: 'Start' });
    this.pauseButton = page.getByRole('button', { name: 'Pause' });
    this.resumeButton = page.getByRole('button', { name: 'Resume' });
    this.skipButton = page.getByRole('button', { name: 'Skip' });
    this.progressBar = page.locator('[role="progressbar"]');
    this.currentContact = page.getByText('Current:');
    this.summarySection = page.getByText('Summary');
  }

  async start() {
    await this.startButton.click();
  }

  async pause() {
    await this.pauseButton.click();
  }

  async resume() {
    await this.resumeButton.click();
  }

  async skip() {
    await this.skipButton.click();
  }
}
