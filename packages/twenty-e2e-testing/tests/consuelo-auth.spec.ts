import { test, expect } from '@playwright/test';

test.describe('Consuelo Auth', () => {
  test.use({ storageState: undefined });

  test('login page renders with Consuelo branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Consuelo')).toBeVisible();
  });

  test('email login: enter email -> verify -> dashboard', async ({ page }) => {
    await page.goto('/');
    await page
      .getByPlaceholder('Email')
      .fill(process.env.DEFAULT_LOGIN || 'test@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page
      .getByPlaceholder('Password')
      .fill(process.env.DEFAULT_PASSWORD || 'password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/objects/people');
  });

  test('session persists after page refresh', async ({ page }) => {
    await page.goto('/');
    await page
      .getByPlaceholder('Email')
      .fill(process.env.DEFAULT_LOGIN || 'test@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page
      .getByPlaceholder('Password')
      .fill(process.env.DEFAULT_PASSWORD || 'password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/objects/people');
    await page.reload();
    await page.waitForURL('**/objects/people');
  });

  test('logout returns to login page', async ({ page }) => {
    await page.goto('/');
    await page
      .getByPlaceholder('Email')
      .fill(process.env.DEFAULT_LOGIN || 'test@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page
      .getByPlaceholder('Password')
      .fill(process.env.DEFAULT_PASSWORD || 'password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/objects/people');
    await page.getByTestId('user-menu').click();
    await page.getByText('Sign out').click();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
  });

  test('expired token redirects to login', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'tokenPair',
        value: JSON.stringify({
          accessToken: { token: 'invalid-expired-token' },
          refreshToken: { token: 'invalid' },
        }),
        domain: new URL(page.url() || 'http://localhost:3001').hostname,
        path: '/',
      },
    ]);
    await page.goto('/');
    await expect(page.getByPlaceholder('Email')).toBeVisible();
  });
});
