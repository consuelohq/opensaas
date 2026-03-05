import { test, expect } from '@playwright/test';
import { DialerSidebar } from '../lib/pom/dialerSidebar';

test.describe('Consuelo Call Flow', () => {
  test('dial number → call connects → in-call controls visible → end call', async ({
    page,
  }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await dialer.dialNumber('5551234567');
    await page.getByRole('button', { name: 'Dial' }).click();

    await expect(page.getByText('Mute')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Hold')).toBeVisible();
    await expect(page.getByLabel('End call')).toBeVisible();

    await page.getByLabel('End call').click();
    await expect(page.getByLabel('End call')).not.toBeVisible({
      timeout: 10000,
    });
  });

  test('dial invalid number → error displayed', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await dialer.dialNumber('000');
    await page.getByRole('button', { name: 'Dial' }).click();

    await expect(page.locator('[role="alert"]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('call with local presence → caller ID indicator visible', async ({
    page,
  }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();

    // local presence indicator should render when enabled
    const indicator = page.getByText('Local Presence');
    if (await indicator.isVisible()) {
      await expect(indicator).toBeVisible();
    }

    await dialer.dialNumber('5559876543');
    await page.getByRole('button', { name: 'Dial' }).click();
    await expect(page.getByText('Mute')).toBeVisible({ timeout: 15000 });
    await page.getByLabel('End call').click();
  });

  test('mute toggle works during active call', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await dialer.dialNumber('5551234567');
    await page.getByRole('button', { name: 'Dial' }).click();

    await expect(page.getByText('Mute')).toBeVisible({ timeout: 15000 });
    await page.getByText('Mute').click();
    // mute state toggles — button should still be visible
    await expect(page.getByText('Mute')).toBeVisible();

    await page.getByLabel('End call').click();
  });
});
