import { test, expect } from '@playwright/test';

test.describe('Consuelo Navigation', () => {
  test('dashboard loads after login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/objects/people');
    await expect(page.getByText('Welcome')).toBeVisible();
  });

  test('navigate to People via sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'People' }).click();
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  });

  test('navigate to Companies via sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Companies' }).click();
    await expect(
      page.getByRole('heading', { name: 'Companies' }),
    ).toBeVisible();
  });

  test('navigate to Settings via sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('search bar opens and accepts input', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Search').click();
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Search' }).fill('test query');
  });

  test('keyboard shortcut: Cmd+K opens search', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
  });
});
