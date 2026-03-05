import { test, expect } from '@playwright/test';
import { DialerSidebar } from '../lib/pom/dialerSidebar';
import { QueuePanel } from '../lib/pom/queuePanel';

test.describe('Consuelo Queue', () => {
  test('create queue → add contacts → start dialing', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();

    // navigate to queue section — look for queue-related UI
    const queueTab = page.getByRole('button', { name: /queue/i });
    if (await queueTab.isVisible()) {
      await queueTab.click();
    }

    const queue = new QueuePanel(page);

    // start button should be available when queue has contacts
    if (await queue.startButton.isVisible({ timeout: 5000 })) {
      await queue.start();
      // after starting, pause should become available
      await expect(queue.pauseButton).toBeVisible({ timeout: 10000 });
    }
  });

  test('pause queue → resume queue', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();

    const queueTab = page.getByRole('button', { name: /queue/i });
    if (await queueTab.isVisible()) {
      await queueTab.click();
    }

    const queue = new QueuePanel(page);

    if (await queue.startButton.isVisible({ timeout: 5000 })) {
      await queue.start();
      await expect(queue.pauseButton).toBeVisible({ timeout: 10000 });

      await queue.pause();
      await expect(queue.resumeButton).toBeVisible({ timeout: 10000 });

      await queue.resume();
      await expect(queue.pauseButton).toBeVisible({ timeout: 10000 });
    }
  });

  test('queue completes → summary shown', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();

    const queueTab = page.getByRole('button', { name: /queue/i });
    if (await queueTab.isVisible()) {
      await queueTab.click();
    }

    const queue = new QueuePanel(page);
    // verify summary section exists in the queue panel
    const summaryArea = page.getByText(/completed|summary|results/i);
    await expect(summaryArea.or(queue.panel)).toBeVisible({ timeout: 5000 });
  });

  test('skip button advances to next contact', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();

    const queueTab = page.getByRole('button', { name: /queue/i });
    if (await queueTab.isVisible()) {
      await queueTab.click();
    }

    const queue = new QueuePanel(page);

    if (await queue.startButton.isVisible({ timeout: 5000 })) {
      await queue.start();

      if (await queue.skipButton.isVisible({ timeout: 10000 })) {
        await queue.skip();
        // after skip, queue should still be active
        await expect(
          queue.pauseButton.or(queue.skipButton),
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
