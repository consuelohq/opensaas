import { test, expect } from '@playwright/test';
import { DialerSidebar } from '../lib/pom/dialerSidebar';

test.describe('Consuelo Dialer', () => {
  test('dialer sidebar toggle visible in nav', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await expect(dialer.toggleButton).toBeVisible();
  });

  test('clicking toggle opens dialer sidebar', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await expect(dialer.sidebarPanel).toBeVisible();
  });

  test('dial pad renders with number input', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await expect(dialer.numberInput).toBeVisible();
  });

  test('typing number updates input field', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await dialer.dialNumber('1234567890');
    await expect(dialer.getDisplayedNumber()).toHaveValue('1234567890');
  });

  test('backspace clears last digit', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await dialer.dialNumber('123');
    await dialer.clearNumber();
    await expect(dialer.getDisplayedNumber()).toHaveValue('12');
  });

  test('close button hides dialer sidebar', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await dialer.close();
    await expect(dialer.sidebarPanel).not.toBeVisible();
  });

  test('dialer persists state across navigation', async ({ page }) => {
    await page.goto('/');
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await dialer.dialNumber('5551234567');
    await page.getByRole('link', { name: 'People' }).click();
    await page.getByRole('link', { name: 'Companies' }).click();
    await expect(dialer.sidebarPanel).toBeVisible();
    await expect(dialer.getDisplayedNumber()).toHaveValue('5551234567');
  });
});
