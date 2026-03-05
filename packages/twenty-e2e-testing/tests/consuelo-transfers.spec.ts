import { test, expect } from '@playwright/test';
import { DialerSidebar } from '../lib/pom/dialerSidebar';
import { TransferModal } from '../lib/pom/transferModal';

test.describe('Consuelo Transfers', () => {
  async function startCall(page: import('@playwright/test').Page) {
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await dialer.dialNumber('5551234567');
    await page.getByRole('button', { name: 'Dial' }).click();
    await expect(page.getByText('Mute')).toBeVisible({ timeout: 15000 });
  }

  test('cold transfer → agent removed, target connected', async ({
    page,
  }) => {
    await page.goto('/');
    await startCall(page);

    await page.getByLabel('Transfer').click();
    const modal = new TransferModal(page);
    await expect(modal.overlay).toBeVisible();

    await modal.selectCold();
    await modal.enterNumber('5559999999');
    await modal.startTransfer();

    // after cold transfer, in-call controls should disappear (agent removed)
    await expect(page.getByLabel('End call')).not.toBeVisible({
      timeout: 15000,
    });
  });

  test('warm transfer → customer held, consult bar visible → complete', async ({
    page,
  }) => {
    await page.goto('/');
    await startCall(page);

    await page.getByLabel('Transfer').click();
    const modal = new TransferModal(page);

    await modal.selectWarm();
    await modal.enterNumber('5559999999');
    await modal.startTransfer();

    // consult bar should appear during warm transfer
    await expect(modal.consultBar).toBeVisible({ timeout: 15000 });
    await expect(modal.completeButton).toBeVisible();

    await modal.completeTransfer();
    await expect(page.getByLabel('End call')).not.toBeVisible({
      timeout: 15000,
    });
  });

  test('warm transfer → cancel → customer unheld', async ({ page }) => {
    await page.goto('/');
    await startCall(page);

    await page.getByLabel('Transfer').click();
    const modal = new TransferModal(page);

    await modal.selectWarm();
    await modal.enterNumber('5559999999');
    await modal.startTransfer();

    await expect(modal.consultBar).toBeVisible({ timeout: 15000 });
    await modal.cancelTransfer();

    // after cancel, agent should still be in call with customer
    await expect(page.getByText('Mute')).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel('End call')).toBeVisible();

    await page.getByLabel('End call').click();
  });

  test('transfer modal closes on close button', async ({ page }) => {
    await page.goto('/');
    await startCall(page);

    await page.getByLabel('Transfer').click();
    const modal = new TransferModal(page);
    await expect(modal.overlay).toBeVisible();

    await modal.close();
    await expect(modal.overlay).not.toBeVisible();

    await page.getByLabel('End call').click();
  });
});
